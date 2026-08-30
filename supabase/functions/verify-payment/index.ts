import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}; const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization');if(!auth)return json({error:'Unauthorized'},401); const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const admin=createClient(url,service);const {data:{user}}=await userClient.auth.getUser();if(!user)return json({error:'Unauthorized'},401);
  const {reference}=await req.json();if(!reference)return json({error:'Reference required'},400);const secret=Deno.env.get('PAYSTACK_SECRET_KEY');if(!secret)return json({error:'Payment service is not configured'},503);
  const r=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${secret}`}});const data=await r.json();if(!r.ok||data?.data?.status!=='success')return json({error:'Payment not verified'},402);
  if(data.data.metadata?.user_id!==user.id)return json({error:'Payment ownership mismatch'},403);
  const {data:payment}=await admin.from('payments').select('*').eq('reference',reference).single();if(!payment)return json({error:'Payment record not found'},404);
  if(payment.status==='successful'){return json({success:true,already_processed:true});}
  const now=new Date();const end=new Date(now);end.setMonth(end.getMonth()+1);
  await admin.from('payments').update({status:'successful',gateway_transaction_id:String(data.data.id),paid_at:data.data.paid_at||now.toISOString()}).eq('reference',reference);
  const {data:existing}=await admin.from('subscriptions').select('id').eq('user_id',user.id).maybeSingle();
  if(existing) await admin.from('subscriptions').update({plan:'pro',status:'active',current_period_start:now.toISOString(),current_period_end:end.toISOString(),scans_limit:200,scans_used:0,cancel_at_period_end:false}).eq('id',existing.id);
  else await admin.from('subscriptions').insert({user_id:user.id,plan:'pro',status:'active',current_period_start:now.toISOString(),current_period_end:end.toISOString(),scans_limit:200,scans_used:0});
  await admin.from('profiles').update({plan:'pro',subscription_status:'active'}).eq('id',user.id);await admin.from('usage_tracking').upsert({user_id:user.id,current_period_start:now.toISOString(),current_period_end:end.toISOString(),monthly_scans_used:0});await admin.from('security_logs').insert({user_id:user.id,event_type:'subscription_activated',metadata:{reference}});
  return json({success:true});
 }catch(e){console.error('verify-payment',e instanceof Error?e.message:'unknown');return json({error:'Unable to verify payment'},500)}
});
