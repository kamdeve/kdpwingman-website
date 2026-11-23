const pages = require('./pages.cjs');
// Only the explicitly listed enrollment routes can reach the private DEV service.
async function respond(request, assets) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const routes = {
    '/api/register':['POST','/api/register'], '/api/login':['POST','/api/login'],
    '/api/group-buy/status':['GET','/api/enrollment/status'], '/public-data/group-buy/status':['GET','/api/enrollment/status'],
    '/api/enrollment/me':['GET','/api/enrollment/me'], '/api/enrollment/continue':['POST','/api/enrollment/continue'],
    '/api/enrollment/receipt':['POST','/api/enrollment/receipt'], '/api/enrollment/webhook':['POST','/api/enrollment/webhook']
  };
  const route = Object.hasOwn(routes,pathname) && routes[pathname];
  if (route) {
    if (route[0] !== request.method) return new Response(null,{status:405});
    if (request.headers.has('origin') && request.headers.get('origin') !== new URL(request.url).origin)
      return new Response(null,{status:403});
    const headers = new Headers();
    for (const name of ['content-type','authorization','stripe-signature']) {
      if (request.headers.has(name)) headers.set(name,request.headers.get(name));
    }
    try {
      const response = await fetch('http://kdpwingman-v2-backend.railway.internal:8080'+route[1],{
        method:request.method,headers,body:request.method==='POST'?request.body:undefined,duplex:'half',
        redirect:'error',signal:AbortSignal.timeout(18000)
      });
      if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
        return Response.json({error:'Nie udało się obsłużyć żądania.'},{status:response.status});
      }
      return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'}});
    } catch { return Response.json({error:'Backend testowy jest chwilowo niedostępny.'},{status:502}); }
  }
  if (pathname === '/dashboard') return Response.redirect(new URL('/dashboard.html',request.url),302);
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  if (pathname === '/public-data/nbp-usd') {
    try {
      const upstream = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json', {signal:AbortSignal.timeout(4500)});
      if (!upstream.ok) throw new Error();
      const {effectiveDate,mid} = (await upstream.json()).rates[0];
      return Response.json({rates:[{effectiveDate,mid}]}, {headers:{'Cache-Control':'public, max-age=900'}});
    } catch { return Response.json({error:'Brak kursu NBP'}, {status:503}); }
  }
  if (['/public-data/stats/total-users','/public-data/stats/history','/public-data/group-buy/status','/public-data/puls/posts'].includes(pathname)) {
    try {
      const path = pathname.slice('/public-data/'.length);
      const res = await fetch('https://kdpwingmanv2backend-production.up.railway.app/api/'+path,{signal:AbortSignal.timeout(18000)});
      if (!res.ok) throw new Error();
      const data = await res.json();
      let result;
      if (path === 'group-buy/status') {
        const {users,targetMonth,isLocked,isSplitActive,priceUSD,pricePLN,votes,rate,payingUsers} = data;
        result = {users,targetMonth,isLocked,isSplitActive,priceUSD,pricePLN,votes,rate,payingUsers};
      } else if (path === 'stats/history') result = data.map(({month,users,price}) => ({month,users,price}));
      else if (path === 'stats/total-users') result = {total:data.total};
      else result = data.map(({title,content,created_at,image_url}) => ({title,content,created_at,image_url}));
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
  if (/^\/images\/mechanic-books\/(mechanics|dummies-green|dummies-red|repair-bible|beginners|black-box-bsr)\.webp$/.test(pathname)) {
    return Response.redirect('https://cdn.jsdelivr.net/gh/kamdeve/kdpwingman-website@82e0c26c787645ba2746840707ccea37bd527aac'+pathname,302);
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
    const body=['GET','HEAD'].includes(req.method)?undefined:req;
    const result=await respond(new Request(new URL(req.url,'http://localhost'),{method:req.method,headers:req.headers,body,duplex:'half'}),pages);
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  }).listen(Number(process.env.PORT || 4375),'127.0.0.1');
}
