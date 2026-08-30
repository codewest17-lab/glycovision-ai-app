import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Apple, ArrowLeft, BarChart3, Camera, Check, ChevronRight, CircleUserRound, Clock3, FileText, History, Home, LogOut, Menu, Search, Settings, ShieldCheck, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import { supabase, signInWithProvider } from './lib/supabase';

const onboarding = [
  { title:'Understand Your Food Better', text:'Scan your meals and discover estimated sugar levels and nutrition information instantly.', icon:Activity },
  { title:'AI-Powered Meal Scanning', text:'Take a photo of your meal and let AI identify foods, estimate sugar, and analyze nutrition.', icon:Camera },
  { title:'Make Better Food Decisions', text:'Track your meals and understand your eating habits with intelligent insights.', icon:BarChart3 },
  { title:'Premium Features', text:'Advanced meal analysis, scan history, more monthly scans, and detailed nutritional insights.', icon:Sparkles }
];

function App(){
  const [session,setSession]=useState(null); const [profile,setProfile]=useState(null); const [balance,setBalance]=useState(null); const [loading,setLoading]=useState(true); const [balanceLoading,setBalanceLoading]=useState(false); const [balanceError,setBalanceError]=useState('');
  const [onboarded,setOnboarded]=useState(localStorage.getItem('glyco_onboarded')==='1');
  useEffect(()=>{
    let mounted=true;
    async function loadInitialSession(){
      const {data,error}=await supabase.auth.getSession();
      if(!mounted)return;
      if(error){setLoading(false);return;}
      setSession(data.session);
      if(data.session) await refresh(data.session.user.id);
      if(mounted)setLoading(false);
    }
    loadInitialSession();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{
      if(!mounted)return;
      setSession(s);
      if(!s){setProfile(null);setBalance(null);setBalanceError('');setBalanceLoading(false);return;}
      // Do not await inside the auth callback. Load authenticated data separately.
      setBalanceLoading(true);
      refresh(s.user.id).finally(()=>{if(mounted)setBalanceLoading(false);});
    });
    return()=>{mounted=false;subscription.unsubscribe();};
  },[]);
  async function refresh(uid){
    setBalanceError('');
    const [{data:p,error:profileError},{data:b,error:balanceErr}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',uid).single(),
      supabase.rpc('get_scan_balance')
    ]);
    if(balanceErr){setBalance(null);setBalanceError(balanceErr.message||'Unable to load your scan balance.');}
    else setBalance(b);
    setProfile(profileError ? null : p);
    return {profile:p,balance:b,profileError,balanceErr};
  }
  if(loading) return <Splash/>;
  if(!onboarded && !session) return <Onboarding onDone={()=>{localStorage.setItem('glyco_onboarded','1');setOnboarded(true)}}/>;
  return <Routes>
    <Route path="/auth" element={session?<Navigate to="/dashboard" replace/>:<Auth/>}/>
    <Route path="/" element={<Navigate to={session?'/dashboard':'/auth'} replace/>}/>
    <Route element={<Protected session={session} profile={profile} balance={balance} refresh={refresh}/>}> 
      <Route path="/dashboard" element={<Dashboard profile={profile} balance={balance}/>}/>
      <Route path="/scan" element={<Scanner profile={profile} balance={balance} balanceLoading={balanceLoading} balanceError={balanceError} refresh={()=>refresh(session.user.id)}/>}/>
      <Route path="/history" element={<HistoryPage/>}/>
      <Route path="/upgrade" element={<Upgrade profile={profile}/>}/>
      <Route path="/profile" element={<Profile profile={profile} refresh={()=>refresh(session.user.id)}/>}/>
      <Route path="/legal/:page" element={<Legal/>}/>
      <Route path="/admin" element={profile?.is_admin?<Admin/>:<Navigate to="/dashboard" replace/>}/>
    </Route>
    <Route path="*" element={<Navigate to={session?'/dashboard':'/auth'} replace/>}/>
  </Routes>
}

