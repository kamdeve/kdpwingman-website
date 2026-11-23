const fs = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, '..', 'narzedzia');
const files = Object.fromEntries(fs.readdirSync(directory, {withFileTypes:true})
  .filter(entry => entry.isFile())
  .map(entry => [entry.name, fs.readFileSync(path.join(directory,entry.name))]));

// The standalone Railway function can fetch the same versioned static files
// without embedding the category database and spreadsheet parser in its source.
async function serveTools(request, files, revision) {
  const url = new URL(request.url);
  if (url.pathname !== '/narzedzia' && !url.pathname.startsWith('/narzedzia/')) return null;
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  if (url.pathname === '/narzedzia') return Response.redirect(new URL('/narzedzia/'+url.search,url),302);
  const file = url.pathname.slice('/narzedzia/'.length) || 'index.html';
  if (!Object.hasOwn(files,file)) return new Response(null,{status:404});
  const mime = {html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',txt:'text/plain'};
  const headers = {
    'Content-Type': mime[file.split('.').pop()] + '; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; img-src 'self' data: blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
  };
  if (!revision) return new Response(request.method==='HEAD'?null:files[file],{headers});
  try {
    const asset = await fetch('https://cdn.jsdelivr.net/gh/kamdeve/kdpwingman-website@'+revision+'/narzedzia/'+file,
      {method:request.method,signal:AbortSignal.timeout(15000)});
    if (asset.ok) return new Response(asset.body,{headers});
  } catch {}
  return new Response('Nie udało się pobrać pliku.',{status:502});
}
module.exports = {files,serveTools};
