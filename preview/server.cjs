const pages = require('./pages.cjs');
function respond(request, assets) {
  const pathname = new URL(request.url).pathname;
  const page = assets[pathname === '/index.html' ? '/' : pathname];
  if (typeof page !== 'string') return new Response('Brak strony', {status:404});
  const type = pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
  return new Response(page, {headers:{
    'Content-Type':type+'; charset=utf-8', 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
  }});
}
if (process.argv.includes('--railway')) {
  process.stdout.write('const assets = '+JSON.stringify(pages)+';\n'+respond.toString()+
    '\nBun.serve({hostname:"0.0.0.0",port:Number(process.env.PORT || 8080),fetch:req=>respond(req,assets)});');
} else {
  require('node:http').createServer(async(req,res)=>{
    const response=respond(new Request(new URL(req.url,'http://localhost')),pages);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(await response.text());
  }).listen(Number(process.env.PORT || 4375),'127.0.0.1');
}
