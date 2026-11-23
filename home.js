(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const preview = document.documentElement.dataset.preview === 'true';
  const publicApi = preview ? '/public-data/' : 'https://kdpwingmanv2backend-production.up.railway.app/api/';
  async function readPublic(path) {
    const response = await fetch(publicApi + path, {credentials:'omit', signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Brak danych');
    return response.json();
  }
  const film = byId('intro-film');
  const play = byId('film-play');
  play.hidden = false;
  play.onclick = async () => {
    play.hidden = true;
    try { await film.play(); } catch { film.controls = true; }
  };
  film.addEventListener('ended', () => { play.hidden = false; });
  readPublic('stats/total-users').then(data => {
    if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error();
    byId('registered-total').textContent = data.total.toLocaleString('pl-PL');
  }).catch(() => { byId('registered-total').textContent = 'Brak danych'; });
  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text; return node;
  }
  // Historical editions and corrections from the community dashboard override database rows.
  const manualEditions = [
    {month:'2026-04', users:16, price:20.49},
    {month:'2026-03', users:19, price:17.26},
    {month:'2026-01', users:26, price:16.04},
    {month:'2025-12', users:24, price:15.44},
    {month:'2025-11', users:26, price:11.21},
    {month:'2025-10', users:29, price:10.80},
    {month:'2025-09', users:22, price:12.66},
    {month:'2025-08', users:23, price:13.17},
    {month:'2025-07', users:26, price:11.59},
    {month:'2025-06', users:28, price:11.98},
    {month:'2025-05', users:27, price:11.58},
    {month:'2025-04', users:21, price:14.72},
    {month:'2025-03', users:14, price:22.48},
    {month:'2025-02', users:15, price:21.51},
    {month:'2025-01', users:20, price:17.23}
  ];
  const wholePLN = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN', maximumFractionDigits:0, minimumFractionDigits:0, useGrouping:true});
  const monthName = new Intl.DateTimeFormat('pl-PL', {month:'long', year:'numeric', timeZone:'UTC'});
  function archiveCard(row) {
    const card = document.createElement('li');
    const label = element('time', monthName.format(new Date(row.month + '-01T00:00:00Z')));
    label.dateTime = row.month;
    if (!row.diamond) label.className = 'platinum';
    const details = document.createElement('dl');
    for (const [name, value] of [
      ['Plan samodzielny', row.retail.toLocaleString('pl-PL',{style:'currency',currency:'USD'})],
      ['Uczestnicy', String(row.users)],
      ['Cena zrzutkowa', row.price.toLocaleString('pl-PL',{style:'currency',currency:'PLN'})]
    ]) {
      const pair = document.createElement('div');
      pair.append(element('dt', name), element('dd', value));
      details.append(pair);
    }
    card.append(label, element('h4', 'Helium 10 ' + (row.diamond ? 'Diamond' : 'Platinum')), details);
    return card;
  }
  async function loadArchive() {
    const live = await readPublic('stats/history');
    if (!Array.isArray(live) || !live.length) throw new Error('Brak historii');
    const months = new Map();
    for (const row of [...live, ...manualEditions]) {
      const users = Number(row.users), price = Number(row.price);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !Number.isSafeInteger(users) || users <= 0 || row.price == null || !Number.isFinite(price) || price < 0) throw new Error('Błędne dane edycji');
      const diamond = row.month >= '2026-05';
      const retail = diamond ? 287.20 : row.month >= '2026-01' ? 90.30 : 79.20;
      months.set(row.month, {month:row.month, users, price, retail, diamond, saving:retail * 3.95 - price - 10});
    }
    const rows = [...months.values()].sort((a,b) => b.month.localeCompare(a.month));
    const total = rows.reduce((sum,row) => sum + row.saving * row.users, 0);
    const accesses = rows.reduce((sum,row) => sum + row.users, 0);
    byId('archive-total').textContent = '≈ ' + wholePLN.format(total);
    byId('archive-accesses').textContent = 'Łączna liczba dostępów: ' + accesses.toLocaleString('pl-PL');
    byId('archive-latest').textContent = '≈ ' + wholePLN.format(rows[0].saving);
    byId('archive-loyal').textContent = '≈ ' + wholePLN.format(rows.reduce((sum,row) => sum + row.saving, 0));
    byId('archive-first').replaceChildren(...rows.slice(0,3).map(archiveCard));
    byId('archive-older').replaceChildren(...rows.slice(3).map(archiveCard));
    byId('archive-older-count').textContent = String(Math.max(0,rows.length - 3));
    byId('archive-more').hidden = rows.length <= 3;
    byId('archive-status').hidden = true;
    byId('archive-content').hidden = false;
  }
  loadArchive().catch(() => {
    byId('archive-status').textContent = 'Nie udało się wczytać historii zrzutek. ';
    const retry = element('button','Spróbuj ponownie');
    retry.type = 'button';
    retry.onclick = () => location.reload();
    byId('archive-status').append(retry);
  });
  let posts = [], shown = 3;
  function newsItem(post) {
    const card = element('article',''); card.className = 'entry';
    if (/^https:\/\/|^data:image\/(png|jpeg|webp|gif);base64,/i.test(post.image_url || '')) {
      const image = document.createElement('img'); image.alt=''; image.loading='lazy'; image.src=post.image_url; card.append(image);
    }
    const date = new Date(post.created_at);
    if (Number.isFinite(date.getTime())) {
      const time = element('time',date.toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'})); time.dateTime = date.toISOString(); card.append(time);
    }
    const body = String(post.content || '');
    const text = element('p',body.length > 220 ? body.slice(0,220)+'…' : body);
    card.append(element('h3',post.title),text);
    if (body.length > 220) {
      const more = element('button','Czytaj dalej'); more.type='button';
      more.onclick=()=>{const open=more.getAttribute('aria-expanded')==='true';text.textContent=open?body.slice(0,220)+'…':body;more.textContent=open?'Czytaj dalej':'Zwiń';more.setAttribute('aria-expanded',String(!open));};
      more.setAttribute('aria-expanded','false');card.append(more);
    }
    if (!preview && Number.isSafeInteger(post.id)) {
      const like=element('button','Polub · ');const count=element('span',String(post.likes||0));count.id='like-count-'+post.id;
      like.id='like-btn-'+post.id;like.append(count);like.onclick=()=>window.likePulsPost(post.id);card.append(like);
      if (window.WingmanPuls.allowed()) {
        const remove=element('button','Usuń wpis');remove.onclick=()=>window.deletePulsPost(post.id);card.append(remove);
      }
    }
    return card;
  }
  function renderNews() {
    const feed=byId('news-feed');feed.replaceChildren(...posts.slice(0,shown).map(newsItem));
    if(!posts.length) feed.append(element('p','Nowe wiadomości od organizatora pojawią się tutaj.'));
    byId('more-news').hidden=shown>=posts.length;
  }
  window.addEventListener('wingman-puls-permissions', () => { if (posts.length) renderNews(); });
  window.loadPulsPosts = async () => {
    try { posts=await readPublic('puls/posts');if(!Array.isArray(posts)) throw new Error();renderNews(); }
    catch { const retry=element('button','Spróbuj ponownie');retry.onclick=window.loadPulsPosts;byId('news-feed').replaceChildren(element('p','Nie udało się pobrać aktualności.'),retry); }
  };
  byId('more-news').onclick = () => {shown+=3;renderNews();};
  window.loadPulsPosts();
})();

