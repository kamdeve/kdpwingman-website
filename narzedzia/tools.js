(async () => {
  'use strict';
  const links = [...document.querySelectorAll('.desktop a')];
  const choice = document.querySelector('#choice');
  const slot = document.querySelector('#form-slot');
  const title = document.querySelector('#active-title');
  const scripts = new Map();
  const views = new Map();
  const prerequisites = {
    qr: ['qrcode-generator-1.4.4.js']
  };
  let current;
  let royaltyVolume;
  document.addEventListener('wingman:royalty-volume', event => { royaltyVolume = event.detail; });
  function mount(id, view) {
    slot.replaceChildren(view);
    if (id !== 'royalty' || !royaltyVolume) return;
    const fields = view.querySelector('form').elements;
    fields.format.value = 'soft';
    fields.format.dispatchEvent(new Event('input', {bubbles:true}));
    fields.market.value = royaltyVolume.market;
    fields.sold.value = royaltyVolume.sold;
    fields.market.dispatchEvent(new Event('input', {bubbles:true}));
    fields.market.form.requestSubmit();
    royaltyVolume = null;
  }
  for (const link of links) choice.add(new Option(link.textContent, link.hash));
  choice.addEventListener('change', () => { location.hash = choice.value; });
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#workspace').focus();
  });
  async function appendScript(file) {
    const protectedFile = file !== 'qrcode-generator-1.4.4.js';
    const src = protectedFile ? URL.createObjectURL(await (await WingmanToolAccess.fetchFile(file)).blob()) : file;
    const script = document.createElement('script');
    try {
      await new Promise((resolve, reject) => {
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(file));
        document.head.append(script);
      });
    } finally {
      script.remove();
      if (protectedFile) URL.revokeObjectURL(src);
    }
  }
  function loadScript(file) {
    if (!scripts.has(file)) scripts.set(file, appendScript(file).catch(error => {
      scripts.delete(file);
      throw error;
    }));
    return scripts.get(file);
  }
  async function show() {
    const active = links.find(link => link.hash === location.hash) || links[0];
    const id = active.hash.slice(1);
    current = id;
    for (const link of links) {
      if (link === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    choice.value = active.hash;
    title.textContent = active.textContent;
    document.title = active.textContent + ' · Wingman';
    if (views.has(id)) { mount(id, views.get(id)); return; }
    slot.textContent = 'Wczytywanie narzędzia…';
    try {
      for (const file of [...(prerequisites[id] || []), id + '.js']) await loadScript(file);
      if (current !== id) return;
      if (!views.has(id)) {
        const view = document.createElement('div');
        view.className = 'tool-form ' + id;
        slot.replaceChildren(view);
        window.WingmanTools[id](view);
        views.set(id, view);
      }
      mount(id, views.get(id));
    } catch (err) {
      if (current !== id) return;
      slot.textContent = 'Nie udało się wczytać narzędzia. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Spróbuj ponownie';
      retry.onclick = show;
      slot.append(retry);
    }
  }
  await WingmanToolAccess.ready;
  window.addEventListener('hashchange', show);
  show();
})();