function Protected({session,profile,balance,refresh}){ return <AppShell profile={profile} balance={balance}><Outlet/></AppShell> }

function Splash(){return <div className="splash"><div className="brand-mark"><Activity size={30}/></div><h1>GlycoVision AI</h1><p>Meal intelligence, made simple.</p></div>}

function Onboarding({onDone}){ const [i,setI]=useState(0); const s=onboarding[i]; const Icon=s.icon; return <div className="onboard"><div className="onboard-top"><span className="brand"><span className="brand-dot"><Activity size={17}/></span> GlycoVision</span><button className="text-btn" onClick={onDone}>Skip</button></div><div className="onboard-visual"><div className="orb"><Icon size={56}/></div></div><div className="onboard-copy"><span className="eyebrow">{String(i+1).padStart(2,'0')} / 04</span><h1>{s.title}</h1><p>{s.text}</p></div><div className="onboard-bottom"><div className="dots">{onboarding.map((_,n)=><span key={n} className={n===i?'dot active':'dot'}/>)}</div><button className="primary wide" onClick={()=>i<3?setI(i+1):onDone()}>{i<3?'Continue':'Get Started'} <ChevronRight size={18}/></button></div></div> }

function Auth(){ const [mode,setMode]=useState('signin'); const [form,setForm]=useState({name:'',email:'',password:'',confirm:''}); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const navigate=useNavigate();
  async function submit(e){e.preventDefault();setError('');setMessage(''); if(mode==='signup'&&form.password!==form.confirm){setError('Passwords do not match.');return;} if(form.password.length<8){setError('Password must be at least 8 characters.');return;} setBusy(true); let result; if(mode==='signup') result=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name},emailRedirectTo:window.location.origin+'/dashboard'}}); else result=await supabase.auth.signInWithPassword({email:form.email,password:form.password}); setBusy(false); if(result.error){setError(result.error.message);return;} if(mode==='signup'&&!result.data.session)setMessage('Check your email to verify your account, then return here to sign in.'); else navigate('/dashboard'); }
  async function forgot(){ if(!form.email)return setError('Enter your email first.'); setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(form.email,{redirectTo:window.location.origin+'/profile'});setBusy(false); if(error)setError(error.message);else setMessage('Password reset email sent.'); }
  return <div className="auth-page"><div className="auth-brand"><span className="brand-dot"><Activity size={17}/></span><span>GlycoVision AI</span></div><div className="auth-card"><div className="auth-head"><span className="eyebrow">MEAL INTELLIGENCE</span><h1>{mode==='signin'?'Welcome back':'Create your account'}</h1><p>{mode==='signin'?'Continue your food awareness journey.':'Start with two free meal scans.'}</p></div>{error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}<form onSubmit={submit}>{mode==='signup'&&<label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Your name"/></label>}<label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="you@example.com"/></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required placeholder="At least 8 characters"/></label>{mode==='signup'&&<label>Confirm password<input type="password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required placeholder="Repeat password"/></label>}{mode==='signin'&&<button type="button" className="link-btn forgot" onClick={forgot}>Forgot password?</button>}<button className="primary wide" disabled={busy}>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</button></form><div className="divider"><span>or continue with</span></div><div className="provider-row"><button className="provider" onClick={()=>signInWithProvider('google')}><span className="provider-icon">G</span> Google</button><button className="provider" onClick={()=>signInWithProvider('apple')}><Apple size={18}/> Apple</button></div><p className="switch">{mode==='signin'?"Don't have an account?":"Already have an account?"} <button className="link-btn" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('');setMessage('')}}>{mode==='signin'?'Create one':'Sign in'}</button></p></div><p className="legal-note">By continuing, you agree to our <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>.</p></div> }

