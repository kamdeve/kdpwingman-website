(() => {
  const $ = id => document.getElementById(id);
  const form = $('join-form');
  const start = $('join-start');
  const submit = $('join-submit');
  const message = $('join-message');
  const hosted = ['kdpwingman.com', 'www.kdpwingman.com'].includes(location.hostname);
  const apiOrigin = hosted ? 'https://kdpwingmanv2backend-production.up.railway.app' : '';
  const sessionKey = 'wingman_join_token';
  const attempt = crypto.randomUUID();
  let edition, member, mode = 'register', busy = false, retryLoad = false;
  const money = n => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(n / 100);
  const month = (ym, day) => new Intl.DateTimeFormat('pl-PL', day ? {day:'numeric', month:'long',year:'numeric',timeZone:'UTC'} : {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(ym + (day ? '-05' : '-01') + 'T12:00:00Z'));

  async function api(path, body) {
    if (window.enrollmentDemo) return window.enrollmentDemo(path, body);
    const token = localStorage.getItem(sessionKey);
    const response = await fetch(apiOrigin + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {'Content-Type':'application/json', ...(token && {Authorization:'Bearer ' + token})},
      ...(body !== undefined && {body:JSON.stringify(body)})
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || data.message || 'Nie udało się połączyć. Spróbuj ponownie.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function setMode(value) {
    mode = value;
    const create = mode === 'register';
    $('nick-label').hidden = !create;
    form.elements.nickname.disabled = !create;
    form.elements.password.autocomplete = create ? 'new-password' : 'current-password';
    form.elements.password.minLength = create ? 6 : 1;
    submit.textContent = create ? 'Załóż konto i przejdź do płatności' : 'Zaloguj się i kontynuuj';
    form.querySelectorAll('[data-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.mode === mode)));
  }
  function render() {
    start.hidden = !form.hidden;
    start.disabled = busy;
    submit.disabled = busy;
    $('join-panel').hidden = true;
    if (retryLoad) { start.textContent = 'Spróbuj ponownie'; return; }
    if (!edition) { start.disabled = true; return; }
    if (member?.joined) {
      start.hidden = true; form.hidden = true; $('join-panel').hidden = false;
      message.textContent = 'Masz miejsce w tej edycji. Dane dostępu otrzymasz e-mailem.';
    } else if (edition.isLocked) {
      start.disabled = true; form.hidden = true; start.hidden = false;
      start.textContent = 'Zapisy są teraz zamknięte';
    } else if (member) {
      form.hidden = true; start.hidden = false;
      start.textContent = member.free ? 'Dołącz z darmowym biletem' : member.due ? 'Przejdź do płatności · ' + money(member.due) : 'Dołącz z portfela · 75 zł';
      if (member.credit) $('join-note').textContent = 'Nadwyżka z minimalnej wpłaty pozostanie w portfelu: ' + money(member.credit) + '.';
    } else start.textContent = 'Dołącz do zrzutki';
  }
  async function refreshMember() {
    member = null;
    if (!localStorage.getItem(sessionKey)) return;
    try { member = await api('enrollment/me'); }
    catch (err) {
      if (err.status !== 401) throw err;
      localStorage.removeItem(sessionKey);
    }
  }
  async function load() {
    retryLoad = false; message.textContent = '';
    edition = await api('group-buy/status');
    $('edition-title').textContent = month(edition.targetMonth);
    $('edition-count').textContent = edition.users;
    $('access-date').textContent = month(edition.targetMonth,true);
    await refreshMember();
    try {
      const history = await api('stats/history');
      const rows = history.filter(row => row.month < edition.targetMonth && row.users > 0).slice(0,3);
      $('history-items').replaceChildren(...rows.map(row => {
        const li = document.createElement('li'); li.textContent = month(row.month) + ' · ' + row.users + ' os.'; return li;
      }));
      $('edition-history').hidden = !rows.length;
    } catch { $('edition-history').hidden = true; }
  }
  async function proceed() {
    const result = await api('enrollment/continue', {edition:edition.targetMonth, due:member.due, free:Boolean(member.free), attempt});
    if (result.url) {
      const dest = new URL(result.url,location.href);
      if (dest.origin !== 'https://checkout.stripe.com' && !(window.enrollmentDemo && dest.origin === location.origin)) throw new Error('Nie udało się otworzyć płatności.');
      location.assign(dest.href);
    } else if (result.joined) {
      member.joined = true;
      $('edition-count').textContent = (await api('group-buy/status')).users;
    } else throw new Error('Nie udało się potwierdzić zapisu.');
  }
  async function run(task) {
    if (busy) return;
    busy = true; message.textContent = ''; render();
    try { await task(); }
    catch (err) {
      if (err.status === 401 && member) {
        member = null; localStorage.removeItem(sessionKey); setMode('login'); form.hidden = false;
      }
      message.textContent = err.message || 'Wystąpił błąd. Spróbuj ponownie.';
    } finally { busy = false; render(); }
  }
  form.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => { if (!busy) {setMode(el.dataset.mode); message.textContent = '';} });
  form.onsubmit = e => {
    e.preventDefault();
    run(async () => {
      const email = form.elements.email.value.trim(), password = form.elements.password.value;
      if (mode === 'register') {
        await api('register', {nickname:form.elements.nickname.value.trim(),email,password});
        setMode('login');
      }
      const session = await api('login',{email,password});
      localStorage.setItem(sessionKey,session.token); localStorage.setItem('wingman_user',session.email);
      form.elements.password.value = '';
      await refreshMember();
      if (!member) throw new Error('Zaloguj się ponownie.');
      form.hidden = true;
      if (!member.joined && member.due > 0 && !member.credit) await proceed();
    });
  };
  async function initialize() {
    try {
      await load();
      const params = new URLSearchParams(location.search);
      const session = params.get('enrollment_session');
      if (session) {
        await api('payment-success',{session_id:session});
        await refreshMember(); history.replaceState(null,'',location.pathname+'#dolacz');
        if (!member?.joined) message.textContent = 'Wpłata zaksięgowana. Szczegóły znajdziesz w panelu.';
      } else if (params.has('cancelled')) message.textContent = 'Płatność anulowana. Możesz wrócić do zapisu.';
    } catch (err) { retryLoad = true; throw err; }
  }
  start.onclick = () => run(async () => {
    if (retryLoad) return initialize();
    if (member) return proceed();
    form.hidden = false;
    setMode(localStorage.getItem('wingman_user') ? 'login' : 'register');
    (mode === 'login' ? form.elements.email : form.elements.nickname).focus();
  });
  run(initialize);
})();
