const moneyPLN = value => Number(value).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
const formatUSD = value => Number(value).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD';
const estimatePLN = value => value == null ? 'Czekamy na kurs NBP' : 'ok. '+moneyPLN(value);
const editionDate = month => new Date(month+'-05T12:00:00Z').toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Warsaw'});
function escapeMemberText(text) {
  const chars = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return text.replace(/[&<>"']/g,char=>chars[char]);
}
function displayData(value, rich, key='') {
  if (Array.isArray(value)) return value.map(row=>displayData(row,rich));
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,displayData(v,rich,k)]));
  if (typeof value!=='string') return value;
  if (key==='content' && rich && window.DOMPurify) return DOMPurify.sanitize(value,{
    ALLOWED_TAGS:['p','br','div','span','strong','b','i','em','u','s','ol','ul','li','blockquote','h1','h2','h3','a','img'],
    ALLOWED_ATTR:['href','src','alt'],ALLOW_DATA_ATTR:false
  });
  if (key==='image_url' && !/^(https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value)) return '';
  return escapeMemberText(value);
}
async function dashboardFetch(path,options={}) {
  const token=localStorage.getItem('wingman_join_token');
  if (path==='/api/login'||path==='/api/register'||path==='/api/group-buy/status') return fetch(path,options);
  if (path==='/api/stats/history') return fetch('/public-data/stats/history',options);
  if (path==='/api/forgot-password') return Response.json({error:'Wysyłka linków do resetu hasła w DEV jest wyłączona.'},{status:503});
  const publicPath=!token && ['/api/forum/posts','/api/knowledge/posts'].includes(path);
  const base=publicPath ? '/api/dashboard-public/' : '/api/enrollment/member/';
  const headers=new Headers(options.headers);
  if(token) headers.set('Authorization','Bearer '+token);
  const response=await fetch(base+path.slice('/api/'.length),{...options,headers,cache:'no-store'});
  if (response.status===401 && token && token===localStorage.getItem('wingman_join_token')) {
    localStorage.removeItem('wingman_join_token'); localStorage.removeItem('wingman_user');
    location.replace('/dashboard.html?tab=panel');
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return response;
  const data=await response.json();
  if (path==='/api/create-subscription-session') return Response.json(data);
  return Response.json(displayData(data,/^\/api\/(forum|knowledge)\//.test(path)));
}
window.addEventListener('pageshow',event=>{if(event.persisted) location.reload();});
window.addEventListener('storage',event=>{if(event.key==='wingman_join_token'||event.key===null) location.reload();});
