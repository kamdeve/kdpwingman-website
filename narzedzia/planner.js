(() => {
  'use strict';

  const prefix = 'wingman:book-planner:v1:';
  const milestones = [
    'Wybór niszy i czytelnika',
    'Przygotowanie wnętrza',
    'Projekt okładki',
    'Korekta i sprawdzenie plików',
    'Opis, słowa kluczowe i kategorie',
    'Publikacja w KDP'
  ];

  function newPlan() {
    return {
      title: '', release: '', outline: '',
      columns: [],
      tasks: milestones.map(name => ({ name, date: '', done: false }))
    };
  }

  function readPlan(raw) {
    const plan = JSON.parse(raw);
    if (!plan || typeof plan.title !== 'string' || typeof plan.release !== 'string' ||
        typeof plan.outline !== 'string' || !Array.isArray(plan.tasks) ||
        !plan.tasks.every(task => task && typeof task.name === 'string' &&
          typeof task.date === 'string' && typeof task.done === 'boolean')) {
      throw new Error('Nieprawidłowe dane planu');
    }
    plan.columns ??= [];
    if (!Array.isArray(plan.columns) || !plan.columns.every(col =>
      typeof col?.name === 'string' && Array.isArray(col.cards) && col.cards.every(card =>
        typeof card?.title === 'string' && typeof card.notes === 'string' && Array.isArray(card.files) &&
        card.files.every(file => typeof file?.name === 'string' &&
          typeof file.data === 'string' && /^data:application\/octet-stream;base64,[\w+/=]*$/.test(file.data))))) {
      throw new Error('Nieprawidłowe dane tablicy');
    }
    return plan;
  }

  function createBoard(host, addColumn, tellUser, changed) {
    let columns = [];
    let dragging = null;
    let uploads = 0;
    const make = (tag, text) => {
      const element = document.createElement(tag);
      if (text) element.textContent = text;
      return element;
    };
    function action(text, handler, disabled = false) {
      const el = make('button', text);
      el.type = 'button';
      el.disabled = disabled;
      el.onclick = handler;
      return el;
    }
    function refresh() {
      changed();
      render();
    }
    function move(array, index, next) {
      const [entry] = array.splice(index, 1);
      array.splice(next, 0, entry);
      refresh();
    }
    function field(element, name, source, prop) {
      const label = make('label', name);
      element.value = source[prop];
      element.oninput = () => { source[prop] = element.value; changed(); };
      label.append(element);
      return label;
    }
    function dragHandle(type, col, index) {
      const handle = make('span', '⠿');
      handle.className = 'planner-grip';
      handle.title = type === 'column' ? 'Przeciągnij kolumnę' : 'Przeciągnij kartę';
      handle.draggable = true;
      handle.ondragstart = event => {
        dragging = { type, col, index };
        event.dataTransfer.setData('text/plain', 'Wingman');
        event.dataTransfer.effectAllowed = 'move';
      };
      handle.ondragend = () => { dragging = null; };
      return handle;
    }
    function drop(target, col, index) {
      target.ondragover = event => {
        if (!dragging || (index !== undefined && dragging.type !== 'card')) return;
        event.preventDefault();
        event.stopPropagation();
      };
      target.ondrop = event => {
        if (!dragging || (index !== undefined && dragging.type !== 'card')) return;
        event.preventDefault();
        event.stopPropagation();
        const from = dragging;
        dragging = null;
        if (from.type === 'column') return move(columns, from.col, col);
        const [card] = columns[from.col].cards.splice(from.index, 1);
        const dest = columns[col].cards;
        dest.splice(index ?? dest.length, 0, card);
        refresh();
      };
    }
    async function importFiles(files, card, list) {
      const chosen = Array.from(files);
      uploads++;
      try {
        const additions = [];
        for (const file of chosen) {
          if (file.size > 1024 * 1024) throw new Error('Załącznik przekracza limit 1 MB. Zmniejsz plik lub wklej odnośnik w karcie.');
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            // A generic download type keeps attachments inert, even for HTML and SVG.
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
            reader.readAsDataURL(new Blob([file], { type: 'application/octet-stream' }));
          });
          additions.push({ name: file.name, data });
        }
        card.files.push(...additions);
        changed();
        renderFiles(list, card);
      } catch (error) {
        tellUser(error.message);
      } finally {
        uploads--;
      }
    }
    function renderFiles(list, card) {
      list.replaceChildren();
      card.files.forEach((file, index) => {
        const row = make('div');
        const link = make('a', file.name);
        link.href = file.data;
        link.download = file.name;
        row.append(link, action('Usuń załącznik', () => {
          card.files.splice(index, 1);
          changed();
          renderFiles(list, card);
        }));
        list.append(row);
      });
    }
    function renderCard(card, col, idx) {
      const cardBox = make('details');
      cardBox.className = 'planner-card';
      cardBox.open = !card.title;
      const head = make('summary', card.title || 'Nowa karta');
      head.append(dragHandle('card', col, idx));
      cardBox.append(head);
      const title = make('input');
      title.maxLength = 240;
      title.required = true;
      const titleField = field(title, 'Tytuł karty', card, 'title');
      title.addEventListener('input', () => {
        head.firstChild.textContent = title.value || 'Nowa karta';
      });
      const notes = make('textarea');
      notes.rows = 3;
      cardBox.append(titleField, field(notes, 'Opis i odnośniki', card, 'notes'));
      const links = make('div');
      function showLinks() {
        links.replaceChildren();
        for (const match of new Set((card.notes.match(/https?:\/\/[^\s<>"']+/gi) || []))) {
          try {
            const url = new URL(match);
            const anchor = make('a', url.host);
            anchor.href = url.href;
            anchor.target = '_blank';
            anchor.rel = 'noreferrer';
            links.append(anchor, ' ');
          } catch { /* Incomplete links remain editable in the description. */ }
        }
      }
      notes.addEventListener('input', showLinks);
      showLinks();
      cardBox.append(links);
      const files = make('input');
      files.type = 'file';
      files.multiple = true;
      const label = make('label', 'Załączniki (do 1 MB na plik)');
      label.append(files);
      const list = make('div');
      renderFiles(list, card);
      files.onchange = async () => {
        await importFiles(files.files, card, list);
        files.value = '';
      };
      const controls = make('div');
      controls.className = 'planner-actions';
      const destination = make('select');
      destination.setAttribute('aria-label', 'Przenieś kartę do kolumny');
      destination.add(new Option('Przenieś do kolumny…', ''));
      columns.forEach((other, i) => { if (i !== col) destination.add(new Option(other.name, i)); });
      destination.onchange = () => {
        if (destination.value === '') return;
        columns[col].cards.splice(idx, 1);
        columns[Number(destination.value)].cards.push(card);
        refresh();
      };
      if (columns.length > 1) controls.append(destination);
      controls.append(
        action('Wyżej', () => move(columns[col].cards, idx, idx - 1), idx === 0),
        action('Niżej', () => move(columns[col].cards, idx, idx + 1), idx === columns[col].cards.length - 1),
        action('Usuń kartę', () => {
          if (!window.confirm('Usunąć tę kartę razem z jej załącznikami?')) return;
          columns[col].cards.splice(idx, 1);
          refresh();
        })
      );
      cardBox.append(list, label, controls);
      drop(cardBox, col, idx);
      return cardBox;
    }
    function render() {
      host.replaceChildren();
      columns.forEach((column, col) => {
        const block = make('section');
        block.className = 'planner-column';
        const title = make('input');
        title.value = column.name;
        title.maxLength = 120;
        title.required = true;
        title.setAttribute('aria-label', 'Nazwa kolumny');
        title.oninput = () => { column.name = title.value; changed(); };
        title.onchange = () => {
          host.querySelectorAll('select option').forEach(option => {
            if (option.value === String(col)) option.textContent = column.name;
          });
        };
        const heading = make('div');
        heading.className = 'planner-column-title';
        heading.append(dragHandle('column', col), title);
        block.append(heading);
        column.cards.forEach((card, idx) => block.append(renderCard(card, col, idx)));
        const controls = make('div');
        controls.className = 'planner-actions';
        controls.append(
          action('Dodaj kartę', () => {
            column.cards.push({ title: '', notes: '', files: [] });
            refresh();
            host.children[col].querySelector('.planner-card:last-of-type input').focus();
          }),
          action('W lewo', () => move(columns, col, col - 1), col === 0),
          action('W prawo', () => move(columns, col, col + 1), col === columns.length - 1),
          action('Usuń kolumnę', () => {
            if (!window.confirm('Usunąć kolumnę razem z jej kartami?')) return;
            columns.splice(col, 1);
            refresh();
          })
        );
        block.append(controls);
        drop(block, col);
        host.append(block);
      });
    }
    for (const name of ['Pomysły na książki', 'Pomysły na nisze', 'Słowa kluczowe', 'Moje książki', 'Konkurencja']) {
      addColumn.querySelector('datalist').append(new Option(name));
    }
    const newName = addColumn.querySelector('input');
    function add() {
      if (!newName.value.trim()) {
        newName.focus();
        tellUser('Wpisz nazwę kolumny lub wybierz podpowiedź.');
        return;
      }
      columns.push({ name: newName.value.trim(), cards: [] });
      newName.value = '';
      refresh();
    }
    addColumn.querySelector('button').onclick = add;
    newName.onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); add(); }
    };
    return {
      reset(value) { columns = value; newName.value = ''; render(); },
      data() { return columns; },
      busy() { return uploads > 0; }
    };
  }

  window.WingmanTools ||= {};
  window.WingmanTools.planner = function renderPlanner(root) {
    root.innerHTML = `
      <p>Zbieraj pomysły, słowa kluczowe i materiały na kartach. Zapisane plany pozostają w tej przeglądarce na tym urządzeniu.</p>
      <label>Twoje plany <select data-picker><option value="">Nowy plan</option></select></label>
      <form data-editor>
        <label>Tytuł roboczy <input name="title" type="text" maxlength="240" required></label>
        <label>Planowana data premiery <input name="release" type="date"></label>
        <label>Plan treści <textarea name="outline" rows="4" placeholder="Dla kogo piszesz? Jakie rozdziały lub ćwiczenia znajdą się w książce?"></textarea></label>
        <fieldset><legend>Tablica projektu</legend>
          <div data-add-column><label>Nazwa nowej kolumny
            <input list="wingman-planner-columns" maxlength="120" placeholder="np. Pomysły na książki">
            <datalist id="wingman-planner-columns"></datalist></label>
            <button type="button">Dodaj kolumnę</button></div>
          <div data-board></div>
        </fieldset>
        <fieldset><legend>Harmonogram</legend>
          <p data-progress></p>
          <div data-tasks></div>
          <button type="button" data-add>Dodaj zadanie</button>
        </fieldset>
        <button type="submit">Zapisz plan</button>
        <button type="button" data-delete hidden>Usuń plan</button>
      </form>
      <p data-feedback role="status" aria-live="polite"></p>`;

    const picker = root.querySelector('[data-picker]');
    const form = root.querySelector('[data-editor]');
    const tasks = form.querySelector('[data-tasks]');
    const progress = form.querySelector('[data-progress]');
    const feedback = root.querySelector('[data-feedback]');
    const removePlan = form.querySelector('[data-delete]');
    let selectedKey = '';
    let snapshot = null;
    let dirty = false;
    const board = createBoard(form.querySelector('[data-board]'), form.querySelector('[data-add-column]'),
      message => { feedback.textContent = message; },
      () => { dirty = true; feedback.textContent = 'Niezapisane zmiany.'; });

    function updateProgress() {
      const finished = tasks.querySelectorAll('[name="done"]:checked').length;
      progress.textContent = `Ukończone zadania: ${finished} z ${tasks.children.length}`;
    }

    function addTask(task) {
      const row = document.createElement('div');
      row.className = 'planner-task';
      row.innerHTML = `<label><input type="checkbox" name="done"> Gotowe</label>
        <label>Nazwa zadania <input name="taskName" maxlength="240" required></label>
        <label>Termin <input name="taskDate" type="date"></label>
        <button type="button">Usuń zadanie</button>`;
      row.querySelector('[name="done"]').checked = task.done;
      const name = row.querySelector('[name="taskName"]');
      name.value = task.name;
      row.querySelector('[name="taskDate"]').value = task.date;
      row.querySelector('button').onclick = () => {
        row.remove();
        dirty = true;
        updateProgress();
        form.querySelector('[data-add]').focus();
      };
      tasks.append(row);
      return name;
    }

    function showPlan(key, raw, plan) {
      selectedKey = key;
      snapshot = raw;
      dirty = false;
      picker.value = key;
      form.elements.title.value = plan.title;
      form.elements.release.value = plan.release;
      form.elements.outline.value = plan.outline;
      board.reset(plan.columns);
      tasks.replaceChildren();
      plan.tasks.forEach(addTask);
      updateProgress();
      removePlan.hidden = !key;
    }

    function listPlans() {
      const choices = [];
      let skipped = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          choices.push([key, readPlan(localStorage.getItem(key)).title]);
        } catch {
          skipped++;
        }
      }
      choices.sort((a, b) => a[1].localeCompare(b[1], 'pl'));
      picker.replaceChildren(new Option('Nowy plan', ''));
      for (const [key, title] of choices) picker.add(new Option(title, key));
      picker.value = selectedKey;
      if (skipped) feedback.textContent = 'Nie udało się odczytać części zapisanych planów.';
    }

    picker.onchange = () => {
      const key = picker.value;
      if (dirty && !window.confirm('Odrzucić niezapisane zmiany w tym planie?')) {
        picker.value = selectedKey;
        return;
      }
      try {
        const raw = key ? localStorage.getItem(key) : null;
        showPlan(key, raw, key ? readPlan(raw) : newPlan());
        feedback.textContent = '';
      } catch {
        picker.value = selectedKey;
        feedback.textContent = 'Nie udało się otworzyć tego planu. Mógł zostać usunięty w innej karcie.';
      }
    };

    form.oninput = () => {
      dirty = true;
      feedback.textContent = 'Niezapisane zmiany.';
      updateProgress();
    };
    form.querySelector('[data-add]').onclick = () => {
      addTask({ name: '', date: '', done: false }).focus();
      dirty = true;
      updateProgress();
    };

    function changedElsewhere() {
      if (selectedKey && localStorage.getItem(selectedKey) !== snapshot) {
        feedback.textContent = 'Plan zmienił się w innej karcie. Otwórz go ponownie, aby wczytać aktualną wersję.';
        return true;
      }
      return false;
    }

    form.onsubmit = event => {
      event.preventDefault();
      if (board.busy()) {
        feedback.textContent = 'Poczekaj na wczytanie załącznika i zapisz plan ponownie.';
        return;
      }
      const title = form.elements.title;
      const names = tasks.querySelectorAll('[name="taskName"]');
      for (const input of [title, ...names]) {
        input.value = input.value.trim();
        if (!input.reportValidity()) return;
      }
      const plan = {
        title: title.value, release: form.elements.release.value, outline: form.elements.outline.value,
        columns: board.data(),
        tasks: Array.from(tasks.children, row => ({
          name: row.querySelector('[name="taskName"]').value,
          date: row.querySelector('[name="taskDate"]').value,
          done: row.querySelector('[name="done"]').checked
        }))
      };
      try {
        if (changedElsewhere()) return;
        const key = selectedKey || prefix + crypto.randomUUID();
        const raw = JSON.stringify(plan);
        localStorage.setItem(key, raw);
        selectedKey = key;
        snapshot = raw;
        dirty = false;
        removePlan.hidden = false;
        feedback.textContent = 'Zapisano plan na tym urządzeniu.';
        listPlans();
      } catch {
        feedback.textContent = 'Nie udało się zapisać planu. Sprawdź, czy przeglądarka zezwala na zapis danych i ma wolne miejsce.';
      }
    };
    removePlan.onclick = () => {
      if (!selectedKey || !window.confirm('Usunąć ten plan z tego urządzenia?')) return;
      try {
        if (changedElsewhere()) return;
        localStorage.removeItem(selectedKey);
        showPlan('', null, newPlan());
        feedback.textContent = 'Usunięto plan.';
        listPlans();
      } catch {
        feedback.textContent = 'Nie udało się usunąć planu.';
      }
    };
    showPlan('', null, newPlan());
    try {
      listPlans();
    } catch {
      feedback.textContent = 'Pamięć przeglądarki jest niedostępna. Możesz zaplanować książkę na czas tej wizyty.';
    }
  };
})();
