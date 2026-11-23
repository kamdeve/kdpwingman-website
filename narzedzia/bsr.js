(() => {
  'use strict';
  window.WingmanTools ||= {};

  // Monthly results read from the authenticated Titans calculator on 2026-11-23.
  // The sales form uses the marketplace and BSR only. Format in the royalty
  // form does not participate in its sales estimate.
  const samplesByMarket = {
    com: [[1,164340],[10,96480],[100,16230],[1000,4230],[2500,2190],[5000,1290],
      [10000,750],[20000,450],[32598,300],[43370,240],[50000,210],[57614,150],
      [75000,120],[80000,120],[100000,120],[150000,90],[200000,60],[250000,30],
      [500000,1],[1000000,1],[3000000,1]],
    'co.uk': [[1,22234],[1000,610],[10000,103],[50000,24],[80000,16],[100000,12],[500000,1],[3000000,1]],
    de: [[1,26005],[1000,714],[10000,121],[50000,29],[80000,19],[100000,14],[500000,1],[3000000,1]],
    it: [[1000,360],[10000,180],[50000,15],[80000,10],[100000,7],[500000,1]],
    fr: [[1000,211],[10000,35],[50000,8],[80000,5],[100000,4],[500000,1]],
    es: [[1000,185],[10000,31],[50000,7],[80000,5],[100000,3],[500000,1]],
    ca: [[1000,341],[10000,58],[50000,13],[80000,9],[100000,6],[500000,1]],
    'com.au': [[1000,87],[10000,14],[50000,3],[80000,2],[100000,1],[500000,1]]
  };
  const markets = ['com', 'com.au', 'com.mx', 'com.br', 'com.tr', 'co.uk', 'de', 'fr',
    'it', 'es', 'co.jp', 'ca', 'cn', 'in', 'nl', 'ae', 'sg', 'sa', 'se', 'pl'];
  const formatNumber = new Intl.NumberFormat('pl-PL');

  function parsePairs(text) {
    const points = new Map();
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      const pair = /^\s*(\d+)\s*[,;\t ]\s*(\d+)\s*$/.exec(line);
      if (!pair) throw new Error('Wiersz ' + (i + 1) + ' musi zawierać dwie liczby całkowite, np. 50000;80.');
      const [, rank, units] = pair.map(Number);
      if (rank < 1 || rank > 3000000 || !Number.isSafeInteger(units)) {
        throw new Error('Nieprawidłowy BSR lub liczba sprzedaży w wierszu ' + (i + 1) + '.');
      }
      if (points.has(rank)) throw new Error('Powtórzony BSR w wierszu ' + (i + 1) + '.');
      points.set(rank, units);
    }
    return Array.from(points).sort((a, b) => a[0] - b[0]);
  }

  function estimate(points, rank) {
    const rightIndex = points.findIndex(([bsr]) => bsr >= rank);
    if (rightIndex < 0) return null;
    const right = points[rightIndex];
    if (right[0] === rank) return {monthly: right[1], exact: true};
    if (rightIndex === 0) return null;
    const left = points[rightIndex - 1];
    const position = Math.log(rank / left[0]) / Math.log(right[0] / left[0]);
    // Use log/log interpolation for positive volumes and a linear fallback for measured zeros.
    const monthly = left[1] > 0 && right[1] > 0
      ? left[1] * Math.pow(right[1] / left[1], position)
      : left[1] + position * (right[1] - left[1]);
    return {monthly: Math.round(monthly), exact: false, left, right};
  }

  window.WingmanTools.bsr = function renderBsr(root) {
    root.innerHTML = `
      <p>Wpisz ogólny ranking książki w wybranym sklepie Amazon. Otrzymasz szacunkową sprzedaż miesięczną i dzienną.</p>
      <form>
        <label>Rynek Amazon <select name="market"></select></label>
        <label>Ranking bestsellerów (BSR) <input name="rank" type="number" min="1" max="3000000" step="1" required value="50000"></label>
        <details data-settings><summary>Źródło danych i własne pomiary</summary>
        <label>Źródło <select name="source"><option value="reference">Sprawdzone wyniki Self Publishing Titans</option><option value="custom">Moje punkty odniesienia</option></select></label>
        <div data-calibration hidden>
          <label>Ranking dla własnych pomiarów <select name="format"><option value="books">Books (książki drukowane)</option><option value="paperback">Oprawa miękka</option><option value="hardcover">Oprawa twarda</option><option value="kindle">Kindle Store (e-booki)</option></select></label>
          <label>BSR i sprzedaż w 30 dni <textarea name="pairs" rows="4" placeholder="BSR;sprzedaż w 30 dni"></textarea></label>
          <p>Wklej po jednej parze w wierszu, osobno dla każdego rynku i formatu. Możesz użyć własnych pomiarów albo wyników Titans. Punkty zostaną zapisane w tej przeglądarce po obliczeniu.</p>
        </div>
        <p data-coverage></p>
        </details>
        <button type="submit">Oszacuj sprzedaż</button>
      </form>
      <div data-result role="status" aria-live="polite"></div>
      <details><summary>Skąd pochodzi wynik?</summary>
        <p>23 listopada 2026 r. sprawdziliśmy wyniki kalkulatora Self Publishing Titans dla ośmiu rynków. Ich kalkulator sprzedaży uwzględnia rynek i BSR. Formaty oprawy dotyczą osobnego obliczenia tantiem.</p>
        <p>Dla sprawdzonego rankingu pokazujemy odczytaną wartość. Pozostałe wyniki pomiędzy sąsiednimi pomiarami wyznaczamy przez interpolację w skali logarytmicznej. Mogą się różnić od bieżącej prognozy Titans. Poza zakresem danych kalkulator nie podaje prognozy.</p>
        <a href="https://www.selfpublishingtitans.com/pl/tools/KDP-BSR-Sales-Calculator" target="_blank" rel="noopener noreferrer">Porównaj w kalkulatorze Self Publishing Titans</a>
      </details>`;
    const form = root.querySelector('form');
    const {market, format, source, rank, pairs} = form.elements;
    const result = root.querySelector('[data-result]');
    const coverage = root.querySelector('[data-coverage]');
    for (const ending of markets) market.add(new Option('amazon.' + ending, ending));
    const memory = new Map();
    let currentKey;

    function readStored(key) {
      try { return localStorage.getItem(key) || ''; } catch { return ''; }
    }

    function updateCoverage() {
      const custom = source.value === 'custom';
      root.querySelector('[data-calibration]').hidden = !custom;
      result.replaceChildren();
      let points;
      try { points = custom ? parsePairs(pairs.value) : samplesByMarket[market.value] || []; }
      catch (error) { coverage.textContent = error.message; return; }
      coverage.textContent = points.length
        ? 'Dostępne punkty: ' + points.length + '. Zakres BSR: ' + formatNumber.format(points[0][0]) + '–' + formatNumber.format(points.at(-1)[0]) + '.'
        : 'Dodaj punkty odniesienia dla wybranego rynku i rankingu, aby obliczyć wynik.';
      if (market.value === 'pl' && !points.length) {
        coverage.textContent = 'W kalkulatorze Self Publishing Titans nie ma rynku Amazon.pl. Tutaj możesz dodać własne pomiary dla Polski.';
      }
    }

    function switchDataset(preserveSource) {
      if (currentKey) memory.set(currentKey, pairs.value);
      currentKey = 'wingman.bsr.samples.v1.' + market.value + '.' + format.value;
      pairs.value = memory.get(currentKey) ?? readStored(currentKey);
      const hasExamples = Boolean(samplesByMarket[market.value]);
      source.options[0].disabled = !hasExamples;
      if (!hasExamples) {
        source.value = 'custom';
        root.querySelector('[data-settings]').open = true;
      } else if (!preserveSource) {
        source.value = 'reference';
      }
      updateCoverage();
    }

    market.addEventListener('change', () => switchDataset(false));
    format.addEventListener('change', () => switchDataset(true));
    source.addEventListener('change', updateCoverage);
    pairs.addEventListener('input', updateCoverage);
    rank.addEventListener('input', () => result.replaceChildren());
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      let points = samplesByMarket[market.value] || [];
      let persisted = true;
      if (source.value === 'custom') {
        try { points = parsePairs(pairs.value); }
        catch (error) { result.textContent = error.message; return; }
        try { localStorage.setItem(currentKey, pairs.value); } catch { persisted = false; }
      }
      const sales = estimate(points, rank.valueAsNumber);
      if (!sales) {
        result.textContent = 'Ten BSR znajduje się poza zakresem dostępnych danych. Sprawdź zakres lub dodaj własne pomiary.';
        root.querySelector('[data-settings]').open = true;
        return;
      }
      const headline = document.createElement('h3');
      const daily = Math.floor(sales.monthly / 30);
      const dayLabel = sales.monthly === 0 ? '0' : daily < 1 ? '< 1' : formatNumber.format(daily);
      headline.textContent = formatNumber.format(sales.monthly) + ' szt. / 30 dni · ' + dayLabel + ' szt. / dzień';
      const explanation = document.createElement('p');
      explanation.textContent = sales.exact ? (source.value === 'reference'
        ? 'Wynik sprawdzony w Self Publishing Titans 23 listopada 2026 r.'
        : 'Wynik z Twojego pomiaru dla tego rankingu.')
        : 'Szacunek Wingmana pomiędzy BSR ' + formatNumber.format(sales.left[0]) + ' (' + sales.left[1] + ' szt.) i BSR ' + formatNumber.format(sales.right[0]) + ' (' + sales.right[1] + ' szt.).';
      if (!persisted) explanation.textContent += ' Ta przeglądarka nie pozwoliła zapisać danych na później.';
      result.replaceChildren(headline, explanation);
      const royaltyMarkets = {com:'us','co.uk':'uk',de:'eu',fr:'eu',it:'eu',es:'eu',ca:'ca','com.au':'au',pl:'pl',se:'se','co.jp':'jp'};
      if (sales.monthly > 0 && royaltyMarkets[market.value]) {
        const link = document.createElement('a');
        link.href = '#royalty';
        link.textContent = 'Oblicz tantiemy dla tej sprzedaży';
        link.addEventListener('click', event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          document.dispatchEvent(new CustomEvent('wingman:royalty-volume', {
            detail:{market:royaltyMarkets[market.value],sold:sales.monthly}
          }));
        });
        result.append(link);
      }
    });
    switchDataset();
    form.requestSubmit();
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = {estimate, samplesByMarket};
})();