(() => {
  const study = document.querySelector('.research');
  if (!study) return;
  const tablist = study.querySelector('.research-tabs');
  const tabs = [...tablist.querySelectorAll('[role=tab]')];
  const panels = [...study.querySelectorAll('.research-step')];
  const pager = study.querySelector('.research-pager');
  const back = pager.querySelector('[data-back]');
  const forward = pager.querySelector('[data-forward]');
  let active = 0;

  function selectStep(index, focusTab = false) {
    active = index;
    tabs.forEach((tab, n) => {
      const current = n === index;
      tab.tabIndex = current ? 0 : -1;
      tab.setAttribute('aria-selected', String(current));
      panels[n].hidden = !current;
    });
    back.disabled = index === 0;
    forward.textContent = index === tabs.length - 1 ? 'Od początku ↺' : 'Dalej →';
    if (focusTab) tabs[index].focus();
  }

  tabs.forEach((tab, n) => {
    panels[n].setAttribute('role', 'tabpanel');
    panels[n].setAttribute('aria-labelledby', tab.id);
    panels[n].tabIndex = 0;
    tab.addEventListener('click', () => selectStep(n));
    tab.addEventListener('keydown', event => {
      const count = tabs.length;
      const target = {ArrowLeft:(n + count - 1) % count, ArrowRight:(n + 1) % count, Home:0, End:count - 1}[event.key];
      if (target === undefined) return;
      event.preventDefault();
      selectStep(target, true);
    });
  });
  back.addEventListener('click', () => selectStep(Math.max(0, active - 1), true));
  forward.addEventListener('click', () => selectStep((active + 1) % tabs.length, true));
  selectStep(0);
  tablist.hidden = false;
  pager.hidden = false;
  study.classList.add('research-ready');

  const dialog = study.querySelector('dialog');
  if (typeof dialog.showModal !== 'function') return;
  const close = dialog.querySelector('[data-close]');
  const zoom = dialog.querySelector('[data-zoom]');
  const viewport = dialog.querySelector('.research-scroll');
  const photo = viewport.querySelector('img');
  const gallery = viewport.querySelector('.research-shelf-detail');
  function setZoom(enabled) {
    viewport.classList.toggle('is-actual', enabled);
    zoom.setAttribute('aria-pressed', String(enabled));
    zoom.textContent = enabled ? 'Dopasuj' : 'Widok 1:1';
  }
  panels.forEach(panel => {
    const frame = panel.querySelector('.research-frame');
    const source = frame.querySelector('img');
    const row = frame.querySelector('.research-book-row');
    if (row) frame.querySelector('.shelf-expand').hidden = false;
    frame.querySelectorAll('.research-expand, .research-crop').forEach(link => link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      dialog.querySelector('strong').textContent = frame.querySelector('.research-caption').textContent;
      gallery.hidden = !row;
      photo.hidden = Boolean(row);
      if (row) {
        gallery.replaceChildren(row.cloneNode(true));
      } else {
        photo.src = source.currentSrc || source.src;
        photo.alt = source.alt;
      }
      setZoom(false);
      dialog.showModal();
      viewport.scrollTo(0, 0);
      close.focus();
    }));
  });
  zoom.addEventListener('click', () => setZoom(zoom.getAttribute('aria-pressed') === 'false'));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
