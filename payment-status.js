function json(res,status,data){res.status(status).json(data)}
module.exports=async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',process.env.ALLOWED_ORIGIN||'*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method!=='GET') return json(res,405,{success:false,message:'Method tidak diizinkan.'});
  if(!process.env.XENDIT_SECRET_KEY) return json(res,500,{success:false,message:'XENDIT_SECRET_KEY belum diatur.'});
  const id=String(req.query.id||'').trim();
  if(!id) return json(res,422,{success:false,message:'Payment Request ID wajib diisi.'});
  try{
    const r=await fetch('https://api.xendit.co/v3/payment_requests/'+encodeURIComponent(id),{headers:{'Authorization':'Basic '+Buffer.from(process.env.XENDIT_SECRET_KEY+':').toString('base64'),'api-version':'2024-11-11','Accept':'application/json'}});
    const data=await r.json();
    if(!r.ok) return json(res,r.status,{success:false,message:data.message||'Gagal mengambil status pembayaran.'});
    return json(res,200,{success:true,status:data.status||'UNKNOWN',order_id:data.reference_id||null,payment_request_id:data.payment_request_id||id,amount:data.request_amount||null});
  }catch(e){return json(res,500,{success:false,message:e.message||'Terjadi kesalahan server.'})}
}
