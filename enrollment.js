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
    $('repeat-label').hidden = !create;
    form.elements.passwordConfirm.disabled = !create;
    form.elements.passwordConfirm.value = '';
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
    $('edition-next-wrap').hidden = Boolean(member?.joined || member?.free || edition?.isLocked);
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
  const dateLabel = new Intl.DateTimeFormat('pl-PL', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
  const warsawClock = new Intl.DateTimeFormat('en-GB', {hour:'2-digit', hourCycle:'h23', timeZone:'Europe/Warsaw'});
  let countdownTimer;
  function showSchedule(status) {
    clearInterval(countdownTimer);
    const [year, monthNumber] = status.targetMonth.split('-').map(Number);
    const first = Date.UTC(year, monthNumber - 1, 1);
    // At 00:00 UTC Warsaw is one or two hours ahead, depending on the edition.
    const close = first - Number(warsawClock.format(first)) * 3600000;
    const opening = Date.UTC(year, monthNumber - 2, 5);
    $('edition-window').textContent = 'Zapisy od ' + dateLabel.format(opening) + ' do ' + dateLabel.format(first - 86400000) + ', do godz. 23:59 czasu polskiego.';
    $('edition-clock').hidden = false;
    function tick() {
      const minutes = Math.max(0, Math.ceil((close - Date.now()) / 60000));
      if (status.isLocked || !minutes) {
        $('edition-clock-label').textContent = 'Status zapisów';
        $('edition-time-left').textContent = status.isLocked ? 'Zapisy zamknięte' : 'Planowy termin minął';
        clearInterval(countdownTimer);
        return;
      }
      $('edition-clock-label').textContent = 'Do końca zapisów';
      $('edition-time-left').textContent = Math.floor(minutes / 1440) + ' dni · ' + Math.floor(minutes % 1440 / 60) + ' godz. · ' + minutes % 60 + ' min';
    }
    countdownTimer = setInterval(tick, 15000);
    tick();
  }
  function showGoals(users, payers, estimate) {
    const freePlaces = users - payers;
    const start = Math.max(15, Math.floor(users / 5) * 5 - 10);
    const cards = [start, start+5, start+10, start+15].map(goal => {
      const card = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = goal + ' osób';
      const price = document.createElement('b');
      price.textContent = goal > freePlaces ? estimate(goal, goal - freePlaces) : '—';
      const progress = document.createElement('progress');
      progress.max = goal;
      progress.value = Math.min(goal, users);
      progress.setAttribute('aria-label', 'Postęp do celu ' + goal + ' osób');
      const note = document.createElement('small');
      note.textContent = users >= goal ? 'Cel osiągnięty' : 'Do celu: ' + (goal - users);
      card.append(label, price, progress, note);
      return card;
    });
    $('edition-goal-list').replaceChildren(...cards);
    $('edition-goals').hidden = false;
  }
  function updateEstimate(status) {
    const users = status.users;
    const fee = 1000;
    const toolPLN = Number.parseFloat(status.pricePLN);
    const toolUSD = Number.parseFloat(status.priceUSD);
    const accounts = status.isSplitActive ? 2 : 1;
    // The public status expresses the current tool share in USD per paying member.
    const payers = status.payingUsers ?? (users === 0 ? 0 : Math.round(accounts * 287.20 / toolUSD));
    const votes = Number(status.votes);
    const valid = Number.isInteger(users) && users >= 0 && Number.isInteger(payers) && payers >= 0 && payers <= users && Number.isFinite(toolPLN) && toolPLN > 0;
    const unknownPayer = status.payingUsers == null && payers === 1 && users > 0;
    $('edition-current').textContent = valid && payers > 0 && !unknownPayer ? money(Math.round(toolPLN * 100) + fee) : '—';
    $('edition-next').textContent = '—';
    $('edition-goals').hidden = true;
    if (!valid || unknownPayer || !Number.isFinite(votes)) return;
    const accountCost = payers ? toolPLN * payers / accounts : 287.20 * Number(status.rate);
    if (Number.isFinite(accountCost) && accountCost > 0) {
      const estimate = (total, paying) => {
        const count = total >= 45 && votes < Math.ceil(total * .8) ? 2 : 1;
        return money(Math.round(accountCost * count * 100 / paying) + fee);
      };
      $('edition-next').textContent = estimate(users + 1, payers + 1);
      showGoals(users, payers, estimate);
    }
  }
  async function load() {
    retryLoad = false; message.textContent = '';
    edition = await api('group-buy/status');
    $('edition-title').textContent = month(edition.targetMonth);
    $('edition-count').textContent = edition.users;
    updateEstimate(edition);
    showSchedule(edition);
    $('access-date').textContent = month(edition.targetMonth,true);
    await refreshMember();
  }
  async function proceed() {
    const result = await api('enrollment/continue', {edition:edition.targetMonth, due:member.due, free:Boolean(member.free), attempt});
    if (result.url) {
      const dest = new URL(result.url,location.href);
      if (dest.origin !== 'https://checkout.stripe.com' && !(window.enrollmentDemo && dest.origin === location.origin)) throw new Error('Nie udało się otworzyć płatności.');
      location.assign(dest.href);
    } else if (result.joined) {
      member.joined = true;
      await load();
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
    if (mode === 'register' && form.elements.passwordConfirm.value !== form.elements.password.value) {
      message.textContent = 'Hasła się różnią. Wpisz ponownie to samo hasło.';
      form.elements.passwordConfirm.focus();
      return;
    }
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
        await load(); history.replaceState(null,'',location.pathname+'#dolacz');
        if (!member?.joined) message.textContent = 'Wpłata zaksięgowana. Szczegóły znajdziesz w panelu.';
      } else if (params.has('cancelled')) message.textContent = 'Płatność anulowana. Możesz wrócić do zapisu.';
      if (!member && !edition.isLocked) {
        setMode(localStorage.getItem('wingman_user') ? 'login' : 'register');
        form.hidden = false;
      }
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
