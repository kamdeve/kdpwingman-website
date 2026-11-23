(() => {
  "use strict";
  window.WingmanTools ||= {};

  window.WingmanTools.qr = function renderQr(root) {
    root.innerHTML = `
      <label>Adres URL lub tekst
        <textarea rows="3" placeholder="https://example.com/bonus" spellcheck="false"></textarea>
      </label>
      <p role="status" aria-live="polite"></p>
      <canvas hidden role="img" aria-label="Podgląd kodu QR"
        style="max-width: min(100%, 320px); height: auto;"></canvas>
      <div><button type="button" disabled>Pobierz kod QR jako PNG</button></div>`;
    const input = root.querySelector("textarea");
    const preview = root.querySelector("canvas");
    const status = root.querySelector('[role="status"]');
    const download = root.querySelector("button");
    let timer;

    function generate() {
      const value = input.value;
      if (!value.trim()) return;
      const bytes = new TextEncoder().encode(value);
      try {
        if (bytes.length > 1273) throw new RangeError();
        const qr = window.qrcode(0, "H");
        qr.addData(String.fromCharCode(...bytes), "Byte");
        qr.make();
        const count = qr.getModuleCount();
        const margin = 4;
        const scale = Math.ceil(1200 / (count + 2 * margin));
        preview.width = preview.height = scale * (count + 2 * margin);
        const context = preview.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, preview.width, preview.height);
        context.fillStyle = "#000000";
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) context.fillRect((margin + col) * scale, (margin + row) * scale, scale, scale);
          }
        }
        preview.hidden = false;
        download.disabled = false;
        status.textContent = `Gotowe do wydruku · PNG ${preview.width} × ${preview.height} px`;
      } catch (error) {
        status.textContent = bytes.length > 1273
          ? "Ten tekst jest za długi. Skróć adres lub treść do 1273 bajtów UTF-8."
          : "Nie udało się utworzyć kodu QR. Odśwież stronę i spróbuj ponownie.";
      }
    }
    input.addEventListener("input", () => {
      clearTimeout(timer);
      preview.hidden = true;
      download.disabled = true;
      status.textContent = "";
      timer = setTimeout(generate, 140);
    });
    download.addEventListener("click", () => {
      if (download.disabled) return;
      preview.toBlob(blob => {
        if (!blob) return;
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = "wingman-kod-qr.png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }, "image/png");
    });
  };
})();