function AppShell({children,profile,balance}){ const nav=useNavigate(); const loc=useLocation(); const [open,setOpen]=useState(false); const items=[['/dashboard','Dashboard',Home],['/scan','Scan meal',Camera],['/history','Meal history',History],['/upgrade','Go Pro',Zap],['/profile','Profile',CircleUserRound]]; async function logout(){await supabase.auth.signOut();nav('/auth');} return <div className="app"><aside className={open?'sidebar open':'sidebar'}><div className="sidebar-brand"><span className="brand-dot"><Activity size={18}/></span><span>GlycoVision</span></div><nav>{items.map(([p,t,I])=><button key={p} className={loc.pathname===p?'nav-item active':'nav-item'} onClick={()=>{nav(p);setOpen(false)}}><I size={18}/><span>{t}</span></button>)}</nav><div className="sidebar-bottom"><div className="mini-plan"><div><span className="muted">Plan</span><strong>{profile?.plan==='pro'?'Pro':'Free'}</strong></div><span className="scan-pill">{balance?.remaining??0} scans</span></div><button className="nav-item" onClick={logout}><LogOut size={18}/><span>Sign out</span></button></div></aside>{open&&<div className="backdrop" onClick={()=>setOpen(false)}/>}<main className="main"><header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(true)}><Menu/></button><div className="topbar-title"><span className="eyebrow">YOUR FOOD, UNDERSTOOD</span><strong>{loc.pathname==='/dashboard'?'Dashboard':loc.pathname==='/scan'?'Meal scanner':loc.pathname==='/history'?'Meal history':loc.pathname==='/upgrade'?'GlycoVision Pro':'Account'}</strong></div><button className="avatar" onClick={()=>nav('/profile')}>{profile?.full_name?.[0]?.toUpperCase()||'U'}</button></header>{children}</main></div> }

function Dashboard({profile,balance}){const nav=useNavigate();const [recent,setRecent]=useState([]);useEffect(()=>{supabase.from('meal_scans').select('*').eq('status','completed').order('created_at',{ascending:false}).limit(3).then(({data})=>setRecent(data||[]));},[]);return <section className="page"><div className="hero-card"><div><span className="eyebrow">GOOD TO SEE YOU</span><h1>Hi, {profile?.full_name?.split(' ')[0]||'there'}.</h1><p>Turn a meal into useful insight in seconds.</p><button className="primary" onClick={()=>nav('/scan')}><Camera size={18}/> Scan a meal</button></div><div className="hero-orb"><Sparkles size={40}/></div></div><div className="stats-grid"><Stat title="Scans left" value={balance?.remaining??0} sub={balance?.plan==='pro'?'This billing cycle':'Lifetime'} icon={Camera}/><Stat title="Plan" value={balance?.plan==='pro'?'Pro':'Free'} sub={balance?.plan==='pro'?'200 monthly scans':'2 lifetime scans'} icon={Zap}/><Stat title="Status" value={profile?.subscription_status==='active'?'Active':'Ready'} sub="Account status" icon={ShieldCheck}/></div><div className="section-head"><div><span className="eyebrow">RECENT</span><h2>Your latest meals</h2></div><button className="link-btn" onClick={()=>nav('/history')}>View all</button></div>{recent.length? <div className="meal-list">{recent.map(m=><MealRow key={m.id} meal={m}/>)}</div>:<EmptyState icon={History} title="No meals yet" text="Your completed meal analyses will appear here." action="Scan your first meal" onClick={()=>nav('/scan')}/>}</section>}
function Stat({title,value,sub,icon:Icon}){return <div className="stat-card"><div className="stat-icon"><Icon size={18}/></div><div><span>{title}</span><strong>{value}</strong><small>{sub}</small></div></div>}
function MealRow({meal,onDelete}){return <div className="meal-row"><div className="meal-thumb">{meal.image_path?<div className="thumb-placeholder"><Camera size={18}/></div>:<Activity size={18}/>}</div><div className="meal-main"><strong>{(meal.detected_foods||[]).slice(0,2).map(x=>typeof x==='string'?x:x.name).join(', ')||'Meal analysis'}</strong><span>{new Date(meal.created_at).toLocaleDateString()}</span></div><div className="meal-sugar"><strong>{meal.sugar??'—'}g</strong><span>sugar</span></div>{onDelete&&<button className="icon-btn danger" onClick={()=>onDelete(meal.id)}><Trash2 size={17}/></button>}</div>}

