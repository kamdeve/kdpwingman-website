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
  byId('watch-intro').addEventListener('click', () => {
    film.focus();
    play.click();
  });
  film.addEventListener('ended', () => { play.hidden = false; });
  document.querySelectorAll('.join-link').forEach(link => link.addEventListener('click', () => {
    const action = byId('join-start');
    if (action && !action.hidden && !action.disabled) action.click();
  }));
  readPublic('stats/total-users').then(data => {
    if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error();
    byId('registered-total').textContent = data.total.toLocaleString('pl-PL');
  }).catch(() => { byId('registered-total').textContent = 'Brak danych'; });
  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text; return node;
  }
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
      if (localStorage.getItem('admin_secret')) {
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
  const viewport = dialog.querySelector('.research-scroll');
  panels.forEach(panel => {
    const frame = panel.querySelector('.research-frame');
    const expand = frame.querySelector('.research-expand');
    expand.hidden = false;
    expand.addEventListener('click', () => {
      dialog.querySelector('strong').textContent = frame.querySelector('.research-caption').textContent;
      const detail = frame.cloneNode(true);
      detail.querySelector('.research-expand').remove();
      detail.querySelector('.research-caption').remove();
      viewport.replaceChildren(detail);
      dialog.showModal();
      close.focus();
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
