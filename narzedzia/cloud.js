(() => {
  "use strict";
  window.WingmanTools ||= {};
  const scriptBase = document.currentScript?.src || document.baseURI;
  const xlsxUrl = new URL("xlsx.mini-0.20.3.min.js", scriptBase).href;
  const ignored = new Set(`{}[],'"():;.!-_—–“”‘’/><»«=|&`);
  const maxChars = 2_000_000;
  const colors = ["#a0134a", "#18345c", "#146b61", "#713557", "#354e71", "#385d52"];
  let readerPromise;

  function loadSpreadsheetReader() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!readerPromise) {
      readerPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = xlsxUrl;
        script.onload = () => resolve(window.XLSX);
        script.onerror = () => {
          readerPromise = null;
          script.remove();
          reject(new Error("Nie udało się wczytać obsługi plików XLSX."));
        };
        document.head.append(script);
      });
    }
    return readerPromise;
  }

  function countWords(text) {
    const counts = new Map();
    for (const token of text.match(/\S+/gu) || []) {
      const word = Array.from(token).filter(char => !ignored.has(char)).join("");
      if (word) counts.set(word, (counts.get(word) || 0) + 1);
    }
    return [...counts].sort((left, right) => right[1] - left[1]);
  }

  async function fileContents(file) {
    if (file.size > 4 * 1024 * 1024) throw new Error("Wybierz plik o wielkości do 4 MB.");
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "txt") return file.text();
    if (extension === "csv") return (await file.text()).replace(/[,\r\n]/g, " ");
    if (extension !== "xlsx") throw new Error("Wybierz plik TXT, CSV lub XLSX.");
    const reader = await loadSpreadsheetReader();
    const workbook = reader.read(await file.arrayBuffer(), { type: "array" });
    const values = [];
    let size = 0;
    for (const name of workbook.SheetNames) {
      const records = reader.utils.sheet_to_json(workbook.Sheets[name]);
      for (const record of records) {
        for (const value of Object.values(record)) {
          const text = String(value);
          size += text.length + 1;
          if (size > maxChars) throw new Error("Wybierz maksymalnie 2 miliony znaków.");
          values.push(text);
        }
      }
    }
    return values.join(" ");
  }

  function drawCloud(canvas, sorted) {
    const entries = sorted.slice(0, 101);
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const padding = 24;
    const usable = width - padding * 2;
    const min = entries.at(-1)[1];
    const max = entries[0][1];
    let scale = 1;
    let rows;
    let totalHeight;
    do {
      rows = [{ words: [], width: 0, height: 0 }];
      for (const [word, count] of entries) {
        let fontSize = (max === min ? 62 : 18 + 100 * (count - min) / (max - min)) * scale;
        context.font = `bold ${fontSize}px sans-serif`;
        const measured = context.measureText(word).width;
        if (measured > usable) fontSize *= usable / measured;
        const drawnWidth = Math.min(usable, measured);
        let row = rows[rows.length - 1];
        if (row.words.length && row.width + drawnWidth + 12 > usable) {
          row = { words: [], width: 0, height: 0 };
          rows.push(row);
        }
        if (row.words.length) row.width += 12;
        row.words.push({ word, width: drawnWidth, fontSize });
        row.width += drawnWidth;
        row.height = Math.max(row.height, Math.ceil(fontSize * 1.35));
      }
      totalHeight = rows.reduce((sum, row) => sum + row.height, 0);
      scale *= 0.82;
    } while (totalHeight > height - padding * 2);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.textBaseline = "middle";
    const centered = [...rows.filter((_, i) => i % 2 === 1).reverse(), ...rows.filter((_, i) => i % 2 === 0)];
    let y = (height - totalHeight) / 2;
    let color = 0;
    for (const row of centered) {
      let x = (width - row.width) / 2;
      for (const entry of row.words) {
        context.font = `bold ${entry.fontSize}px sans-serif`;
        context.fillStyle = colors[(color++) % colors.length];
        context.fillText(entry.word, x, y + row.height / 2);
        x += entry.width + 12;
      }
      y += row.height;
    }
  }

  window.WingmanTools.cloud = function renderWordCloud(root) {
    root.innerHTML = `
      <label>Tekst do analizy
        <textarea rows="5" maxlength="2000000" placeholder="Wklej opisy książek, recenzje lub słowa kluczowe"></textarea>
      </label>
      <label>Lub wczytaj plik TXT, CSV lub XLSX
        <input type="file" accept=".txt,.csv,.xlsx">
      </label>
      <p>Wielkość liter ma znaczenie. W arkuszach XLSX pierwszy wiersz każdej tabeli służy jako nagłówki.</p>
      <button type="button" data-action="generate">Generuj chmurę</button>
      <p role="status" aria-live="polite"></p>
      <div data-output hidden>
        <canvas width="1000" height="700" role="img" aria-label="Chmura najczęściej występujących słów"
          style="width:100%; height:auto; display:block;"></canvas>
        <button type="button" data-action="download">Pobierz chmurę jako PNG</button>
        <details><summary>Liczba wystąpień słów</summary>
          <table><thead><tr><th scope="col">Słowo</th><th scope="col">Wystąpienia</th></tr></thead><tbody></tbody></table>
          <div><button type="button" data-action="prev">Poprzednia strona</button>
          <span data-page></span> <button type="button" data-action="next">Następna strona</button></div>
        </details>
      </div>`;
    const input = root.querySelector("textarea");
    const fileInput = root.querySelector('input[type="file"]');
    const generate = root.querySelector('[data-action="generate"]');
    const status = root.querySelector('[role="status"]');
    const output = root.querySelector("[data-output]");
    const canvas = root.querySelector("canvas");
    const tbody = root.querySelector("tbody");
    const prev = root.querySelector('[data-action="prev"]');
    const next = root.querySelector('[data-action="next"]');
    const download = root.querySelector('[data-action="download"]');
    let sorted = [];
    let page = 0;
    let request = 0;
    const pageSize = 25;

    function clear() {
      request++;
      output.hidden = true;
      status.textContent = "";
      generate.disabled = false;
    }
    function showTable() {
      const pages = Math.ceil(sorted.length / pageSize);
      tbody.replaceChildren();
      for (const [word, count] of sorted.slice(page * pageSize, (page + 1) * pageSize)) {
        const tr = tbody.insertRow();
        const cell = tr.insertCell();
        cell.style.overflowWrap = "anywhere";
        cell.textContent = word;
        tr.insertCell().textContent = String(count);
      }
      prev.disabled = !page;
      next.disabled = page >= pages - 1;
      root.querySelector("[data-page]").textContent = `${page + 1} / ${pages}`;
    }
    input.addEventListener("input", clear);
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      clear();
      const read = request;
      generate.disabled = true;
      status.textContent = "Wczytywanie pliku…";
      try {
        const text = await fileContents(file);
        if (read !== request) return;
        if (text.length > maxChars) throw new Error("Wybierz maksymalnie 2 miliony znaków.");
        input.value = text;
        status.textContent = "Wczytano plik. Możesz wygenerować chmurę.";
      } catch (error) {
        if (read === request) status.textContent = `Błąd odczytu pliku. ${error.message}`;
      } finally {
        if (read === request) {
          generate.disabled = false;
          fileInput.value = "";
        }
      }
    });
    generate.addEventListener("click", () => {
      sorted = countWords(input.value);
      if (!sorted.length) {
        output.hidden = true;
        status.textContent = "Wpisz przynajmniej jedno słowo.";
        return;
      }
      page = 0;
      showTable();
      drawCloud(canvas, sorted);
      output.hidden = false;
      const count = sorted.reduce((sum, [, amount]) => sum + amount, 0);
      status.textContent = `Słowa: ${count}. Różne słowa: ${sorted.length}. W chmurze: ${Math.min(101, sorted.length)}.`;
    });
    prev.onclick = () => { page--; showTable(); };
    next.onclick = () => { page++; showTable(); };
    download.onclick = () => {
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "wingman-chmura-slow.png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    };
  };
})();
