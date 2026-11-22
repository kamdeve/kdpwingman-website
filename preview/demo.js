(() => {
  const box = document.getElementById('demo-case');
  const key = 'wingman_demo_data';
  const get = () => JSON.parse(sessionStorage.getItem(key) || '{}');
  const save = data => sessionStorage.setItem(key,JSON.stringify(data));
  const date = new Date();
  function ym(offset) { return new Date(Date.UTC(date.getFullYear(),date.getMonth()+offset,1,12)).toISOString().slice(0,7); }
  function reset(scenario) {
    localStorage.removeItem('wingman_join_token'); localStorage.removeItem('wingman_user');
    const data = {scenario, joined:scenario==='joined',balance:scenario==='wallet'?7500:scenario==='returning'?2500:0,free:scenario==='ticket'};
    if (['returning','wallet','ticket','joined'].includes(scenario)) {
      localStorage.setItem('wingman_join_token','demo'); localStorage.setItem('wingman_user','test@example.com');
    }
    save(data);
  }
  if (!get().scenario) reset('new');
  if (box) {
    box.value = get().scenario;
    box.onchange = () => { reset(box.value); location.assign('/'); };
    document.getElementById('demo-reset').onclick = () => {reset(box.value);location.assign('/');};
  }
  const fail = (message,status=400) => { const err=new Error(message); err.status=status; throw err; };
  async function fingerprint(password) {
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
    return Array.from(new Uint8Array(digest)).join('-');
  }
  window.enrollmentDemo = async (path, body) => {
    const data=get();
    const due=data.free||data.joined ? 0 : Math.max(0,7500-data.balance);
    switch(path) {
      case 'group-buy/status': return {users:24+(data.joined?1:0),targetMonth:ym(1),isLocked:data.scenario==='closed'};
      case 'stats/history': return [0,-1,-2].map((n,i)=>({month:ym(n),users:[29,32,27][i]}));
      case 'register':
        if (data.registered || body.email==='test@example.com') fail('To konto już istnieje. Wybierz „Mam konto”.');
        data.registered = true; data.email=body.email; data.hash=await fingerprint(body.password); save(data); return {};
      case 'login':
        if (!(data.registered && data.email===body.email && data.hash===await fingerprint(body.password)) && !(body.email==='test@example.com' && body.password==='Wingman75')) fail('Niepoprawne dane logowania.',401);
        return {token:'demo',email:body.email};
      case 'enrollment/me':
        if (localStorage.getItem('wingman_join_token')!=='demo') fail('Zaloguj się ponownie.',401);
        return {joined:data.joined,free:data.free,due,credit:0};
      case 'enrollment/continue':
        if (localStorage.getItem('wingman_join_token')!=='demo') fail('Zaloguj się ponownie.',401);
        if(data.scenario==='closed') fail('Zapisy zamknięte.');
        if (!due) {data.joined=true;save(data);return {joined:true};}
        data.pending=due;save(data);return {url:'/checkout'};
      case 'payment-success':
        if(!data.paid || body.session_id!=='demo') fail('Brak potwierdzenia płatności.');
        data.joined=true;save(data);return {success:true};
      default: fail('Nieznany ekran podglądu.');
    }
  };
  const pay = document.getElementById('demo-pay');
  if (pay) {
    const data=get();
    if (!data.pending) location.replace('/');
    else {
      document.getElementById('demo-amount').textContent=(data.pending/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
      pay.onclick=()=>{data.paid=true;data.pending=0;save(data);location.assign('/?enrollment_session=demo#dolacz');};
    }
  }
})();
