const pages = require('./pages.cjs');
// Keep all preview writes inside the browser. Only these public resources are read upstream.
async function respond(request, assets) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  if (['/public-data/stats/total-users','/public-data/puls/posts'].includes(pathname)) {
    try {
      const path = pathname.slice('/public-data/'.length);
      const res = await fetch('https://kdpwingmanv2backend-production.up.railway.app/api/'+path,{signal:AbortSignal.timeout(18000)});
      if (!res.ok) throw new Error();
      const data = await res.json();
      const result = path === 'stats/total-users' ? {total:data.total} : data.map(({title,content,created_at,image_url})=>({title,content,created_at,image_url}));
      return Response.json(result,{headers:{'Cache-Control':'public, max-age=60'}});
    } catch {return Response.json({error:'Źródło chwilowo niedostępne.'},{status:502});}
  }
  if (/^\/images\/step[1-4]\.png$/.test(pathname) || pathname === '/videos/KDPWIngman zapowiedz.mp4') {
    const origin = 'https://cdn.jsdelivr.net/gh/kamdeve/kdpwingman-website@3924b7719fd9cf87f2f3fa5dc82296d016dd109e';
    return Response.redirect(origin+encodeURI(pathname),302);
  }
  if (/^\/images\/niche\/(black-box|amazon-search|xray|cerebro|book-ranks)\.webp$/.test(pathname)) {
    return Response.redirect('https://cdn.jsdelivr.net/gh/kamdeve/kdpwingman-website@eb0a4209af38810cc1ad55ea98746598264ce392'+pathname,302);
  }
  const page = assets[pathname === '/index.html' ? '/' : pathname];
  if (typeof page !== 'string') return new Response('Brak strony',{status:404});
  const ext=pathname.split('.').pop();
  const type=({js:'text/javascript',css:'text/css',png:'image/png',webp:'image/webp'})[ext] || 'text/html';
  const binary=type.startsWith('image/');
  return new Response(binary ? Buffer.from(page,'base64') : page,{headers:{
    'Content-Type':type+(binary?'':'; charset=utf-8'),'Cache-Control':'no-store','X-Robots-Tag':'noindex',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; media-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
  }});
}
if (process.argv.includes('--railway')) {
  process.stdout.write('const assets = '+JSON.stringify(pages)+';\n'+respond.toString()+
    '\nBun.serve({hostname:"0.0.0.0",port:Number(process.env.PORT || 8080),fetch:req=>respond(req,assets)});');
} else {
  require('node:http').createServer(async(req,res)=>{
    const result=await respond(new Request(new URL(req.url,'http://localhost'),{method:req.method}),pages);
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }).listen(Number(process.env.PORT || 4375),'127.0.0.1');
}
