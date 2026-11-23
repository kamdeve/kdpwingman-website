(() => {
  const params = new URLSearchParams(location.search);
  if (!document.documentElement.dataset.enrollment && !params.has('enrollment_session')) return;
  const token = localStorage.getItem('wingman_join_token');
  const session = params.get('enrollment_session');
  const status = document.getElementById('receipt-state');
  const detail = document.getElementById('receipt-detail');
  const retry = document.getElementById('receipt-retry');
  retry.onclick = () => location.reload();
  const panel = '/dashboard.html?tab=panel';
  const hosted = ['kdpwingman.com','www.kdpwingman.com'].includes(location.hostname);
  const api = hosted ? 'https://kdpwingmanv2backend-production.up.railway.app/api/' : '/api/';
  async function confirm() {
    if (!session || !token) {
      status.querySelector('h1').textContent = session ? 'Zaloguj się, aby sprawdzić miejsce' : 'Sprawdź status swojej rezerwacji';
      detail.textContent = 'Na stronie zapisów użyj konta przypisanego do wpłaty.';
      return;
    }
    try {
      const res = await fetch(api+'enrollment/receipt',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({session_id:session})});
      const data = await res.json();
      if (!res.ok || !data.success || !data.joined) throw new Error(data.error || 'Nie udało się jeszcze potwierdzić rezerwacji.');
      const month = new Intl.DateTimeFormat('pl-PL', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(data.edition+'-01T12:00:00Z'));
      document.getElementById('receipt-edition').textContent = 'Twój depozyt został zaksięgowany. Twoja edycja to ' + month + '.';
      document.getElementById('user-num').textContent = data.position ? '#' + data.position : '✓';
      document.getElementById('new-price-usd').textContent = '—';
      document.getElementById('new-price-pln').textContent = '';
      document.documentElement.dataset.enrollment = 'confirmed';
      document.getElementById('receipt-next').textContent = 'Za 12 sekund otworzy się Mój Panel.';
      setTimeout(() => location.replace(panel),12000);
      const stats = await fetch(api+'group-buy/status').then(r=>r.ok ? r.json() : null).catch(()=>null);
      if (stats?.targetMonth !== data.edition || !(stats.priceUSD > 0)) return;
      const currency = (n,code) => n.toLocaleString('pl-PL',{style:'currency',currency:code});
      document.getElementById('new-price-usd').textContent = currency(Number(stats.priceUSD),'USD');
      const rates = await fetch(hosted ? 'https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json' : '/public-data/nbp-usd').then(r=>r.json()).catch(()=>null);
      const rate = rates?.rates?.[0]?.mid;
      if (rate > 0) document.getElementById('new-price-pln').textContent = 'ok. ' + currency(stats.priceUSD*rate,'PLN');
    } catch(error) {
      status.querySelector('h1').textContent = 'Sprawdzamy status rezerwacji';
      detail.textContent = error.message;
      retry.hidden = false;
    }
  }
  confirm();
})();