function Scanner({balance,balanceLoading,balanceError,refresh}){const [file,setFile]=useState(null);const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const [result,setResult]=useState(null);const [error,setError]=useState('');const [request,setRequest]=useState('');const nav=useNavigate(); const balanceReady=balance!==null && !balanceLoading && !balanceError; const remaining=balanceReady ? Number(balance.remaining)||0 : null; function choose(f){if(!f)return;setFile(f);setPreview(URL.createObjectURL(f));setResult(null);setError('');} async function analyze(){if(!file)return; if(!balanceReady)return; if(remaining<=0){nav('/upgrade');return;}setBusy(true);setError(''); try{const {data:{user}}=await supabase.auth.getUser(); const ext=file.name.split('.').pop()||'jpg'; const path=`${user.id}/${crypto.randomUUID()}.${ext}`; const up=await supabase.storage.from('meal-images').upload(path,file,{contentType:file.type,upsert:false}); if(up.error)throw up.error; const { data, error: fnErr } = await supabase.functions.invoke(
  'analyze-meal',
  {
    body: {
      image_path: path,
      user_request: request
    }
  }
);

if (fnErr) {
  throw new Error(
    fnErr.message || 'Unable to connect to the meal analysis service.'
  );
}

if (!data) {
  throw new Error('The analysis service returned no response.');
}

if (data.ok === false) {
  throw new Error(
    data.message ||
    data.error ||
    'The meal could not be analyzed.'
  );
}

if (!data.scan) {
  throw new Error(
    'The analysis completed but returned no meal data. Please try again.'
  );
}

setResult(data.scan);
await refresh();}catch(e){setError(e.message||'We could not analyze this meal. Please try again.');}finally{setBusy(false)}} return <section className="page"><div className="scanner-head"><div><span className="eyebrow">AI MEAL ANALYSIS</span><h1>What’s on your plate?</h1><p>Upload or capture a meal photo and GlycoVision will estimate sugar and nutrition.</p></div><div className="balance-card"><Camera size={18}/><strong>{balanceLoading?'…':balanceError?'—':remaining}</strong><span>{balanceLoading?'loading scans':balanceError?'balance unavailable':'scans left'}</span></div></div>{balanceError&&<div className="alert error">{balanceError}</div>}{error&&<div className="alert error">{error}</div>}{result?<AnalysisResult result={result} onAgain={()=>{setResult(null);setFile(null);setPreview('')}}/>:<><label className={preview?'upload-zone has-image':'upload-zone'}>{preview?<img src={preview} alt="Meal preview"/>:<><div className="upload-icon"><Upload size={24}/></div><strong>Upload a meal photo</strong><span>JPG, PNG or WEBP • up to 10MB</span><small>On mobile, you can use your camera.</small></>}<input type="file" accept="image/*" capture="environment" onChange={e=>choose(e.target.files?.[0])}/></label><label className="field">Optional request<input value={request} onChange={e=>setRequest(e.target.value)} placeholder="e.g. Focus on hidden sugars"/></label><button className="primary wide" disabled={!file||busy||!balanceReady} onClick={analyze}>{busy?<><span className="spinner"/>Analyzing your meal…</>:<><Sparkles size={18}/> Analyze meal</>}</button><div className="scan-note"><ShieldCheck size={17}/><span>Your image is stored securely and used only for your meal analysis.</span></div></>}</section>}
function AnalysisResult({result,onAgain}){const n=result;return <div className="analysis"><div className="analysis-top"><div><span className="eyebrow">ANALYSIS COMPLETE</span><h2>{(n.detected_foods||[]).map(x=>typeof x==='string'?x:x.name).join(', ')||'Your meal'}</h2><p>{n.nutrition_summary}</p></div><div className="confidence"><strong>{Math.round(n.confidence_score||0)}%</strong><span>confidence</span></div></div><div className="nutrition-grid"><Metric label="Sugar" value={n.sugar} unit="g" highlight/><Metric label="Calories" value={n.calories} unit="kcal"/><Metric label="Carbs" value={n.carbohydrates} unit="g"/><Metric label="Protein" value={n.protein} unit="g"/><Metric label="Fat" value={n.fat} unit="g"/><Metric label="Fiber" value={n.fiber} unit="g"/></div><div className="insight-card"><span className="eyebrow">HEALTH INSIGHTS</span><ul>{(n.health_insights||[]).map((x,i)=><li key={i}><Check size={16}/>{x}</li>)}</ul></div><button className="secondary wide" onClick={onAgain}><Camera size={18}/> Scan another meal</button></div>}
function Metric({label,value,unit,highlight}){return <div className={highlight?'metric highlight':'metric'}><span>{label}</span><strong>{value??'—'}<small>{unit}</small></strong></div>}

