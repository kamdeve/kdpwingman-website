(async () => {
  const status = document.getElementById('membership');
  const token = localStorage.getItem('wingman_join_token');
  if (!token) { location.replace('/#dolacz'); return; }
  try {
    const response = await fetch('/api/enrollment/me', {headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if (response.status === 401) { localStorage.removeItem('wingman_join_token'); location.replace('/#dolacz'); return; }
    if (!response.ok) throw new Error();
    const member = await response.json();
    const edition = new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(member.edition+'-05T12:00:00Z'));
    document.getElementById('member-email').textContent = localStorage.getItem('wingman_user') || '';
    status.textContent = member.joined ? 'Masz opłacone miejsce w edycji '+edition+'.' : 'Twoje konto jest aktywne. Możesz zarezerwować miejsce w edycji '+edition+'.';
  } catch { status.textContent = 'Nie udało się wczytać statusu miejsca. Odśwież stronę.'; }
})();