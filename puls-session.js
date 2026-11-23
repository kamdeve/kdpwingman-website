(() => {
  'use strict';
  const api = 'https://kdpwingmanv2backend-production.up.railway.app/api/puls/';
  const storageKey = 'wingman_puls_session';
  let confirmed = null;

  function token() {
    try {
      const session = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      return session && session.email === localStorage.getItem('wingman_user') ? session.token : null;
    } catch { return null; }
  }

  function show(value) {
    confirmed = value;
    const button = document.getElementById('admin-add-post-btn');
    if (button) button.hidden = !value;
    if (!value) {
      const modal = document.getElementById('admin-post-modal');
      if (modal) modal.style.display = 'none';
    }
    window.dispatchEvent(new Event('wingman-puls-permissions'));
  }

  function clear() {
    sessionStorage.removeItem(storageKey);
    show(null);
  }

  async function verify() {
    const current = token();
    if (!current) return clear();
    if (!document.getElementById('admin-add-post-btn')) return;
    try {
      const res = await fetch(api + 'permissions', {
        headers: { Authorization: 'Bearer ' + current }, cache: 'no-store'
      });
      const allowed = res.ok && (await res.json()).canManagePuls === true;
      if (current !== token()) return;
      if (res.status === 401 || res.status === 403) return clear();
      show(allowed ? current : null);
    } catch { if (current === token()) show(null); }
  }

  function signedIn(session) {
    clear();
    if (session.canManagePuls === true && session.token) {
      sessionStorage.setItem(storageKey, JSON.stringify({ email: session.email, token: session.token }));
      verify();
    }
  }

  function allowed() { return Boolean(confirmed && confirmed === token()); }

  async function write(path, method, body) {
    const current = token();
    if (!allowed()) throw new Error('Zaloguj się ponownie na konto właściciela.');
    const res = await fetch(api + path, {
      method,
      headers: { Authorization: 'Bearer ' + current, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 || res.status === 403) {
      if (current === token()) clear();
      throw new Error('Zaloguj się ponownie na konto właściciela.');
    }
    if (!res.ok) throw new Error('Nie udało się zapisać zmiany. Spróbuj ponownie.');
  }

  window.WingmanPuls = {
    signedIn, clear, allowed,
    add: data => write('post', 'POST', data),
    remove: id => write('post/' + encodeURIComponent(id), 'DELETE')
  };
  window.addEventListener('storage', event => {
    if (event.key === 'wingman_user' || event.key === null) clear();
  });
  window.addEventListener('pageshow', verify);
})();
