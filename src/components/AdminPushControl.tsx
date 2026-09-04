import { BellRing, Check, Send, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

const VAPID_PUBLIC_KEY='BKUlP2Eac3-YgIYaqtOOIQRnF4zBBHHY0gqpAyE23OXHVXFtk73LlmCZYS8iFTWaTX-etR2l-cN0w-hDrRdxdhc'
type PushState='checking'|'ready'|'enabled'|'denied'|'unsupported'|'needs_install'|'busy'|'error'
function ios(){return /iPad|iPhone|iPod/.test(navigator.userAgent)}
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)}
function key(value:string){const padding='='.repeat((4-(value.length%4))%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}

export default function AdminPushControl({adminId}:{adminId:string}){
  const {t}=useI18n(); const [state,setState]=useState<PushState>('checking'); const [message,setMessage]=useState(''); const [testing,setTesting]=useState(false)
  const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window
  async function persist(subscription:PushSubscription){const s=subscription.toJSON();if(!s.keys?.p256dh||!s.keys?.auth)throw new Error('keys');const {error}=await supabase.from('admin_push_subscriptions').upsert({admin_id:adminId,endpoint:subscription.endpoint,p256dh:s.keys.p256dh,auth:s.keys.auth,user_agent:navigator.userAgent,active:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)throw error}
  async function inspect(){if(!supported){setState('unsupported');return}if(ios()&&!standalone()){setState('needs_install');return}if(Notification.permission==='denied'){setState('denied');return}try{const r=await navigator.serviceWorker.ready;const s=await r.pushManager.getSubscription();if(s){await persist(s);setState('enabled')}else setState('ready')}catch{setState('error')}}
  useEffect(()=>{void inspect()},[])
  async function enable(){setState('busy');setMessage('');try{const p=await Notification.requestPermission();if(p!=='granted'){setState(p==='denied'?'denied':'ready');return}const r=await navigator.serviceWorker.ready;let s=await r.pushManager.getSubscription();if(!s)s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key(VAPID_PUBLIC_KEY) as BufferSource});await persist(s);setState('enabled');setMessage('Ativo neste dispositivo.')}catch{setState('error');setMessage('Não foi possível ativar as notificações.')}}
  async function disable(){setState('busy');setMessage('');try{const r=await navigator.serviceWorker.ready;const s=await r.pushManager.getSubscription();if(s){await supabase.from('admin_push_subscriptions').delete().eq('endpoint',s.endpoint);await s.unsubscribe()}setState('ready');setMessage('Desativado neste dispositivo.')}catch{setState('error');setMessage('Não foi possível desativar as notificações.')}}
  async function test(){setTesting(true);setMessage('');try{const {data,error}=await supabase.functions.invoke('admin-web-push',{body:{action:'test'}});if(error)throw error;setMessage(data?.sent?'Teste enviado para este dispositivo.':'Nenhum dispositivo ativo foi encontrado.')}catch{setMessage('Não foi possível enviar o teste.')}finally{setTesting(false)}}
  const enabled=state==='enabled';const busy=state==='busy'||state==='checking';const canToggle=!['denied','unsupported','needs_install'].includes(state)
  return <div className="preferenceRow pushPreferenceRow"><div className="preferenceIcon">{enabled?<BellRing size={19}/>:<Smartphone size={19}/>}</div><div className="preferenceCopy"><strong>{t('notifications')}</strong><span>{enabled?'Ativas neste dispositivo':state==='needs_install'?'Instale o RV App na Tela de Início para ativar no iPhone.':state==='denied'?'Bloqueadas pelo navegador ou sistema.':'Receba novos cadastros e conclusões mesmo com o app fechado.'}</span>{message&&<small>{message}</small>}{enabled&&<button type="button" className="preferenceTextAction" onClick={()=>void test()} disabled={testing}><Send size={14}/>{testing?'Enviando...':'Enviar teste'}</button>}</div><button type="button" className={`rvSwitch ${enabled?'on':''}`} role="switch" aria-checked={enabled} onClick={()=>enabled?void disable():void enable()} disabled={busy||!canToggle}><span>{enabled&&<Check size={12}/>}</span></button></div>
}
