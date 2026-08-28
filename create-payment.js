const CATALOG = {
  'Makalah Presentasi': 25000,
  'Laporan PKL': 30000,
  'Editing Video': 25000,
  'Design Digital': 15000
};

const CHANNELS = new Set(['GOPAY','DANA','SHOPEEPAY']);

function json(res, status, data) {
  res.status(status).json(data);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, {success:false,message:'Method tidak diizinkan.'});
  if (!process.env.XENDIT_SECRET_KEY) return json(res, 500, {success:false,message:'XENDIT_SECRET_KEY belum diatur di environment Vercel.'});

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = String(input.name || '').trim();
    const phone = String(input.phone || '').trim();
    const deadline = String(input.deadline || '').trim();
    const detail = String(input.detail || '-').trim() || '-';
    const channel = String(input.payment_method || '').trim().toUpperCase();
    const cart = Array.isArray(input.cart) ? input.cart : [];
    if (!name || !phone || !deadline || !cart.length) return json(res,422,{success:false,message:'Nama, WhatsApp, deadline, dan pesanan wajib diisi.'});
    if (!CHANNELS.has(channel)) return json(res,422,{success:false,message:'Metode pembayaran tidak didukung.'});

    const items=[]; let total=0;
    for (const item of cart) {
      const service=String(item.service||'').trim(); const qty=Number(item.qty||0);
      if (!CATALOG[service] || !Number.isInteger(qty) || qty<1 || qty>99) continue;
      const price=CATALOG[service]; total += price*qty;
      items.push({reference_id: service.replace(/[^A-Za-z0-9._-]/g,'-').toUpperCase().slice(0,40),type:'DIGITAL_SERVICE',name:service,net_unit_amount:price,quantity:qty,category:'JASA_DIGITAL'});
    }
    if (!items.length || total < 100) return json(res,422,{success:false,message:'Pesanan tidak valid.'});

    const orderId='ZEN-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
    const base=process.env.ZENSTORE_PUBLIC_URL || 'https://example.github.io/zenstore';
    const payload={reference_id:orderId,type:'PAY',country:'ID',currency:'IDR',request_amount:total,capture_method:'AUTOMATIC',channel_code:channel,channel_properties:{success_return_url:`${base}/payment-success.html?order_id=${encodeURIComponent(orderId)}`,failure_return_url:`${base}/payment-failed.html?order_id=${encodeURIComponent(orderId)}`},description:`Pembayaran ZENSTORE ${orderId}`,metadata:{customer_name:name.slice(0,500),customer_phone:phone.slice(0,500),deadline:deadline.slice(0,500),detail:detail.slice(0,500)},items};

    const r=await fetch('https://api.xendit.co/v3/payment_requests',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(process.env.XENDIT_SECRET_KEY+':').toString('base64'),'api-version':'2024-11-11','Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
    const data=await r.json();
    if(!r.ok){return json(res,r.status,{success:false,message:data.message||data.error_code||'Xendit menolak transaksi.'});}
    const action=(data.actions||[]).find(a=>a.type==='REDIRECT_CUSTOMER' && a.value);
    if(!action) return json(res,502,{success:false,message:'Xendit tidak memberikan URL pembayaran.'});
    return json(res,200,{success:true,order_id:orderId,payment_request_id:data.payment_request_id||null,status:data.status||'REQUIRES_ACTION',redirect_url:action.value,total});
  } catch(e){ return json(res,500,{success:false,message:e.message||'Terjadi kesalahan server.'}); }
};
