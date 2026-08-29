import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization'); if(!auth)return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const admin=createClient(url,service);
  const {data:{user}}=await userClient.auth.getUser(); if(!user)return json({error:'Unauthorized'},401);
  const {data:profile}=await admin.from('profiles').select('email,full_name,plan').eq('id',user.id).single();
  if(profile?.plan==='pro')return json({error:'Already subscribed'},409);
  const secret=Deno.env.get('PAYSTACK_SECRET_KEY'); if(!secret)return json({error:'Payment service is not configured'},503);
  const currency=Deno.env.get('PAYSTACK_CURRENCY')||'USD'; const amount=Number(Deno.env.get('PAYSTACK_AMOUNT_MINOR')||999); const callback=`${Deno.env.get('APP_URL')||req.headers.get('origin')||'http://localhost:5173'}/upgrade`;
  const reference=`glyco_${user.id}_${crypto.randomUUID()}`;
  const r=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({email:profile?.email||user.email,amount,currency,reference,callback_url:callback,metadata:{user_id:user.id,plan:'pro'}})});
  const data=await r.json(); if(!r.ok||!data.status)return json({error:'Unable to initialize payment'},502);
  const adminInsert=await admin.from('payments').insert({user_id:user.id,reference,amount_minor:amount,currency,status:'initialized',metadata:{access_code:data.data.access_code,plan:'pro'}}); if(adminInsert.error)throw adminInsert.error;
  return json({authorization_url:data.data.authorization_url,reference});
 }catch(e){console.error('initialize-payment',e instanceof Error?e.message:'unknown');return json({error:'Unable to start checkout'},500)}
});
