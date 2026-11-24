// Schatzsuche – App-Logik (Version 1, Stand 23.11.2026)
{
  const $ = id => document.getElementById(id);
  const KEY = 'schatzsuche';
  const RCOL = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)'];
  const RHEX = ['#b8c0cc', '#4fa3ff', '#b072ff', '#ffc23d'];

  // Dauer → Luftlinie (m) und Seltenheits-Chancen [gewöhnlich, selten, episch, legendär]
  const DAUER = {
    10: { m: 350, p: [80, 20, 0, 0] },
    20: { m: 700, p: [50, 50, 0, 0] },
    30: { m: 1000, p: [0, 85, 15, 0] },
    45: { m: 1500, p: [0, 60, 35, 5] },
    60: { m: 2000, p: [0, 0, 80, 20] }
  };
  const KURZ_M = 50, MAX_ACC_KURZ = 30, NAH_M = 30, MAX_ACC_ZIEL = 50;

  // ---------- Speicher ----------
  let S = { homes: [], finds: [], recent: [], active: null };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
  // Umzug aus Version 1: ein einzelnes Zuhause wird zum Startpunkt „Wohnung“
  if (S.home) { S.homes = [{ name: 'Wohnung', lat: S.home.lat, lon: S.home.lon }, ...S.homes]; delete S.home; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const foundToday = kind => S.finds.some(f => f.kind === kind && dayKey(new Date(f.t)) === dayKey());

  // ---------- Hilfen ----------
  let toastT;
  const toast = msg => {
    $('toast').textContent = msg; $('toast').classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.remove('on'), 2600);
  };
  const copy = async txt => {
    try { await navigator.clipboard.writeText(txt); toast('Kopiert ✓'); }
    catch (e) { toast('Kopieren nicht möglich – bitte markieren und kopieren'); }
  };
  const dist = (a, b) => {
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const offset = (p, m, deg) => {
    const b = deg * Math.PI / 180;
    return { lat: p.lat + (m * Math.cos(b)) / 111320, lon: p.lon + (m * Math.sin(b)) / (111320 * Math.cos(p.lat * Math.PI / 180)) };
  };
  const fmtM = m => m >= 1000 ? (Math.round(m / 100) / 10).toLocaleString('de-DE') + ' km' : Math.round(m / 10) * 10 + ' m';
  const getPos = (frisch = false) => new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Dieser Browser kann keinen Standort liefern.'));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      e => rej(new Error(e.code === 1 ? 'Standort nicht erlaubt. Bitte in den Browser-Einstellungen freigeben.' : 'Standort gerade nicht verfügbar.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: frisch ? 0 : 5000 });
  });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Bildschirme ----------
  let watchId = null;
  const stopWatch = () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null; };
  const show = id => {
    stopWatch();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'start') renderStart();
    if (id === 'funde') renderFunde();
    if (id === 'wahl') renderWahl();
    if (id === 'set') renderSet();
  };
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

  // ---------- Wetter ----------
  let WX = null; // { pool, label, temp, at }
  const wetter = async p => {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}` +
      '&current=temperature_2m,weather_code,is_day&timezone=auto';
    const r = await fetch(u);
    if (!r.ok) throw new Error('Wetter ' + r.status);
    const c = (await r.json()).current, w = c.weather_code, t = c.temperature_2m;
    const snow = (w >= 71 && w <= 77) || w === 85 || w === 86;
    const rain = (w >= 51 && w <= 67) || (w >= 80 && w <= 82) || w >= 95; // Gewitter zählt wie Regen
    const fog = w === 45 || w === 48;
    const pool = snow ? 'schnee' : t > 30 ? 'hitze' : rain ? 'regen' : fog ? 'nebel' : t <= 0 ? 'frost' : !c.is_day ? 'dunkel' : 'normal';
    WX = { pool, temp: t, at: Date.now() };
    return WX;
  };
  const wetterFrisch = async p => (WX && Date.now() - WX.at < 10 * 60000) ? WX : wetter(p);
  const HINTS = {
    normal: 'Ganz normales Wetter. Perfekt für eine Runde.',
    regen: 'Es regnet! Jetzt gibt es Regen-Funde, die es sonst nie gibt.',
    nebel: 'Nebel! Nebelperlen und Irrlichter warten draußen.',
    frost: 'Frost! Eiskristalle und Raureif sind unterwegs.',
    schnee: 'SCHNEE! Das passiert hier fast nie. Los, raus!',
    hitze: 'Über 30 Grad. Phönixfedern lieben das.',
    dunkel: 'Es ist dunkel. Nachts gibt es Mondsteine und Sternschnuppen.'
  };

  // ---------- Fund erzeugen ----------
  const AL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const check = s => AL[[...s].reduce((a, ch, i) => a + AL.indexOf(ch) * (i + 1), 0) % 32];
  const makeCode = id => {
    const day = Math.floor((Date.now() - new Date(2026, 0, 1)) / 864e5) & 1023;
    let b = AL[id >> 5] + AL[id & 31] + AL[day >> 5] + AL[day & 31];
    for (let i = 0; i < 4; i++) b += AL[Math.floor(Math.random() * 32)];
    return `GP-${b.slice(0, 4)}-${b.slice(4)}-${check(b)}`;
  };
  const rollR = p => {
    let x = Math.random() * 100;
    for (let i = 0; i < 4; i++) { if (x < p[i]) return i; x -= p[i]; }
    return 0;
  };
  const pickItem = (pool, r) => {
    for (let rr = r; rr >= 0; rr--) {
      const c = KATALOG.filter(k => k.pool === pool && k.r === rr);
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    return pickItem('normal', r);
  };
  const addFind = (kind, pool, r, extra = {}) => {
    const it = pickItem(pool, r);
    const f = { t: Date.now(), kind, id: it.id, r: it.r, pool, code: makeCode(it.id), ...extra };
    S.finds.push(f); save();
    return f;
  };

  // ---------- Enthüllung ----------
  const konfetti = col => {
    for (let i = 0; i < 46; i++) {
      const k = document.createElement('i');
      k.className = 'konf';
      k.style.left = '50%'; k.style.top = '45%';
      k.style.background = [col, '#ff6fa5', '#2ec4b6', '#ff9f43', '#fff'][i % 5];
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
      k.style.setProperty('--dx', Math.cos(a) * d + 'px');
      k.style.setProperty('--dy', Math.sin(a) * d + 160 + 'px');
      k.style.setProperty('--rot', Math.random() * 720 + 'deg');
      document.body.appendChild(k);
      setTimeout(() => k.remove(), 1700);
    }
  };
  const reveal = (f, onClose) => {
    const R = $('reveal');
    R.innerHTML = `<div><button class="chestbtn" id="chestBtn" aria-label="Truhe öffnen"><svg viewBox="0 0 120 100"><use href="#chest"/></svg></button>
      <div class="tap">Tippe auf die Truhe</div></div>`;
    R.classList.add('on');
    $('chestBtn').onclick = () => {
      const it = KATALOG.find(k => k.id === f.id), P = POOLS[f.pool];
      konfetti(RHEX[it.r]);
      if (navigator.vibrate) navigator.vibrate(it.r >= 2 ? [60, 40, 120] : 40);
      R.innerHTML = `<div class="card">
        <div class="glow" style="background:${RCOL[it.r]}"></div>
        <span class="rar" style="background:${RCOL[it.r]}">${SELTENHEIT[it.r]}</span>
        <div class="big-ic">${it.icon}</div>
        <h2>${esc(it.name)}</h2>
        <div class="mute small">${P.icon} ${P.name}-Fund · ${f.kind === 'kurz' ? 'Kurz raus' : 'Expedition ' + f.min + ' Min'}</div>
        <p>${esc(it.text)}</p>
        <span class="code">${f.code}</span>
        <div class="row"><button class="primary" id="cpy">📋 Code kopieren</button></div>
        <p class="small mute">Den Code im Fundbüro von Greatopolis einlösen. Er bleibt unter „Meine Funde“ gespeichert.</p>
        <button class="ghost" id="closeR" style="width:100%">Fertig</button></div>`;
      $('cpy').onclick = () => copy(f.code);
      $('closeR').onclick = () => { R.classList.remove('on'); R.innerHTML = ''; onClose && onClose(); };
    };
  };
  const nurGelaufen = (txt, onClose) => {
    const R = $('reveal');
    R.innerHTML = `<div class="card"><div class="big-ic">🥾</div><h2>Ziel erreicht!</h2><p>${txt}</p>
      <button class="ghost" id="closeR" style="width:100%">Fertig</button></div>`;
    R.classList.add('on'); konfetti('#2ec4b6');
    $('closeR').onclick = () => { R.classList.remove('on'); R.innerHTML = ''; onClose && onClose(); };
  };

  // ---------- Start ----------
  const renderStart = () => {
    const k = foundToday('kurz'), e = foundToday('exp');
    // Haken direkt im Button: Tagesfund dieser Art schon eingesammelt
    $('goKurz').classList.toggle('done', k);
    $('goExp').classList.toggle('done', e);
    if (S.active) {
      $('goExp').querySelector('b').textContent = 'Expedition fortsetzen';
      $('goExp').querySelector('span').textContent = 'Dein Ziel wartet noch auf dich';
    } else {
      $('goExp').querySelector('b').textContent = 'Expedition';
      $('goExp').querySelector('span').textContent = 'Ziel auf der Karte · je länger, desto seltener';
    }
    getPos().then(wetterFrisch).then(w => {
      $('wx').textContent = `${POOLS[w.pool].icon} ${POOLS[w.pool].name} · ${Math.round(w.temp)} °C`;
      $('wxHint').textContent = HINTS[w.pool];
    }).catch(err => { $('wx').textContent = '🧭 Wetter gerade unbekannt'; $('wxHint').textContent = err.message; });
  };
  $('goKurz').onclick = () => startKurz();
  $('goExp').onclick = () => S.active ? openKarte() : show('wahl');
  $('goFunde').onclick = () => show('funde');
  $('goSet').onclick = () => show('set');

  // ---------- Startpunkte ----------
  // Startpunkte (Wohnung, Schmaggo …) bleiben nur auf diesem Handy. „Kurz raus“ misst vom nächstgelegenen.
  const naechster = p => S.homes.reduce((b, h) => { const d = dist(p, h); return !b || d < b.d ? { h, d } : b; }, null);
  const posHier = async () => {
    const p = await getPos(true);
    if (p.acc > 60) toast(`Achtung: GPS ungenau (± ${Math.round(p.acc)} m). Ggf. gleich nochmal festlegen.`);
    return p;
  };
  $('setHome').onclick = async () => {
    $('setHome').disabled = true; $('setupMsg').textContent = 'Frage Standort ab …';
    try {
      const p = await posHier();
      S.homes = [{ name: 'Wohnung', lat: p.lat, lon: p.lon }]; save();
      $('setupMsg').textContent = `Gespeichert (Genauigkeit ± ${Math.round(p.acc)} m).`;
      setTimeout(() => show('start'), 700);
    } catch (e) { $('setupMsg').textContent = e.message; }
    $('setHome').disabled = false;
  };
  const renderSet = () => {
    $('homes').innerHTML = S.homes.map((h, i) => `<div class="hrow"><span>🏠 ${esc(h.name)}</span>
      <button class="copy" data-neu="${i}">📍 hier neu</button>
      ${S.homes.length > 1 ? `<button class="copy" data-del="${i}">🗑️</button>` : ''}</div>`).join('');
    $('homes').querySelectorAll('[data-neu]').forEach(b => b.onclick = async () => {
      try { const p = await posHier(), h = S.homes[+b.dataset.neu]; h.lat = p.lat; h.lon = p.lon; save(); toast(`„${h.name}“ neu festgelegt`); }
      catch (e) { toast(e.message); }
    });
    $('homes').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const i = +b.dataset.del;
      if (b.dataset.armed) { S.homes.splice(i, 1); save(); renderSet(); return; }
      b.dataset.armed = 1; b.textContent = 'Sicher?';
    });
  };
  $('addHome').onclick = async () => {
    const name = $('homeName').value.trim();
    if (!name) return toast('Bitte zuerst einen Namen eingeben, z. B. „Schmaggo“.');
    try { const p = await posHier(); S.homes.push({ name, lat: p.lat, lon: p.lon }); save(); $('homeName').value = ''; renderSet(); toast(`„${name}“ gespeichert`); }
    catch (e) { toast(e.message); }
  };

  // ---------- Kurz raus ----------
  const startKurz = () => {
    show('kurz');
    if (foundToday('kurz')) {
      $('kurzText').textContent = 'Den Kurz-raus-Fund für heute hast du schon. Morgen wartet der nächste! Eine Expedition geht natürlich trotzdem.';
      $('kurzDist').textContent = '✓ Erledigt'; $('kurzAcc').textContent = ''; $('kurzBar').style.width = '100%';
      $('kurzCollect').disabled = true;
      return;
    }
    $('kurzText').textContent = `Geh mindestens ${KURZ_M} m von deinem Startpunkt weg. Sobald du weit genug draußen bist, kannst du deinen Fund einsammeln.`;
    $('kurzDist').textContent = 'Suche Standort …';
    let last = null;
    const upd = p => {
      last = p;
      const n = naechster(p), d = n.d, ok = d >= KURZ_M && p.acc <= MAX_ACC_KURZ;
      $('kurzBar').style.width = Math.min(100, d / KURZ_M * 100) + '%';
      $('kurzDist').textContent = d >= KURZ_M ? 'Du bist draußen! 🌿' : `noch ${Math.max(1, Math.ceil(KURZ_M - d))} m`;
      $('kurzAcc').textContent = (p.acc > MAX_ACC_KURZ ? `GPS noch ungenau (± ${Math.round(p.acc)} m) – kurz warten …` : `Genauigkeit ± ${Math.round(p.acc)} m`) + ` · gemessen ab „${n.h.name}“`;
      $('kurzCollect').disabled = !ok;
    };
    watchId = navigator.geolocation.watchPosition(
      q => upd({ lat: q.coords.latitude, lon: q.coords.longitude, acc: q.coords.accuracy }),
      e => { $('kurzDist').textContent = 'Kein Standort'; $('kurzAcc').textContent = e.message; },
      { enableHighAccuracy: true, maximumAge: 2000 });
    $('kurzCollect').onclick = async () => {
      if (!last || foundToday('kurz')) return;
      $('kurzCollect').disabled = true;
      let pool = 'normal';
      try { pool = (await wetterFrisch(last)).pool; } catch (e) {}
      const f = addFind('kurz', pool, 0);
      stopWatch();
      reveal(f, () => show('start'));
    };
  };
  $('kurzBack').onclick = () => show('start');

  // ---------- Expedition wählen ----------
  const renderWahl = () => {
    const done = foundToday('exp');
    $('wahlInfo').textContent = done
      ? 'Den Expeditions-Fund für heute hast du schon. Laufen lohnt sich trotzdem, einen weiteren Fund gibt es aber erst morgen.'
      : 'Hin und zurück, ungefähr. Je länger, desto seltener der Fund.';
    $('durs').innerHTML = Object.entries(DAUER).map(([min, d]) => `
      <button class="dur" data-min="${min}"><b>${min} Min</b><span>Ziel ca. ${fmtM(d.m)} entfernt</span>
      <div class="odds">${d.p.map((p, i) => p ? `<i class="dot" style="background:${RCOL[i]};opacity:${0.35 + p / 100}" title="${SELTENHEIT[i]} ${p} %"></i>` : '').join('')}</div></button>`).join('');
    $('durs').querySelectorAll('.dur').forEach(b => b.onclick = () => startExp(+b.dataset.min));
    $('wahlMsg').textContent = '';
    $('wahlLade').hidden = true;
  };

  // ---------- Zielsuche ----------
  // Vorerst nur ein Punkt in passender Entfernung; die Suche nach markanten Orten ist pausiert.
  const waehleZiel = (p, min) => {
    const m = DAUER[min].m;
    const z = offset(p, m * (0.85 + Math.random() * 0.3), Math.random() * 360);
    return { ...z, key: 'ziel' + Date.now(), text: 'Schatz' };
  };
  const startExp = async min => {
    $('wahlMsg').textContent = '🧭 Suche Standort …';
    $('wahlLade').hidden = false;
    $('durs').querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      const p = await getPos();
      const z = waehleZiel(p, min);
      S.active = { min, start: Date.now(), wuerfel: MAX_WUERFEL, ziel: z };
      save();
      openKarte();
    } catch (e) {
      $('wahlMsg').textContent = e.message;
      $('wahlLade').hidden = true;
      $('durs').querySelectorAll('button').forEach(b => b.disabled = false);
    }
  };

  // ---------- Karte ----------
  const MAX_WUERFEL = 3;
  // ältere Spielstände hatten nur reroll: true/false
  const wuerfelRest = A => A.wuerfel ?? (A.reroll ? MAX_WUERFEL - 1 : MAX_WUERFEL);
  const zeigeWuerfel = () => {
    const rest = S.active ? wuerfelRest(S.active) : 0;
    $('reroll').disabled = rest <= 0;
    $('reroll').textContent = rest > 0 ? `🎲 Anderes Ziel (${rest}×)` : '🎲 Keine Würfe';
    $('rerollHinweis').hidden = rest > 0;
  };
  let map = null, zielM = null, ichM = null, accC = null, ich = null, erstFix = true;
  const chestIcon = () => L.divIcon({ className: 'chest-ic', html: '<svg viewBox="0 0 120 100" width="46" height="40"><use href="#chest"/></svg>', iconSize: [46, 40], iconAnchor: [23, 36] });
  const openKarte = () => {
    show('karte');
    const A = S.active, z = A.ziel;
    if (!map) {
      map = L.map('map', { zoomControl: false, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 50);
    if (zielM) zielM.remove();
    zielM = L.marker([z.lat, z.lon], { icon: chestIcon() }).addTo(map);
    map.setView([z.lat, z.lon], 16);
    erstFix = true;
    $('ort').textContent = `🎯 Expedition ${A.min} Min · folge der Truhe auf der Karte`;
    zeigeWuerfel(); $('kartLade').hidden = true;
    $('dist').textContent = 'Suche Standort …'; $('dist').classList.remove('nah');
    $('collect').disabled = true;
    stopWatch(); // sonst läuft nach jedem Neuwürfeln eine weitere Standortverfolgung mit
    watchId = navigator.geolocation.watchPosition(
      q => updKarte({ lat: q.coords.latitude, lon: q.coords.longitude, acc: q.coords.accuracy }),
      e => { $('dist').textContent = 'Kein Standort'; $('acc').textContent = e.message; },
      { enableHighAccuracy: true, maximumAge: 2000 });
  };
  const updKarte = p => {
    ich = p;
    const z = S.active && S.active.ziel; if (!z) return;
    if (!$('kartLade').hidden) return; // während ein neues Ziel gesucht wird, nichts überschreiben
    if (!ichM) {
      ichM = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: '<div class="youdot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
      accC = L.circle([p.lat, p.lon], { radius: p.acc, color: '#2f80ff', weight: 1, fillOpacity: .08 }).addTo(map);
    } else { ichM.setLatLng([p.lat, p.lon]); accC.setLatLng([p.lat, p.lon]).setRadius(p.acc); }
    if (erstFix) { map.fitBounds(L.latLngBounds([[p.lat, p.lon], [z.lat, z.lon]]).pad(0.25)); erstFix = false; }
    const d = dist(p, z), nah = d <= NAH_M && p.acc <= MAX_ACC_ZIEL;
    $('dist').textContent = nah ? 'Hier irgendwo! 🎁' : d <= NAH_M ? 'Fast da …' : 'noch ca. ' + fmtM(d);
    $('dist').classList.toggle('nah', nah);
    $('acc').textContent = `Luftlinie · GPS ± ${Math.round(p.acc)} m`;
    $('collect').disabled = !nah;
  };
  $('center').onclick = () => { if (ich) map.setView([ich.lat, ich.lon], 17); };
  $('reroll').onclick = async () => {
    if (!S.active || wuerfelRest(S.active) <= 0) return;
    $('reroll').disabled = true; $('collect').disabled = true; $('kartLade').hidden = false;
    $('dist').textContent = 'Suche neues Ziel …'; $('dist').classList.remove('nah');
    try {
      const p = ich || await getPos();
      const z = waehleZiel(p, S.active.min);
      S.active.wuerfel = wuerfelRest(S.active) - 1; delete S.active.reroll;
      S.active.ziel = z;
      save(); openKarte();
    } catch (e) { toast(e.message); $('kartLade').hidden = true; zeigeWuerfel(); }
  };
  $('abort').onclick = () => $('frage').classList.add('on');
  $('frageNein').onclick = () => $('frage').classList.remove('on');
  $('frageJa').onclick = () => {
    $('frage').classList.remove('on');
    S.active = null; save(); show('start');
  };

  $('collect').onclick = async () => {
    const A = S.active; if (!A || !ich) return;
    $('collect').disabled = true;
    stopWatch();
    if (foundToday('exp')) {
      S.active = null; save();
      return nurGelaufen('Den Expeditions-Fund für heute hattest du schon, aber jeder Meter zählt. Morgen gibt es wieder etwas!', () => show('start'));
    }
    let pool = 'normal';
    try { pool = (await wetterFrisch(ich)).pool; } catch (e) {}
    const f = addFind('exp', pool, rollR(DAUER[A.min].p), { min: A.min, ort: A.ziel.text });
    S.active = null; save();
    reveal(f, () => show('start'));
  };
  // Nach dem Entsperren sofort neu prüfen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if ($('karte').classList.contains('on')) getPos().then(updKarte).catch(() => {});
  });

  // ---------- Meine Funde ----------
  const renderFunde = () => {
    const ids = new Set(S.finds.map(f => f.id));
    $('stats').innerHTML = `<div class="stat"><b>${S.finds.length}</b><span class="small mute">Funde gesamt</span></div>
      <div class="stat"><b>${ids.size} / ${KATALOG.length}</b><span class="small mute">verschiedene Stücke</span></div>`;
    if (!S.finds.length) { $('list').innerHTML = '<p class="mute">Noch keine Funde. Ab nach draußen!</p>'; return; }
    $('list').innerHTML = [...S.finds].reverse().map((f, i) => {
      const it = KATALOG.find(k => k.id === f.id) || { name: 'Unbekannt', icon: '❔', r: 0 };
      const d = new Date(f.t);
      return `<div class="find"><div class="ic">${it.icon}</div><div class="t">
        <b>${esc(it.name)}</b>
        <span class="rar" style="background:${RCOL[it.r]}">${SELTENHEIT[it.r]}</span>
        <span class="small mute"> ${POOLS[f.pool] ? POOLS[f.pool].icon : ''} ${d.toLocaleDateString('de-DE')} · ${pad(d.getHours())}:${pad(d.getMinutes())} · ${f.kind === 'kurz' ? 'Kurz raus' : 'Expedition ' + f.min + ' Min'}</span>
        <div class="code">${f.code}</div></div>
        <button class="copy" data-i="${S.finds.length - 1 - i}">📋</button></div>`;
    }).join('');
    $('list').querySelectorAll('.copy').forEach(b => b.onclick = () => copy(S.finds[+b.dataset.i].code));
  };

  // ---------- Sichern / Wiederherstellen ----------
  $('backup').onclick = () => copy(JSON.stringify({ app: 'schatzsuche', v: 1, finds: S.finds, recent: S.recent }));
  $('restore').onclick = () => {
    try {
      const o = JSON.parse($('restoreTxt').value);
      if (!o || !Array.isArray(o.finds)) throw 0;
      const have = new Set(S.finds.map(f => f.code));
      const neu = o.finds.filter(f => f && f.code && !have.has(f.code));
      S.finds = [...S.finds, ...neu].sort((a, b) => a.t - b.t);
      save(); $('restoreTxt').value = '';
      toast(`${neu.length} Funde wiederhergestellt`);
    } catch (e) { toast('Das sieht nicht nach einer Sicherung aus.'); }
  };

  // ---------- Los geht's ----------
  if (!S.homes.length) show('setup');
  else if (S.active) openKarte();
  else show('start');
}
