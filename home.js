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
  document.querySelectorAll('.join-link').forEach(link => link.addEventListener('click', () => {
    const action = byId('join-start');
    if (action && !action.hidden && !action.disabled) action.click();
  }));
  const pln = amount => amount.toLocaleString('pl-PL',{style:'currency',currency:'PLN'});
  function calculate() {
    const people = Number(byId('people').value);
    const canVote = people >= 45;
    byId('vote-option').hidden = !canVote;
    const accounts = canVote && !byId('one-account').checked ? 2 : 1;
    const rate = 4, fee = 10, deposit = 75;
    const solo = 359 * rate;
    const share = Math.round((287.2 * accounts * rate / people + fee) * 100) / 100;
    byId('people-out').textContent = people + (people % 10 >= 2 && people % 10 <= 4 && !(people % 100 >= 12 && people % 100 <= 14) ? ' osoby' : ' osób');
    byId('calc-mode').textContent = accounts === 2 ? 'W tej symulacji grupa utrzymuje dwa konta Diamond.' : 'W tej symulacji grupa utrzymuje jedno konto Diamond.';
    byId('solo-price').textContent = pln(solo);
    byId('share-price').textContent = pln(share);
    byId('share-bar').style.width = share / solo * 100 + '%';
    byId('saving').textContent = pln(solo - share);
    byId('publishing-budget').textContent = 'W tej symulacji po takim teście pozostałoby ' +
      pln(solo - share - 600) + ' z miesięcznej różnicy, np. na okładkę lub egzemplarze próbne.';
    byId('refund').textContent = share <= deposit ? 'Z depozytu 75 zł do portfela wróciłoby ' + pln(deposit-share) + '.' : 'Przy tej liczbie osób koszt przekracza depozyt 75 zł. Takiej edycji nie można jeszcze rozliczyć.';
  }
  byId('people').addEventListener('input',calculate);
  byId('one-account').addEventListener('change',calculate);
  calculate();
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
