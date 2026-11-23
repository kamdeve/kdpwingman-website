(() => {
  "use strict";

  const dataURL = new URL("category-data.json", document.currentScript.src);
  const pageSize = 30;
  const separator = " › ";
  let catalogPromise;
  const shortlist = new Map();

  function normalize(text) {
    return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function getCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(dataURL).then(async response => {
        if (!response.ok) throw new Error("Nie udało się wczytać katalogu.");
        const data = await response.json();
        return data.categories.map(([id, path]) => ({
          id, path, department: path.split(separator)[0], search: normalize(path)
        }));
      }).catch(error => {
        catalogPromise = undefined;
        throw error;
      });
    }
    return catalogPromise;
  }

  window.WingmanTools ||= {};
  window.WingmanTools.categories = function categories(root) {
    root.innerHTML = `
      <p>Znajdź ścieżkę kategorii dla książki drukowanej na Amazon.com. Wpisz angielską nazwę lub numer kategorii.</p>
      <div class="fields">
        <label>Szukaj w katalogu
          <input type="search" placeholder="np. Sudoku, Word Search, Electrical Systems" autocomplete="off" data-query>
        </label>
        <label>Dział
          <select data-department><option value="">Wszystkie działy</option></select>
        </label>
      </div>
      <fieldset>
        <legend>Twój wybór kategorii</legend>
        <p data-count>Wybrano 0 z 3 kategorii.</p>
        <ul data-shortlist></ul>
        <button type="button" data-copy disabled>Kopiuj wybrane ścieżki</button>
        <p data-copy-status role="status"></p>
      </fieldset>
      <p data-status role="status">Wczytywanie kategorii…</p>
      <ul data-list></ul>
      <button type="button" data-more hidden>Pokaż kolejne wyniki</button>
      <p class="note">Katalog z 25 grudnia 2025 r. Amazon zmienia kategorie, a dostępne opcje zależą od rynku i formatu. Przed publikacją sprawdź wybraną ścieżkę w panelu KDP.</p>
      <p><a href="https://kdp.amazon.com/en_US/help/topic/G200652170" target="_blank" rel="noopener">Kategorie na innych rynkach w pomocy KDP</a> · <a href="https://github.com/wmh/kdp-categories" target="_blank" rel="noopener">Źródło katalogu</a></p>`;
    const field = root.querySelector("[data-query]");
    const select = root.querySelector("[data-department]");
    const list = root.querySelector("[data-list]");
    const status = root.querySelector("[data-status]");
    const more = root.querySelector("[data-more]");
    const selectedList = root.querySelector("[data-shortlist]");
    const count = root.querySelector("[data-count]");
    const copy = root.querySelector("[data-copy]");
    const copyStatus = root.querySelector("[data-copy-status]");
    let rows = [];
    let matches = [];
    let visible = 0;

    function updateButtons() {
      for (const button of list.querySelectorAll("[data-add-id]")) {
        const added = shortlist.has(button.dataset.addId);
        button.disabled = added || shortlist.size >= 3;
        button.textContent = added ? "Wybrano" : "Wybierz";
      }
    }

    function showSelection() {
      selectedList.replaceChildren();
      count.textContent = "Wybrano " + shortlist.size + " z 3 kategorii.";
      copy.disabled = !shortlist.size;
      copyStatus.textContent = "";
      for (const [id, path] of shortlist) {
        const item = document.createElement("li");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Usuń";
        remove.setAttribute("aria-label", "Usuń z wyboru: " + path);
        remove.addEventListener("click", () => {
          shortlist.delete(id);
          showSelection();
        });
        item.append(path + " ", remove);
        selectedList.append(item);
      }
      updateButtons();
    }

    function showMore() {
      const next = Math.min(visible + pageSize, matches.length);
      const fragment = document.createDocumentFragment();
      for (const row of matches.slice(visible, next)) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = "https://www.amazon.com/gp/bestsellers/books/" + row.id;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = row.path;
        const nodeID = document.createElement("small");
        nodeID.textContent = " · ID " + row.id;
        const choose = document.createElement("button");
        choose.type = "button";
        choose.dataset.addId = row.id;
        choose.setAttribute("aria-label", "Wybierz kategorię: " + row.path);
        choose.addEventListener("click", () => {
          if (shortlist.size >= 3 || shortlist.has(row.id)) return;
          shortlist.set(row.id, row.path);
          showSelection();
        });
        item.append(link, nodeID, " ", choose);
        fragment.append(item);
      }
      list.append(fragment);
      updateButtons();
      visible = next;
      more.hidden = visible >= matches.length;
      status.textContent = matches.length
        ? "Widoczne ścieżki: " + visible + " z " + matches.length.toLocaleString("pl-PL") + "."
        : "Brak pasujących kategorii. Spróbuj krótszej angielskiej nazwy lub wybierz inny dział.";
    }

    function filter() {
      const query = normalize(field.value);
      const byID = /^\d+$/.test(query);
      const terms = query.split(" ").filter(Boolean);
      matches = rows.filter(row =>
        (!select.value || select.value === row.department) &&
        (byID ? row.id === query : terms.every(term => row.search.includes(term)))
      );
      visible = 0;
      list.replaceChildren();
      showMore();
    }

    async function load() {
      field.disabled = select.disabled = true;
      try {
        rows = await getCatalog();
        for (const department of new Set(rows.map(row => row.department))) {
          select.add(new Option(department, department));
        }
        field.disabled = select.disabled = false;
        filter();
      } catch {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Spróbuj ponownie";
        retry.addEventListener("click", () => {
          status.textContent = "Wczytywanie kategorii…";
          load();
        }, { once: true });
        status.replaceChildren("Nie udało się wczytać katalogu. ", retry);
      }
    }

    field.addEventListener("input", filter);
    select.addEventListener("change", filter);
    more.addEventListener("click", showMore);
    copy.addEventListener("click", async () => {
      const paths = Array.from(shortlist.values(), path => "Books > " + path.split(separator).join(" > ")).join("\n");
      try {
        await navigator.clipboard.writeText(paths);
        copyStatus.textContent = "Skopiowano wybrane ścieżki.";
      } catch {
        const manual = document.createElement("textarea");
        manual.readOnly = true;
        manual.value = paths;
        manual.setAttribute("aria-label", "Wybrane ścieżki do skopiowania");
        copyStatus.replaceChildren("Zaznaczony tekst możesz skopiować ręcznie. ", manual);
        manual.focus();
        manual.select();
      }
    });
    showSelection();
    load();
  };
})();
