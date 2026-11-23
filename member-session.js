(() => {
  const tokenKey = 'wingman_join_token';
  const userKey = 'wingman_user';
  const buttons = document.querySelectorAll('[data-member-logout]');
  const accountLink = document.querySelector('.mast .login-link');
  let displayedToken;
  function update() {
    displayedToken = localStorage.getItem(tokenKey);
    for (const button of buttons) button.hidden = !displayedToken;
    if (accountLink) {
      accountLink.textContent = displayedToken ? 'Mój Panel' : 'Zaloguj się';
      accountLink.href = displayedToken ? '/dashboard.html?tab=panel' : 'dashboard.html';
    }
  }
  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    history.replaceState(null, '', '/#dolacz');
    location.reload();
  }
  for (const button of buttons) button.addEventListener('click', logout);
  window.addEventListener('storage', event => {
    if ((event.key === tokenKey || event.key === null) && displayedToken !== localStorage.getItem(tokenKey)) location.reload();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && displayedToken !== localStorage.getItem(tokenKey)) location.reload();
  });
  window.addEventListener('wingman-session-change', update);
  update();
})();