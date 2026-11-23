(async () => {
  const byId = id => document.getElementById(id);
  const money = n => Number(n).toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
  const state = byId('panel-state');
  function row(id, cells) {
    const tr = document.createElement('tr');
    for (const value of cells) {
      const td = tr.insertCell();
      td.textContent = value;
      td.style.padding = '0.65rem';
    }
    byId(id).append(tr);
  }
  try {
    const token = localStorage.getItem('wingman_join_token');
    if (!token) throw new Error('Zaloguj się na stronie zapisów, aby zobaczyć swój panel.');
    const response = await fetch('/api/enrollment/panel',{headers:{Authorization:'Bearer '+token}});
    if (!response.ok) throw new Error(response.status === 401 ? 'Zaloguj się ponownie na stronie zapisów.' : 'Nie udało się pobrać statusu miejsca. Odśwież stronę.');
    const data = await response.json();
    const date = new Date(data.edition+'-05T12:00:00Z');
    const month = date.toLocaleDateString('pl-PL',{month:'long',year:'numeric',timeZone:'UTC'});
    byId('current-month-label').textContent = 'Edycja · '+month;
    const badge = byId('status-badge');
    badge.textContent = data.joined ? 'UCZESTNICZYSZ' : 'NIE DOŁĄCZYŁEŚ';
    badge.className = 'status-badge '+(data.joined ? 'status-active' : 'status-wait');
    if (data.joined) {
      const info = byId('access-info');
      info.classList.remove('hidden');
      info.textContent = 'Masz miejsce w tej edycji. Wysyłka dostępu e-mailem '+date.toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})+'.';
    } else {
      const join = document.createElement('a'); join.href='/#dolacz'; join.textContent='Zarezerwuj miejsce';
      byId('join-btn-container').append(join);
    }
    byId('balance').textContent = money(data.wallet_balance);
    const stamps = Number(data.loyalty_stamps)||0;
    byId('stamps-counter').textContent = stamps+' / 6';
    for (let i=1;i<=6;i++) {
      const slot = document.createElement('span'); slot.className='stamp-slot'+(i<=stamps?' active':''); slot.textContent=i<=stamps?'✓':String(i);
      byId('kebab-stamps').append(slot);
    }
    byId('history-list').replaceChildren();
    for (const entry of data.history) row('history-list',[entry.month_target,money(entry.amount_paid)]);
    if (!data.history.length) row('history-list',['Brak zapisanych edycji.']);
    byId('wallet-history-body').replaceChildren();
    for (const entry of data.transactions) row('wallet-history-body',[new Date(entry.created_at).toLocaleDateString('pl-PL'),money(entry.amount),entry.description,money(entry.balance_after)]);
    if (!data.transactions.length) row('wallet-history-body',['Brak transakcji.']);
    state.hidden = true;
    byId('panel-cards').hidden = false;
  } catch (error) { state.textContent = error.message; }
})();