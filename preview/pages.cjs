const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const home = read('index.html');
const controls = '<aside class="preview-tools"><b>Wingman DEV</b><span>Zapisy testowe. W Stripe użyj karty testowej.</span></aside>';
const head = '<!doctype html><html lang="pl" data-preview="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Wingman — wspólny dostęp do Helium 10 Diamond</title><link rel="icon" href="/images/wingman-wing.png"><link rel="stylesheet" href="/enrollment.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&amp;family=Faustina:ital,wght@1,500;1,600&amp;family=Geist:wght@400;500;600;700&amp;display=swap"><link rel="stylesheet" href="/home.css"><link rel="stylesheet" href="/cinema.css"></head><body>';
const landing = home.slice(home.indexOf('<header class="mast">'),home.indexOf('</footer>')+'</footer>'.length)
  .replace('href="group-buy.html"','href="#how-it-works"')
  .replace('href="terms.html"','href="https://kdpwingman.com/terms.html"')
  .replace('href="privacy.html"','href="https://kdpwingman.com/privacy.html"');
module.exports = {
  '/':head+controls+landing+'<script src="/enrollment.js"></script><script src="/home.js"></script><script src="/cinema.js"></script></body></html>',
  ...require('./confirmation-pages.cjs')(read('success.html'),read('dashboard.html')),
  '/enrollment-success.css':read('enrollment-success.css'), '/enrollment-success.js':read('enrollment-success.js'),
  '/cinema.css':read('cinema.css'), '/cinema.js':read('cinema.js'),
  '/home.css':read('home.css'), '/enrollment.css':read('enrollment.css'), '/home.js':read('home.js'),
  '/panel-dev.js':read('preview/panel-dev.js'), '/enrollment.js':read('enrollment.js'),
  '/images/wingman-wing.png':fs.readFileSync(path.join(root,'images/wingman-wing.png')).toString('base64'),
  '/images/edition-steps.webp':fs.readFileSync(path.join(root,'images/edition-steps.webp')).toString('base64'),
  '/images/wingman-film.webp':fs.readFileSync(path.join(root,'images/wingman-film.webp')).toString('base64')
};
