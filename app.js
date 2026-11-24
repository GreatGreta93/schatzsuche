// Schatzsuche – App-Logik (Version 1, Stand 23.11.2026)
{
  const $ = id => document.getElementById(id);
  const KEY = 'schatzsuche';
  const RCOL = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)'];
  const RHEX = ['#b8c0cc', '#4fa3ff', '#b072ff', '#ff8a2b'];

  // Dauer → Luftlinie (m) und Seltenheits-Chancen [gewöhnlich, selten, episch, legendär]
  const DAUER = {
    10: { m: 350, p: [80, 20, 0, 0] },
    20: { m: 700, p: [50, 50, 0, 0] },
    30: { m: 1000, p: [0, 85, 15, 0] },
    45: { m: 1500, p: [0, 60, 35, 5] },
    60: { m: 2000, p: [0, 0, 80, 20] }
  };
  const KURZ_M = 50, MAX_ACC_KURZ = 30, NAH_M = 30, MAX_ACC_ZIEL = 50;
  // Schatz heranholen: einmal pro Expedition, erst wenn man höchstens HERAN_MAX m entfernt ist.
  // Danach liegt er HERAN_REST m vor einem (sicher im Einsammel-Radius).
  const HERAN_MAX = 150, HERAN_REST = 15;
  const RUECK_MAX_H = 4; // so lange wartet „Bin zurück“, danach gilt der Rückweg als nicht erfasst

  // ---------- Speicher ----------
  // log: Expeditions-Protokoll; rueck: Index des Eintrags, der noch auf „Bin zurück“ wartet
  let S = { homes: [], finds: [], recent: [], active: null, log: [], rueck: null };
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
    if (id !== 'karte' && id !== 'kurz') wachAus(); // Bildschirm-an gilt nur während einer Suche
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    window.scrollTo(0, 0);
    if (id === 'start') renderStart();
    if (id === 'funde') renderFunde();
    if (id === 'wahl') renderWahl();
    if (id === 'set') renderSet();
    if (id === 'protokoll') renderLog();
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
      k.style.background = [col, '#e0679a', '#1fd1c4', '#f2b134', '#a7d98c'][i % 5];
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
        ${f.kind === 'exp' ? '<p class="small" style="color:var(--gold)">🏠 Zu Hause auf „Bin zurück“ tippen, dann wird die Dauer gemessen.</p>' : ''}
        <button class="ghost" id="closeR" style="width:100%">Fertig</button></div>`;
      $('cpy').onclick = () => copy(f.code);
      $('closeR').onclick = () => { R.classList.remove('on'); R.innerHTML = ''; onClose && onClose(); };
    };
  };
  const nurGelaufen = (txt, onClose) => {
    const R = $('reveal');
    R.innerHTML = `<div class="card"><div class="big-ic">🥾</div><h2>Ziel erreicht!</h2><p>${txt}</p>
      <button class="ghost" id="closeR" style="width:100%">Fertig</button></div>`;
    R.classList.add('on'); konfetti('#1fd1c4');
    $('closeR').onclick = () => { R.classList.remove('on'); R.innerHTML = ''; onClose && onClose(); };
  };

  // ---------- Start ----------
  const renderStart = () => {
    renderRueck();
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
      S.active = { min, start: Date.now(), wuerfel: MAX_WUERFEL, ziel: z, luft: Math.round(dist(p, z)) };
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
    zeigeHeran(d);
  };
  // Heranholen: nur in der Nähe, nur einmal pro Expedition
  const zeigeHeran = d => {
    const A = S.active, b = $('heran');
    if (!A || A.heran) { b.hidden = true; return; }
    b.hidden = d <= NAH_M;
    b.disabled = d > HERAN_MAX;
    b.textContent = d > HERAN_MAX ? `🧲 Heranholen ab ${HERAN_MAX} m Nähe` : '🧲 Schatz heranholen (1×)';
  };
  $('heran').onclick = () => {
    const A = S.active; if (!A || A.heran || !ich) return;
    const z = A.ziel, d = dist(ich, z);
    if (d > HERAN_MAX || d <= NAH_M) return;
    // auf der Linie zwischen mir und dem Schatz bis auf HERAN_REST m heranziehen
    const f = HERAN_REST / d;
    A.ziel = { ...z, lat: ich.lat + (z.lat - ich.lat) * f, lon: ich.lon + (z.lon - ich.lon) * f };
    A.heran = true; save();
    zielM.setLatLng([A.ziel.lat, A.ziel.lon]);
    map.setView([A.ziel.lat, A.ziel.lon], 18);
    if (navigator.vibrate) navigator.vibrate(60);
    toast('🧲 Der Schatz ist zu dir gerollt!');
    updKarte(ich);
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
    if (S.active) protokoll(S.active, 'abbruch');
    S.active = null; save(); show('start');
  };

  // ---------- Expeditions-Protokoll ----------
  // Ein Eintrag pro Expedition: Start, Ziel erreicht, zurück. Daraus Hinweg- und Gesamtdauer.
  const protokoll = (A, ende) => {
    const e = {
      start: A.start, min: A.min, luft: A.luft ?? null,
      wuerfel: MAX_WUERFEL - wuerfelRest(A), heran: !!A.heran,
      ende, ziel: ende === 'abbruch' ? null : Date.now(), abbruch: ende === 'abbruch' ? Date.now() : null, zurueck: null
    };
    S.log.push(e);
    S.rueck = ende === 'abbruch' ? null : S.log.length - 1;
    save();
  };
  const rueckOffen = () => {
    const e = S.rueck !== null && S.log[S.rueck];
    if (!e) return null;
    if (Date.now() - e.ziel > RUECK_MAX_H * 3600e3) { S.rueck = null; save(); return null; }
    return e;
  };
  const renderRueck = () => {
    const e = rueckOffen();
    $('rueck').hidden = !e;
    if (e) $('rueckTxt').textContent = `Expedition ${e.min} Min · Ziel erreicht um ${uhr(e.ziel)}. Tippe, sobald du wieder da bist – dann sehen wir, ob die Dauer passt.`;
  };
  $('rueckJa').onclick = () => {
    const e = rueckOffen(); if (!e) return renderRueck();
    e.zurueck = Date.now(); S.rueck = null; save();
    const g = Math.round((e.zurueck - e.start) / 60000);
    toast(`Willkommen zurück! ${g} Min statt geplanter ${e.min} Min`);
    renderRueck();
  };
  $('rueckNein').onclick = () => { S.rueck = null; save(); renderRueck(); };

  const uhr = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const minTxt = (a, b) => (a && b) ? Math.round((b - a) / 60000) + ' Min' : '–';
  const ENDE = { fund: 'Fund', gelaufen: 'ohne Fund', abbruch: 'abgebrochen' };
  const renderLog = () => {
    if (!S.log.length) { $('logList').innerHTML = '<p class="mute small">Noch keine Expedition protokolliert.</p>'; $('logCopy').hidden = true; return; }
    $('logCopy').hidden = false;
    $('logList').innerHTML = [...S.log].reverse().map(e => {
      const d = new Date(e.start);
      const ges = e.zurueck ? Math.round((e.zurueck - e.start) / 60000) : null;
      const abw = ges !== null ? ges - e.min : null;
      const abwTxt = abw === null ? '' : ` <span class="abw ${Math.abs(abw) <= e.min * 0.25 ? 'ok' : 'weg'}">${abw > 0 ? '+' : ''}${abw}</span>`;
      return `<div class="log"><b>${d.toLocaleDateString('de-DE')} · ${uhr(e.start)} · ${e.min} Min geplant</b>
        <div class="small mute">Ziel ${e.luft ? fmtM(e.luft) + ' Luftlinie' : '–'} · ${ENDE[e.ende]}${e.wuerfel ? ` · ${e.wuerfel}× gewürfelt` : ''}${e.heran ? ' · 🧲 herangeholt' : ''}</div>
        <div class="small">${e.ende === 'abbruch'
          ? `Abgebrochen nach ${minTxt(e.start, e.abbruch)}`
          : `Hinweg ${minTxt(e.start, e.ziel)} · Gesamt ${ges !== null ? ges + ' Min' : (S.log[S.rueck] === e ? 'läuft noch …' : 'Rückweg nicht erfasst')}${abwTxt}`}</div></div>`;
    }).join('');
  };
  // Als Text kopieren, um es direkt im Chat als Feedback einzufügen
  $('logCopy').onclick = () => copy(['Datum;Start;geplant Min;Luftlinie m;Ende;Hinweg Min;Gesamt Min;gewürfelt;herangeholt',
    ...S.log.map(e => [new Date(e.start).toLocaleDateString('de-DE'), uhr(e.start), e.min, e.luft ?? '', ENDE[e.ende],
      e.ziel ? Math.round((e.ziel - e.start) / 60000) : '', e.zurueck ? Math.round((e.zurueck - e.start) / 60000) : '',
      e.wuerfel, e.heran ? 'ja' : 'nein'].join(';'))].join('\n'));

  $('collect').onclick = async () => {
    const A = S.active; if (!A || !ich) return;
    $('collect').disabled = true;
    stopWatch();
    if (foundToday('exp')) {
      protokoll(A, 'gelaufen');
      S.active = null; save();
      return nurGelaufen('Den Expeditions-Fund für heute hattest du schon, aber jeder Meter zählt. Morgen gibt es wieder etwas!<br><br>🏠 Tippe zu Hause auf „Bin zurück“, damit die Dauer gemessen wird.', () => show('start'));
    }
    let pool = 'normal';
    try { pool = (await wetterFrisch(ich)).pool; } catch (e) {}
    const f = addFind('exp', pool, rollR(DAUER[A.min].p), { min: A.min, ort: A.ziel.text });
    protokoll(A, 'fund');
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
  $('goLog').onclick = () => show('protokoll');

  // ---------- Sichern / Wiederherstellen ----------
  $('backup').onclick = () => copy(JSON.stringify({ app: 'schatzsuche', v: 2, finds: S.finds, recent: S.recent, log: S.log }));
  $('restore').onclick = () => {
    try {
      const o = JSON.parse($('restoreTxt').value);
      if (!o || !Array.isArray(o.finds)) throw 0;
      const have = new Set(S.finds.map(f => f.code));
      const neu = o.finds.filter(f => f && f.code && !have.has(f.code));
      S.finds = [...S.finds, ...neu].sort((a, b) => a.t - b.t);
      if (Array.isArray(o.log)) {
        const da = new Set(S.log.map(e => e.start));
        S.log = [...S.log, ...o.log.filter(e => e && e.start && !da.has(e.start))].sort((a, b) => a.start - b.start);
        S.rueck = null;
      }
      save(); $('restoreTxt').value = '';
      toast(`${neu.length} Funde wiederhergestellt`);
    } catch (e) { toast('Das sieht nicht nach einer Sicherung aus.'); }
  };

  // ---------- Ton, Vibration, Bildschirm an ----------
  let AC = null;
  const ton = (folge = [[660, 0, .12], [880, .13, .2]]) => {
    // Kleiner Glockenton ohne Audiodatei: [Frequenz Hz, Start s, Dauer s]
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime + .02;
    folge.forEach(([f, s, d]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + s);
      g.gain.linearRampToValueAtTime(.35, t0 + s + .01);
      g.gain.exponentialRampToValueAtTime(.001, t0 + s + d);
      o.connect(g).connect(AC.destination);
      o.start(t0 + s); o.stop(t0 + s + d + .05);
    });
    return AC.state;
  };
  $('fxTest').onclick = async () => {
    const z = [];
    if (!navigator.vibrate) z.push('📳 Vibration: ✗ gibt es in diesem Browser nicht');
    else z.push(`📳 Vibration: ${navigator.vibrate([200, 100, 200]) ? '✓ angefragt – hat es gesurrt?' : '✗ vom Browser blockiert'}`);
    try { await new Promise(r => setTimeout(r, 50)); z.push(`🔔 Ton: ✓ gespielt (Audio: ${ton()}) – hast du ihn gehört?`); }
    catch (e) { z.push('🔔 Ton: ✗ ' + e.message); }
    z.push(`☀️ Bildschirm anlassen: ${'wakeLock' in navigator ? '✓ möglich' : '✗ gibt es in diesem Browser nicht'}`);
    z.push('', 'Gesurrt wird trotz ✓ nur, wenn Vibration in den Handy-Einstellungen an ist und „Nicht stören“ aus.');
    $('testOut').textContent = z.join('\n');
  };

  // Bildschirm anlassen: nur auf Knopfdruck, standardmäßig aus, endet beim Verlassen der Suche
  let wach = null, wachWill = false;
  const zeigeWach = () => document.querySelectorAll('[data-wach]').forEach(b => {
    b.textContent = `☀️ Bildschirm anlassen: ${wachWill ? 'an' : 'aus'}`;
    b.classList.toggle('an', wachWill);
  });
  const wachHolen = async () => {
    try {
      wach = await navigator.wakeLock.request('screen');
      wach.addEventListener('release', () => { wach = null; });
    } catch (e) { wachWill = false; zeigeWach(); toast('Bildschirm anlassen klappt gerade nicht.'); }
  };
  function wachAus() {
    wachWill = false;
    if (wach) { wach.release().catch(() => {}); wach = null; }
    zeigeWach();
  }
  document.querySelectorAll('[data-wach]').forEach(b => b.onclick = async () => {
    if (wachWill) { wachAus(); return toast('Bildschirm geht wieder normal aus'); }
    if (!('wakeLock' in navigator)) return toast('Das kann dieser Browser leider nicht. Probier es in Chrome.');
    wachWill = true; zeigeWach();
    await wachHolen();
    if (wachWill) toast('Bildschirm bleibt an – kostet etwas Akku');
  });
  // Android gibt die Sperre beim Wegwechseln frei; beim Zurückkommen neu holen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wachWill && !wach) wachHolen();
  });

  // ---------- Los geht's ----------
  if (!S.homes.length) show('setup');
  else if (S.active) openKarte();
  else show('start');
}
