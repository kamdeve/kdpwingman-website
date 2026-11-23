(() => {
  'use strict';
  const tools = window.WingmanTools ||= {};
  // KDP Paperback Printing Cost, Hardcover Printing Cost and Print Book Pricing Page.
  // Costs in a pair are for regular / large trim. Color = per-page rate except for short books.
  const markets = {
    us: { name: 'Amazon.com', currency: 'USD', threshold: 9.99, max: 250,
      base: 1, short: [2.30,2.84], black: [.012,.017], shortPremium: [3.60,4.20],
      premium: [.065,.08], standard: [.0255,.0402], hardBase: 5.65, hardShort: [6.80,7.49], hardColor: [.065,.08] },
    uk: { name: 'Amazon.co.uk', currency: 'GBP', threshold: 7.99, max: 250,
      base: .85, short: [1.93,2.15], black: [.010,.012], shortPremium: [2.59,3.24],
      premium: [.0435,.0598], standard: [.020,.027], hardBase: 4.15, hardShort: [5.23,5.45], hardColor: [.045,.060] },
    ca: { name: 'Amazon.ca', currency: 'CAD', threshold: 13.99, max: 350,
      base: 1.26, short: [2.99,3.53], black: [.016,.021], shortPremium: [4.66,5.26], premium: [.085,.10], standard: [.037,.052] },
    eu: { name: 'Amazon UE w EUR (.de, .es, .fr, .it, .nl, .ie, .com.be)', currency: 'EUR', threshold: 9.99, max: 250,
      base: .75, short: [2.05,2.48], black: [.012,.016], shortPremium: [2.85,3.61],
      premium: [.0525,.0715], standard: [.024,.035], hardBase: 4.65, hardShort: [5.95,6.35], hardColor: [.057,.072] },
    au: { name: 'Amazon.com.au', currency: 'AUD', threshold: 13.99, max: 350,
      base: 2.42, short: [4.74,5.28], black: [.022,.027], shortPremium: [5.82,6.42], premium: [.085,.100] },
    pl: { name: 'Amazon.pl', currency: 'PLN', threshold: 40, max: 1200,
      base: 3.51, short: [9.58,11.61], black: [.056,.075], shortPremium: [12.86,15.32],
      premium: [.267,.337], standard: [.112,.164], hardBase: 20.34, hardColorBase: 21.78, hardShort: [27.85,29.87], hardColor: [.267,.337] },
    se: { name: 'Amazon.se', currency: 'SEK', threshold: 110, max: 2500,
      base: 8.37, short: [22.84,27.67], black: [.134,.179], shortPremium: [30.65,36.51],
      premium: [.636,.804], standard: [.268,.3691], hardBase: 48.49, hardColorBase: 51.91, hardShort: [66.38,71.21], hardColor: [.636,.804] },
    jp: { name: 'Amazon.co.jp', currency: 'JPY', threshold: 1000, max: 30000,
      base: 206, short: [422,530], black: [2,3], shortPremium: [475,475], premium: [4,5], standard: [3.5,4.5] }
  };
  const printHelp = 'https://kdp.amazon.com/en_US/help/topic/G8BKPU9AGVZSF9QF';
  const ebookHelp = 'https://kdp.amazon.com/en_US/help/topic/G200644210';
  const cent = (amount, unit, round = Math.round) => round((amount + (round === Math.ceil ? -1 : 1)*1e-10)*unit)/unit;
  function printCost(data, market) {
    const {format, ink, pages, size} = data;
    if (format === 'hard') {
      if (ink === 'black') return pages <= 108 ? market.hardShort[size] : market.hardBase + pages * market.black[size];
      return (market.hardColorBase ?? market.hardBase) + pages * market.hardColor[size];
    }
    if (ink === 'black' && pages <= (data.market === 'au' ? 108 : 110)) return market.short[size];
    if (ink === 'premium' && pages <= 40) return market.shortPremium[size];
    return market.base + market[ink][size] * pages;
  }
  function estimate(data) {
    const market = markets[data.market], unit = market.currency === 'JPY' ? 1 : 100;
    const rate = data.format === 'ebook' ? data.plan : data.price >= market.threshold ? .6 : .5;
    const cost = data.format === 'ebook' ? 0 : cent(printCost(data, market),unit);
    const royalty = cent(data.format === 'ebook' ? rate * (data.price - (rate === .7 ? data.delivery : 0)) : rate*data.price - cost, unit);
    const halfFloor = cent(cost/.5,unit,Math.ceil);
    const minimum = halfFloor < market.threshold ? halfFloor : Math.max(market.threshold,cent(cost/.6,unit,Math.ceil));
    return {rate,cost,royalty,minimum,total:cent(royalty*data.sold,unit),
      expanded:cent(.4*data.price-cost, unit), expandedMin:cent(cost/.4,unit,Math.ceil)};
  }
  function royaltyTool(root) {
    root.innerHTML = `<form class="tool-form"><label>Format<select name="format"><option value="soft">Miękka oprawa</option><option value="hard">Twarda oprawa</option><option value="ebook">Kindle eBook</option></select></label>
      <label>Rynek<select name="market">${Object.entries(markets).map(([key,m])=>`<option value="${key}">${m.name}</option>`).join('')}</select></label>
      <label>Wnętrze<select name="ink"><option value="black">Czarno-białe, papier biały lub kremowy</option><option value="standard">Kolor standardowy</option><option value="premium">Kolor premium</option></select></label>
      <label>Format druku<select name="size"><option value="0">Standardowy (np. 6 × 9 cali)</option><option value="1">Duży (szer. ponad 6,12″ lub wys. ponad 9″)</option></select></label>
      <label>Liczba stron do druku<input type="number" name="pages" value="300" step="1" required></label>
      <label>Plan Kindle<select name="plan"><option value="0.7">70%</option><option value="0.35">35%</option></select></label>
      <label>Koszt przesłania jednego e-booka<input type="number" step=".01" min="0" name="delivery" value="0.06" required></label>
      <label>Cena katalogowa bez VAT (<span data-currency></span>)<input type="number" name="price" value="9.99" min=".01" step=".01" required></label>
      <label>Sprzedane egzemplarze<input type="number" name="sold" value="1" min="1" max="1000000000" step="1" required></label><button>Oblicz tantiemy</button></form>
      <div class="result" aria-live="polite"></div><p><a data-help target="_blank" rel="noopener">Zasady obliczania tantiem w KDP</a></p>`;
    const form=root.querySelector('form'), f=form.elements, result=root.querySelector('.result');
    function visible(field, show) {field.disabled=!show; field.closest('label').hidden=!show;}
    function sync() {
      const ebook=f.format.value==='ebook', hard=f.format.value==='hard';
      f.market.querySelector('[value="eu"]').textContent = ebook
        ? 'Amazon UE w EUR (.de, .es, .fr, .it, .nl)' : markets.eu.name;
      f.size.options[0].textContent = hard ? 'Standardowy (np. 6 × 9 cali)' : 'Standardowy (np. 5 × 8 lub 6 × 9 cali)';
      for (const option of f.market.options) {
        option.disabled = (hard && !markets[option.value].hardBase) || (ebook && ['pl','se'].includes(option.value));
      }
      if (f.market.selectedOptions[0].disabled) f.market.value='us';
      const m=markets[f.market.value];
      f.ink.querySelector('[value="standard"]').disabled=hard || !m.standard;
      if (f.ink.selectedOptions[0].disabled) f.ink.value='black';
      for (const field of [f.ink,f.size,f.pages]) visible(field,!ebook);
      visible(f.plan,ebook); visible(f.delivery,ebook && f.plan.value==='0.7');
      f.pages.min=hard ? 75 : f.ink.value==='standard' ? 72 : 24;
      f.pages.max=hard ? 550 : f.ink.value==='standard' ? 600 : 828;
      if(!ebook) f.price.max=m.max; else f.price.removeAttribute('max');
      f.price.step=m.currency==='JPY' ? 1 : .01;
      root.querySelector('[data-currency]').textContent=m.currency;
      root.querySelector('[data-help]').href=ebook ? ebookHelp : printHelp;
    }
    function calculate() {
      if (!form.checkValidity()) { result.textContent='Sprawdź zakresy przy polach formularza.'; return; }
      const data = {format:f.format.value, market:f.market.value, ink:f.ink.value, size:+f.size.value,
        pages:+f.pages.value, price:+f.price.value, plan:+f.plan.value, delivery:+f.delivery.value, sold:+f.sold.value};
      const out=estimate(data), m=markets[data.market], ebook=data.format==='ebook';
      const money=n=>n.toLocaleString('pl-PL',{style:'currency',currency:m.currency});
      if (ebook && data.plan===.7 && data.delivery > data.price) { result.textContent='Koszt dostawy przekracza cenę książki. Sprawdź wprowadzone kwoty.'; return; }
      const view=(name,value)=>`<p>${name} <strong>${value}</strong></p>`;
      let html=ebook ? '<p>Założenie: sprzedaż kwalifikuje się do wybranego planu Kindle. We wszystkich polach podaj kwoty bez VAT w walucie rynku.</p>' :
        view('Koszt druku egzemplarza',money(out.cost))+view('Minimalna cena w kanale Amazon',money(out.minimum));
      if (!ebook && data.price<out.minimum) {
        result.innerHTML=html+'<p>Podnieś cenę katalogową co najmniej do podanego minimum.</p>';return;
      }
      html+=view('Stawka tantiem',Math.round(out.rate*100)+'%')+view('Tantiemy za egzemplarz',money(out.royalty))+
        view('Tantiemy za podaną sprzedaż',money(out.total))+view('Próg rentowności reklam (ACoS)',(out.royalty/data.price*100).toLocaleString('pl-PL',{maximumFractionDigits:2})+'%');
      if (data.format==='soft' && ['us','uk'].includes(data.market)) {
        html+=`<details><summary>Dystrybucja rozszerzona (dla kwalifikujących się tytułów)</summary>${view('Minimalna cena przy stawce 40%',money(out.expandedMin))}
          ${data.price>=out.expandedMin?view('Tantiemy za egzemplarz',money(out.expanded))+view('Tantiemy łącznie',money(out.expanded*data.sold)):'<p>Cena jest poniżej minimum dla tego kanału.</p>'}</details>`;
      }
      result.innerHTML=html;
    }
    form.addEventListener('input',()=>{sync();result.replaceChildren();});
    form.addEventListener('submit',event=>{event.preventDefault();calculate();});
    sync();calculate();
  }
  tools.royalty=royaltyTool;
  if (typeof module !== 'undefined' && module.exports) module.exports={estimate};
})();
