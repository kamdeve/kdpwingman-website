(() => {
  const $ = id => document.getElementById(id);
  const form = $('join-form');
  const start = $('join-start');
  const submit = $('join-submit');
  const message = $('join-message');
  const hosted = ['kdpwingman.com', 'www.kdpwingman.com'].includes(location.hostname);
  const apiOrigin = hosted ? 'https://kdpwingmanv2backend-production.up.railway.app' : '';
  let authenticatedEmail;
  let edition, member, mode = 'register', busy = false, retryLoad = false;
  const panelPath = '/dashboard.html?tab=panel';
  const confirmation = $('joined-status');
  const money = n => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(n / 100);
  const month = (ym, day) => new Intl.DateTimeFormat('pl-PL', day ? {day:'numeric', month:'long',year:'numeric',timeZone:'UTC'} : {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(ym + (day ? '-05' : '-01') + 'T12:00:00Z'));

  async function api(path, body) {
    const response = await fetch(apiOrigin + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {'Content-Type':'application/json'},
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
    submit.textContent = create ? 'Załóż konto i wpłać 75 zł' : 'Zaloguj się i kontynuuj';
    form.querySelectorAll('[data-mode]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.mode === mode)));
  }
  function render() {
    start.hidden = !form.hidden;
    start.disabled = busy;
    submit.disabled = busy;
    confirmation.hidden = !member?.joined;
    $('join-note').hidden = Boolean(member?.joined);
    $('edition-next-wrap').hidden = Boolean(member?.joined || member?.free || edition?.isLocked);
    $('edition-fee-line').hidden = $('edition-next-wrap').hidden;
    if (!member?.credit) $('join-note').textContent = 'Wpłata jednorazowa. Płatność kartą przez Stripe.';
    if (retryLoad) { form.hidden = true; start.hidden = false; start.textContent = 'Spróbuj ponownie'; return; }
    if (!edition) { start.disabled = true; return; }
    if (member?.joined) {
      start.hidden = true; form.hidden = true;
      $('joined-access').textContent = 'Dostęp otrzymasz e-mailem ' + month(edition.targetMonth,true) + '.';
      const mainAction = document.querySelector('a.primary[href="#dolacz"]');
      if (mainAction) { mainAction.href = panelPath; mainAction.textContent = 'Masz miejsce · Mój Panel'; }
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
    const email = localStorage.getItem('wingman_user');
    if (!email) return;
    const data = await api('user/status', {email});
    if (!Number.isFinite(data.wallet_balance) || typeof data.has_joined !== 'boolean' || data.month !== edition.targetMonth)
      throw new Error('Nie udało się potwierdzić danych edycji. Odśwież stronę.');
    const missing = Math.max(0, 7500 - Math.round(data.wallet_balance * 100));
    const free = data.has_free_ticket === true;
    const due = free || !missing ? 0 : Math.max(500, missing);
    member = {email, joined:data.has_joined, free, due, credit:free ? 0 : due - missing};
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
  const dollars = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'USD', currencyDisplay:'code'});
  const accountUSD = 287.20;
  function publishPricing() {
    const rate = Number(edition?.rate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    const rateLabel = 'Kurs systemu zapisów: ' + rate.toLocaleString('pl-PL', {minimumFractionDigits:2, maximumFractionDigits:4}) + ' zł za dolara.';
    const quote = {
      accountUSD, rateLabel,
      shareCents(accounts, payers) { return Math.round(accountUSD * rate * accounts / payers * 100); }
    };
    window.wingmanHeliumQuote = quote;
    window.dispatchEvent(new Event('wingman-pricing'));
    return quote;
  }
  function seatQuote(id, toolCents, toolUSD) {
    const available = Number.isFinite(toolCents) && toolCents > 0 && Number.isFinite(toolUSD) && toolUSD > 0;
    $(id).textContent = available ? money(toolCents) : '—';
    $(id + '-usd').textContent = available ? dollars.format(toolUSD) : '';
  }
  function showGoals(users, payers, estimate) {
    const freePlaces = users - payers;
    const start = Math.max(15, Math.floor(users / 5) * 5 - 10);
    const cards = [start, start+5, start+10, start+15].map(goal => {
      const card = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = goal + ' osób';
      const price = document.createElement('b');
      price.textContent = goal > freePlaces ? money(estimate(goal, goal - freePlaces).cents) : '—';
      const progress = document.createElement('progress');
      progress.className = users >= goal ? 'goal-reached' : 'goal-pending';
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
    const quote = publishPricing();
    const toolUSD = Number.parseFloat(status.priceUSD);
    const accounts = status.isSplitActive ? 2 : 1;
    // The public status expresses the current tool share in USD per paying member.
    const payers = status.payingUsers ?? (users === 0 ? 0 : Math.round(accounts * accountUSD / toolUSD));
    const votes = Number(status.votes);
    const valid = Number.isInteger(users) && users >= 0 && Number.isInteger(payers) && payers >= 0 && payers <= users && Boolean(quote);
    const unknownPayer = status.payingUsers == null && payers === 1 && users > 0;
    const perPayerUSD = payers > 0 ? accountUSD * accounts / payers : 0;
    seatQuote('edition-current', valid && payers > 0 && !unknownPayer ? Math.round(Number(status.pricePLN) * 100) : null, perPayerUSD);
    $('edition-plan-cost').textContent = quote ? 'Jedno konto Diamond po rabacie: 287,20 USD ≈ ' + money(quote.shareCents(1, 1)) + '. ' + quote.rateLabel : 'Plan Diamond po rabacie kosztuje 287,20 USD za konto.';
    $('edition-fee-line').textContent = 'Opłata serwisowa: 10 zł za miejsce.';
    seatQuote('edition-next', null, null);
    $('edition-goals').hidden = true;
    if (!valid || unknownPayer || !Number.isFinite(votes)) return;
    const estimate = (total, paying) => {
      const count = total >= 45 && votes < Math.ceil(total * .8) ? 2 : 1;
      return {cents:quote.shareCents(count, paying), usd:accountUSD * count / paying};
    };
    window.wingmanCinemaStart = {payers:payers + 1};
    window.dispatchEvent(new Event('wingman-cinema-start'));
    const next = estimate(users + 1, payers + 1);
    seatQuote('edition-next', next.cents, next.usd);
    $('edition-fee-line').textContent = 'Z opłatą serwisową 10 zł: ' + money(next.cents + 1000) + ' po Twoim dołączeniu.';
    $('edition-goal-note').textContent = 'Płacące osoby: ' + payers + ' z ' + users + '. Szacunek zakłada, że kolejna osoba wpłaci depozyt.';
    showGoals(users, payers, estimate);
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
    const shown = member;
    if (!shown || shown.email !== localStorage.getItem('wingman_user')) {
      location.reload();
      return;
    }
    if (authenticatedEmail !== shown.email) {
      member = null;
      setMode('login');
      form.hidden = false;
      form.elements.email.value = shown.email;
      form.elements.password.focus();
      return;
    }
    const expectedMonth = edition.targetMonth;
    await load();
    if (edition.isLocked || member?.joined) return;
    if (!member || edition.targetMonth !== expectedMonth || member.due !== shown.due || member.free !== shown.free || member.credit !== shown.credit) {
      message.textContent = 'Dane zapisu zmieniły się. Sprawdź aktualne warunki.';
      return;
    }
    if (member.due > 0) {
      const payment = await api('create-checkout-session', {email:member.email, amount:member.due / 100});
      const dest = new URL(payment.url);
      if (dest.origin !== 'https://checkout.stripe.com') throw new Error('Nie udało się otworzyć płatności.');
      location.assign(dest.href);
      return;
    }
    await api('group-buy/join', {email:member.email});
    await load();
  }
  async function run(task) {
    if (busy) return;
    busy = true; message.textContent = ''; render();
    try { await task(); }
    catch (err) {
      if (err.status === 401 && member) {
        member = null; authenticatedEmail = null; setMode('login'); form.hidden = false;
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
      if (!session.email || !session.token) throw new Error('Nie udało się potwierdzić logowania.');
      authenticatedEmail = session.email;
      localStorage.setItem('wingman_user', session.email);
      window.dispatchEvent(new Event('wingman-session-change'));
      form.elements.password.value = '';
      await refreshMember();
      if (!member) throw new Error('Zaloguj się ponownie.');
      form.hidden = true;
      if (!edition.isLocked && !member.joined && member.due > 0 && !member.credit) await proceed();
    });
  };
  async function initialize() {
    try {
      const params = new URLSearchParams(location.search);
      await load();
      if (params.has('cancelled')) message.textContent = 'Płatność anulowana. Możesz wrócić do zapisu.';
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

