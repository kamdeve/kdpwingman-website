const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const home = read('index.html');
const controls = `<aside class="preview-tools"><b>Podgląd DEV</b><span>Zapisy i płatność są symulowane.</span><details><summary>Scenariusze testowe</summary><label>Scenariusz <select id="demo-case"><option value="new">Nowa osoba</option><option value="returning">Zalogowany · 25 zł w portfelu</option><option value="wallet">Pełny depozyt w portfelu</option><option value="ticket">Darmowy bilet</option><option value="joined">Już zapisany</option><option value="closed">Zapisy zamknięte</option></select></label> <button id="demo-reset">Zacznij od nowa</button><p>Konto przykładowe: test@example.com · Wingman75. Do rejestracji użyj fikcyjnych danych.</p></details></aside>`;
const head = '<!doctype html><html lang="pl" data-preview="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Wingman — wspólny dostęp do Helium 10 Diamond</title><link rel="icon" href="/images/wingman-cherry.png"><link rel="stylesheet" href="/enrollment.css"><link rel="stylesheet" href="/home.css"></head><body>';
const header = home.match(/<header class="mast">[^]*?<\/header>/)[0];
const simple = body => head+header+body+'<script src="/demo.js"></script></body></html>';
const landing = home.slice(home.indexOf('<header class="mast">'),home.indexOf('</footer>')+'</footer>'.length)
  .replace('href="group-buy.html"','href="#how-it-works"')
  .replace('href="terms.html"','href="https://kdpwingman.com/terms.html"')
  .replace('href="privacy.html"','href="https://kdpwingman.com/privacy.html"');
module.exports = {
  '/':head+controls+landing+'<script src="/demo.js"></script><script src="/enrollment.js"></script><script src="/home.js"></script></body></html>',
  '/checkout':simple('<main class="screen"><p>Podgląd DEV · symulacja</p><h1>Płatność za zrzutkę</h1><p>Depozyt do wpłaty: <strong id="demo-amount"></strong></p><button class="primary" id="demo-pay">Potwierdź wpłatę testową</button><p><a href="/?cancelled=1#dolacz">Anuluj i wróć</a></p></main>'),
  '/dashboard.html':simple('<main class="screen"><h1>Panel uczestnika</h1><p>To koniec demonstracji zapisu. Konta i płatności w tym podglądzie są przykładowe.</p><a href="/">Wróć na stronę Wingman</a></main>'),
  '/home.css':read('home.css'), '/enrollment.css':read('enrollment.css'), '/home.js':read('home.js'),
  '/demo.js':read('preview/demo.js'), '/enrollment.js':read('enrollment.js'),
  '/images/wingman-cherry.png':fs.readFileSync(path.join(root,'images/wingman-cherry.png')).toString('base64'),
  '/images/wingman-film.webp':fs.readFileSync(path.join(root,'images/wingman-film.webp')).toString('base64')
};
