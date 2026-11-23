(() => {
  'use strict';
  const api = 'https://kdpwingmanv2backend-production.up.railway.app/api/';
  const key = 'wingman_tools_session';
  const access = document.querySelector('#access');
  const layout = document.querySelector('.layout');
  const form = document.querySelector('#access-login');
  const status = document.querySelector('#access-status');
  const retry = document.querySelector('#access-retry');
  let activeToken;
  let start;
  const ready = new Promise(resolve => { start = resolve; });

  function credential() {
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      return entry && entry.email === localStorage.getItem('wingman_user') ? entry.token : null;
    } catch { return null; }
  }
  function previousLogin() {
    try {
      const entry = JSON.parse(sessionStorage.getItem('wingman_puls_session'));
      return entry && entry.email === localStorage.getItem('wingman_user') ? entry.token : null;
    } catch { return null; }
  }
  function remember(session) {
    localStorage.setItem(key, JSON.stringify({ email: session.email, token: session.toolsToken }));
  }
  async function exchange(token, email) {
    const response = await fetch(api + 'member-tools/from-login', {
      method: 'POST', headers: {Authorization: 'Bearer ' + token}, cache: 'no-store', credentials: 'omit'
    });
    if (!response.ok) throw Object.assign(new Error(), {status: response.status});
    const session = await response.json();
    if (session.email !== email || !session.toolsToken) throw Object.assign(new Error(), {status: 401});
    return session;
  }
  function promptLogin(message) {
    form.hidden = false;
    retry.hidden = true;
    form.elements.email.value ||= localStorage.getItem('wingman_user') || '';
    status.textContent = message;
  }
  function networkError() {
    status.textContent = 'Nie udało się połączyć z Wingmanem.';
    retry.hidden = false;
  }
  async function fetchFile(name) {
    const token = credential();
    const response = await fetch(api + 'member-tools/' + name, {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', credentials: 'omit'
    });
    if (response.status === 401) {
      if (token === credential()) localStorage.removeItem(key);
      if (activeToken) location.reload();
    }
    if (!response.ok) throw Object.assign(new Error('Brak dostępu'), { status: response.status });
    return response;
  }
  async function check() {
    retry.hidden = true;
    try {
      let token = credential();
      if (!token && previousLogin()) {
        const email = localStorage.getItem('wingman_user');
        const session = await exchange(previousLogin(), email);
        if (email !== localStorage.getItem('wingman_user')) return location.reload();
        remember(session);
        token = session.toolsToken;
      }
      if (!token) return promptLogin(localStorage.getItem('wingman_user')
        ? 'Potwierdź hasło do swojego konta, aby otworzyć narzędzia.'
        : 'Zaloguj się na konto Wingmana, aby otworzyć wybrane narzędzie.');
      const { expiresAt } = await (await fetchFile('session')).json();
      if (token !== credential()) return location.reload();
      activeToken = token;
      access.hidden = true;
      layout.hidden = false;
      setTimeout(() => location.reload(), Math.max(0, expiresAt - Date.now()));
      start();
    } catch (e) {
      if (e.status === 401) promptLogin('Zaloguj się ponownie, aby skorzystać z narzędzi.');
      else networkError();
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    try {
      const response = await fetch(api + 'login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email: form.elements.email.value.trim(), password: form.elements.password.value})
      });
      if (response.status === 401) return promptLogin('Sprawdź adres e-mail i hasło.');
      if (!response.ok) throw Error();
      const session = await response.json();
      const toolsSession = session.toolsToken ? session : await exchange(session.token, session.email);
      localStorage.setItem('wingman_user', session.email);
      remember(toolsSession);
      try { window.WingmanPuls?.signedIn?.({...session, toolsToken: toolsSession.toolsToken}); }
      catch { /* Sesja narzędzi działa również bez sesji redaktora Pulsu. */ }
      form.elements.password.value = '';
      await check();
    } catch { networkError(); }
    finally { submit.disabled = false; }
  });
  retry.onclick = check;
  function synchronize() {
    if (activeToken && credential() !== activeToken) location.reload();
  }
  window.addEventListener('storage', event => {
    if (!event.key || event.key === key || event.key === 'wingman_user') {
      if (activeToken) synchronize();
      else if (credential()) location.reload();
    }
  });
  window.addEventListener('pageshow', synchronize);
  window.WingmanToolAccess = { ready, fetchFile };
  check();
})();
