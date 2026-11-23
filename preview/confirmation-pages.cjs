function confirmationPages(success, dashboard) {
  // Render the personal dashboard cards from the same source as the full dashboard.
  // Only account features backed by the isolated enrollment API are shown in DEV.
  const section = (html, start, end) => {
    const a = html.indexOf(start), b = html.indexOf(end,a+start.length);
    if (a < 0 || b < 0) throw new Error('Nie znaleziono sekcji panelu: '+start);
    return html.slice(a,b);
  };
  const personal = section(dashboard,'<div id="main-dashboard-content"', '<div id="loyalty-status-row"') +
    section(dashboard,'<div class="kebab-card">','<div style="height: 1px; background: var(--glass-border); margin-bottom: 25px;"></div>') +
    '</div></div></div>';
  const panel = '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Mój Panel · Wingman</title>' +
    section(dashboard,'<style>','</style>')+'</style><style>[hidden]{display:none!important}.skool-tabs-bar a{color:inherit;text-decoration:none}@media(max-width:768px){.skool-tabs-bar{display:flex!important;position:static!important}}.panel-alert{margin:1rem auto;max-width:800px;padding:1rem}</style></head><body>' +
    '<header class="skool-top-bar"><a href="/#dolacz" class="logo"><img src="/images/wingman-wing.png" width="28" height="28" alt=""> Wingman</a></header>' +
    '<nav class="skool-tabs-bar"><a class="skool-tab" href="/#dolacz">Zapisy</a><span class="skool-tab active" aria-current="page">Mój Panel</span></nav>' +
    '<p id="panel-state" class="panel-alert" role="status">Wczytuję Twoje miejsce…</p><main id="panel-cards" hidden>'+personal+'</main><script src="/panel-dev.js"></script></body></html>';
  return {
    '/dashboard.html':panel,
    '/success.html':success.replace('<html lang="pl">','<html lang="pl" data-enrollment="pending">')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
      .replace('</body>','<script src="/enrollment-success.js"></script></body>')
  };
}
module.exports = confirmationPages;
