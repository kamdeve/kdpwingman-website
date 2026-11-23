(() => {
  const key = 'wingman_user';
  const link = document.querySelector('.mast .login-link');
  const logout = document.querySelector('[data-member-logout]');
  let displayed;
  function update() {
    displayed = localStorage.getItem(key);
    link.textContent = displayed ? 'Mój Panel' : 'Zaloguj się';
    link.href = displayed ? '/dashboard.html?tab=panel' : '/dashboard.html';
    logout.hidden = !displayed;
  }
  logout.onclick = () => {
    WingmanPuls.clear();
    localStorage.removeItem(key);
    history.replaceState(null, '', '/#dolacz');
    location.reload();
  };
  function sync() {
    if (displayed !== localStorage.getItem(key)) location.reload();
  }
  window.addEventListener('storage', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('wingman-session-change', update);
  update();
})();

