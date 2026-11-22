const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const home=read('index.html');
const hero=home.match(/<section class="enroll"[^]*?<\/section>/)[0];
const style=read('enrollment.css');
const base=`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>KDP Wingman · Podgląd zapisu</title><style>
body{margin:0;background:#faf9fb;color:#242238;font:16px/1.5 system-ui,sans-serif}header,footer{background:white;border-bottom:1px solid #e9e3e8;padding:13px max(18px,calc((100% - 1112px)/2));display:flex;align-items:center;gap:10px;flex-wrap:wrap}header img{width:32px}header b{font-size:1.15rem}header a{margin-left:auto}a{color:#881443}aside{padding:8px max(18px,calc((100% - 1112px)/2));background:#f4eaf0;font-size:.92rem;display:flex;align-items:center;gap:10px;flex-wrap:wrap}aside select,aside button{font:inherit;padding:4px;border:1px solid #baacb6;background:white;border-radius:5px}footer{font-size:.9rem;color:#575565}.screen{max-width:420px;margin:8vh auto;padding:30px;background:white;border:1px solid #e5cbd6;border-radius:16px}.screen button{border:0;background:#881443;color:white;font:inherit;padding:12px;border-radius:8px;cursor:pointer}.screen a{display:inline-block;margin-top:15px}
${style}</style>`;
const top=`<header><img src="/logo.svg" alt=""><b>KDP Wingman</b><a href="/#dolacz">Wspólny dostęp</a></header>`;
const controls=`<aside><b>Podgląd DEV</b><span>Historia edycji jest rzeczywista. Bieżące zapisy i płatność są symulowane.</span><label>Scenariusz <select id="demo-case"><option value="new">Nowa osoba</option><option value="returning">Zalogowany · 25 zł w portfelu</option><option value="wallet">Pełny depozyt w portfelu</option><option value="ticket">Darmowy bilet</option><option value="joined">Już zapisany</option><option value="closed">Zapisy zamknięte</option></select></label><button id="demo-reset">Zacznij od nowa</button></aside>`;
const doc=(body,js='')=>'<!doctype html><html lang="pl"><head>'+base+'</head><body>'+top+body+'<script src="/demo.js"></script>'+js+'</body></html>';
const pages={
 '/':doc(controls+'<main>'+hero+'</main><footer>Do próby logowania wybierz „Mam konto”. E-mail: test@example.com · Hasło: Wingman75. Do rejestracji użyj fikcyjnych danych.</footer>','<script src="/enrollment.js"></script>'),
 '/checkout':doc('<main class="screen"><p>Podgląd DEV · symulacja</p><h1>Płatność za zrzutkę</h1><p>Depozyt do wpłaty: <strong id="demo-amount"></strong></p><button id="demo-pay">Potwierdź wpłatę testową</button><br><a href="/?cancelled=1#dolacz">Anuluj i wróć</a></main>'),
 '/dashboard.html':doc('<main class="screen"><h1>Panel uczestnika</h1><p>Tutaj kończy się podgląd ścieżki zapisu.</p><a href="/">Wróć do edycji</a></main>'),
 '/demo.js':read('preview/demo.js'), '/enrollment.js':read('enrollment.js'), '/logo.svg':read('images/logo.svg')
};
module.exports=pages;