function HistoryPage(){const [items,setItems]=useState([]);const [q,setQ]=useState('');useEffect(()=>load(),[]);async function load(){const {data}=await supabase.from('meal_scans').select('*').eq('status','completed').order('created_at',{ascending:false});setItems(data||[]);}async function del(id){await supabase.from('meal_scans').delete().eq('id',id);setItems(x=>x.filter(m=>m.id!==id));}const filtered=items.filter(m=>JSON.stringify(m.detected_foods||[]).toLowerCase().includes(q.toLowerCase())||new Date(m.created_at).toLocaleDateString().includes(q));return <section className="page"><div className="section-head"><div><span className="eyebrow">YOUR JOURNAL</span><h1>Meal history</h1></div><span className="count-chip">{items.length} scans</span></div><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search meals…"/></div>{filtered.length?<div className="meal-list">{filtered.map(m=><MealRow key={m.id} meal={m} onDelete={del}/>)}</div>:<EmptyState icon={History} title="Nothing matches" text="Try another search or scan a new meal."/>}</section>}

function Upgrade({profile}){const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [verified,setVerified]=useState(false);useEffect(()=>{const ref=new URLSearchParams(window.location.search).get('reference');if(!ref||verified)return;setBusy(true);supabase.functions.invoke('verify-payment',{body:{reference:ref}}).then(({data,error})=>{if(error||!data?.success)setError(error?.message||data?.error||'Payment could not be verified.');else setVerified(true);}).finally(()=>setBusy(false));},[verified]);async function checkout(){setBusy(true);setError('');const {data,error}=await supabase.functions.invoke('initialize-payment');if(error||!data?.authorization_url){setError(error?.message||data?.error||'Payment setup is not ready. Add your Paystack secret and plan configuration.');setBusy(false);return;}window.location.href=data.authorization_url;}return <section className="page upgrade-page">{verified&&<div className="alert success">Payment verified. Your Pro access is being activated.</div>}<div className="pro-hero"><div><span className="eyebrow">GLYCOVISION PRO</span><h1>More scans. Deeper insight.</h1><p>Unlock 200 AI meal scans every billing cycle with full nutrition and detailed sugar analysis.</p></div><div className="pro-price"><strong>$9.99</strong><span>/ month</span></div></div>{error&&<div className="alert error">{error}</div>}<div className="feature-grid">{['200 AI meal scans monthly','Full nutrition breakdown','Detailed sugar analysis','Scan history','Premium insights'].map(x=><div className="feature" key={x}><Check size={18}/><span>{x}</span></div>)}</div><button className="primary wide" onClick={checkout} disabled={busy||profile?.plan==='pro'}>{profile?.plan==='pro'?'You are on Pro':busy?'Opening secure checkout…':'Upgrade securely with Paystack'}</button><p className="fine-print">You only receive Pro access after successful payment verification.</p></section>}

function Profile({profile,refresh}){const [name,setName]=useState(profile?.full_name||'');const [saved,setSaved]=useState(false);async function save(){await supabase.from('profiles').update({full_name:name}).eq('id',profile.id);setSaved(true);await refresh();setTimeout(()=>setSaved(false),1800)}return <section className="page narrow"><span className="eyebrow">ACCOUNT</span><h1>Profile</h1><div className="profile-card"><div className="profile-avatar">{name?.[0]?.toUpperCase()||'U'}</div><div><strong>{profile?.email}</strong><span>{profile?.plan==='pro'?'GlycoVision Pro':'Free plan'}</span></div></div><label className="field">Full name<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary" onClick={save}>{saved?'Saved':'Save changes'}</button><div className="legal-links"><a href="/legal/privacy">Privacy Policy</a><a href="/legal/terms">Terms of Service</a><a href="/legal/cookies">Cookie Policy</a><a href="/legal/refunds">Refund Policy</a><a href="/legal/delete">Data deletion request</a><a href="mailto:support@glycovision.ai">Contact support</a></div></section>}

function Legal(){const loc=useLocation();const map={privacy:['Privacy Policy','GlycoVision AI stores account, meal analysis, subscription, payment and usage information needed to provide the service. Users can request deletion of their data.'],terms:['Terms of Service','GlycoVision AI provides AI-generated meal and nutrition estimates for informational awareness. Results may be imperfect and should not be treated as medical advice.'],cookies:['Cookie Policy','GlycoVision AI may use essential browser storage for authentication, onboarding state and application preferences.'],refunds:['Refund Policy','Subscription refunds and cancellation handling should follow the final Paystack billing terms configured for the service.'],delete:['Data Deletion Request','To request account and associated data deletion, contact support and include the email address on the account.']};const [title,text]=map[loc.pathname.split('/').pop()]||map.privacy;return <section className="page narrow"><button className="link-btn back" onClick={()=>history.back()}><ArrowLeft size={17}/> Back</button><span className="eyebrow">LEGAL</span><h1>{title}</h1><p className="legal-body">{text}</p><p className="fine-print">This page is a product placeholder and should be reviewed with your legal advisor before launch.</p></section>}

function Admin(){const [stats,setStats]=useState({});useEffect(()=>{Promise.all([supabase.from('profiles').select('*',{count:'exact',head:true}),supabase.from('profiles').select('*',{count:'exact',head:true}).eq('plan','pro'),supabase.from('meal_scans').select('*',{count:'exact',head:true}),supabase.from('payments').select('*',{count:'exact',head:true})]).then(([u,p,s,pay])=>setStats({users:u.count||0,pro:p.count||0,scans:s.count||0,payments:pay.count||0}));},[]);return <section className="page"><span className="eyebrow">ADMIN</span><h1>System overview</h1><div className="stats-grid"><Stat title="Total users" value={stats.users??0} sub="Registered" icon={CircleUserRound}/><Stat title="Subscribers" value={stats.pro??0} sub="Pro plan" icon={Zap}/><Stat title="Scans" value={stats.scans??0} sub="All time" icon={Camera}/><Stat title="Payments" value={stats.payments??0} sub="Transactions" icon={Activity}/></div><div className="admin-note"><ShieldCheck size={20}/><div><strong>Security monitoring</strong><p>Payment, scan and security events are stored for operational monitoring. Access is restricted by RLS.</p></div></div></section>}
function EmptyState({icon:Icon,title,text,action,onClick}){return <div className="empty"><div className="empty-icon"><Icon size={24}/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="secondary" onClick={onClick}>{action}</button>}</div>}

export default App;
