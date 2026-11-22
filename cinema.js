(() => {
  'use strict';

  const capacity = 44;
  const seatsPerRow = 11;
  const audience = document.getElementById('audience');
  const currency = new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN'});
  const roomList = document.getElementById('cinema-rooms');
  const flights = document.getElementById('cinema-flights');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let previous = [];
  let frame = 0;

  function createRoom(index) {
    const room = document.createElement('article');
    room.className = 'auditorium';
    room.hidden = true;

    const heading = document.createElement('h4');
    heading.textContent = 'Sala ' + String(index + 1).padStart(2, '0');
    const tally = document.createElement('span');
    tally.className = 'auditorium-tally';
    heading.append(tally);
    const screen = document.createElement('div');
    screen.className = 'cinema-screen';
    screen.textContent = 'Ekran';

    const rows = document.createElement('div');
    rows.className = 'cinema-rows';
    rows.setAttribute('aria-hidden', 'true');
    const seats = [];
    for (let offset = 0; offset < capacity; offset += seatsPerRow) {
      const row = document.createElement('div');
      row.className = 'cinema-row';
      for (let column = 0; column < seatsPerRow; column++) {
        const seat = document.createElement('span');
        seat.className = 'cinema-seat';
        seat.textContent = offset + column + 1;
        row.append(seat);
        seats.push(seat);
      }
      rows.append(row);
    }
    room.append(heading, screen, rows);
    roomList.append(room);
    return {room, seats, tally};
  }

  const rooms = Array.from({length: Math.ceil(Number(audience.max) / capacity)}, (_, index) => createRoom(index));

  function distribution(total) {
    const count = Math.ceil(total / capacity);
    const base = Math.floor(total / count);
    return Array.from({length: count}, (_, i) => base + Number(i < total % count));
  }

  // Seats that switch off in an existing room are the people who move.
  function movingSeats(before, after) {
    return rooms.flatMap(({seats}, i) => seats.slice(after[i] || 0, before[i] || 0));
  }

  function animateTransfer(origins, destinations) {
    if (!origins.length || !destinations.length) return;
    const layer = flights.getBoundingClientRect();
    const targets = destinations.slice(0, origins.length).map(seat => seat.getBoundingClientRect());
    const fragment = document.createDocumentFragment();
    targets.forEach((target, i) => {
      const source = origins[i];
      const x = source.left + source.width / 2 - layer.left;
      const y = source.top + source.height / 2 - layer.top;
      const dx = target.left + target.width / 2 - layer.left - x;
      const dy = target.top + target.height / 2 - layer.top - y;
      const dot = document.createElement('i');
      dot.className = 'cinema-traveller';
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      fragment.append(dot);
      const move = dot.animate([
        {transform:'translate(-50%, -50%) scale(.6)', opacity:0},
        {transform:'translate(-50%, -50%)', opacity:1, offset:.12},
        {transform:'translate(' + (dx / 2 - 3) + 'px,' + (dy / 2 - 24) + 'px)', opacity:.95, offset:.5},
        {transform:'translate(' + (dx - 3) + 'px,' + (dy - 3) + 'px) scale(.6)', opacity:0}
      ], {duration:620, delay:(i % 9) * 18, easing:'ease-in-out'});
      move.onfinish = () => dot.remove();
    });
    flights.append(fragment);
  }

  function renderPrice(people, accounts) {
    const exchangeRate = 4;
    const soloPrice = 359 * exchangeRate;
    const accountPriceGrosze = Math.round(287.2 * exchangeRate * 100);
    const groupPriceGrosze = accountPriceGrosze * accounts;
    const groupPrice = groupPriceGrosze / 100;
    const heliumShare = Math.round(groupPriceGrosze / people) / 100;
    const serviceFee = 10;
    const deposit = 75;
    const seatPrice = heliumShare + serviceFee;
    const refund = Math.max(0, deposit - seatPrice);
    const format = amount => currency.format(amount);

    document.getElementById('share-price').textContent = format(seatPrice);
    document.getElementById('refund').textContent = format(refund);
    document.getElementById('deposit-note').hidden = seatPrice <= deposit;
    document.getElementById('helium-share').textContent = format(heliumShare);
    document.getElementById('service-fee').textContent = format(serviceFee);
    const accountLabel = ['1 konto', '2 konta', '3 konta · symulacja'][accounts - 1];
    document.getElementById('account-count').textContent = '(' + accountLabel + ')';
    document.getElementById('helium-total').textContent = format(groupPrice);
    document.getElementById('solo-price').textContent = format(soloPrice) + ' / mies.';

    const savings = soloPrice - seatPrice;
    const remainder = savings - 600;
    document.getElementById('publishing-budget').textContent =
      'W porównaniu z samodzielnym planem oszczędzasz ' + format(savings) + ' miesięcznie.' +
      (remainder >= 0 ? ' Po takim teście zostałoby ' + format(remainder) + '.' : '');
  }

  function render() {
    frame = 0;
    const total = Number(audience.value);
    const next = distribution(total);
    renderPrice(total, next.length);
    const transfer = previous.length && previous.length !== next.length && !reducedMotion.matches;
    const origins = transfer ? movingSeats(previous, next).map(seat => seat.getBoundingClientRect()) : [];
    if (previous.length !== next.length) flights.replaceChildren();
    rooms.forEach(({room, tally, seats}, i) => {
      const filled = next[i] || 0;
      room.hidden = i >= next.length;
      if (room.hidden) return;
      tally.textContent = filled + ' / ' + capacity;
      tally.setAttribute('aria-label', 'Zajęte miejsca: ' + filled + ' z ' + capacity);
      seats.forEach((seat, j) => seat.classList.toggle('occupied', j < filled));
    });
    roomList.dataset.rooms = next.length;
    document.getElementById('audience-number').value = total;
    let summary = next.length === 1 ? 'Jedna sala' : next.length === 2 ? 'Dwie sale' : 'Trzy sale (symulacja)';
    summary += ' · ' + next.join(' + ') + (next.length === 1 ? ' / 44' : ' = ' + total);
    document.getElementById('cinema-summary').textContent = summary + ' · Miejsce: ' +
      document.getElementById('share-price').textContent + ' · Zwrot: ' + document.getElementById('refund').textContent;
    if (transfer) animateTransfer(origins, movingSeats(next, previous));
    previous = next;
  }

  function scheduleRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  audience.addEventListener('input', scheduleRender);
  document.querySelectorAll('[data-audience]').forEach(button => {
    button.addEventListener('click', () => {
      audience.value = button.dataset.audience;
      scheduleRender();
    });
  });
  render();
})();
