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
    const token = credential();
    if (!token) return promptLogin('Zaloguj się na konto Wingmana, aby otworzyć wybrane narzędzie.');
    try {
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
      if (!session.toolsToken) throw Error();
      localStorage.setItem('wingman_user', session.email);
      WingmanPuls.signedIn(session);
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
