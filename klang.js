// Schatzsuche – Töne und Vibrationsmuster (Stand 24.11.2026)
// Ausgewählt per Hörprobe (hoerprobe.html). Klangrichtung: weich & natürlich, alles im Code erzeugt.
// Benutzung: KLANG.spiel('start'), KLANG.ton = false schaltet nur den Ton stumm (Vibration bleibt).
const KLANG = (() => {
  let AC, OUT, HALL, RAUSCH;
  const init = () => {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.connect(AC.destination);
    OUT = AC.createGain(); OUT.gain.value = .55; OUT.connect(comp);
    // kleiner natürlicher Raumhall (selbst erzeugte Impulsantwort)
    const len = AC.sampleRate * 1.8, ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = AC.createConvolver(); conv.buffer = ir;
    HALL = AC.createGain(); HALL.gain.value = .22; HALL.connect(conv).connect(comp);
    RAUSCH = AC.createBuffer(1, AC.sampleRate * 3, AC.sampleRate);
    const r = RAUSCH.getChannelData(0); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
  };
  // Chrome gibt Ton erst nach einer Berührung frei: bei jedem Tippen sicherstellen, dass der Ton bereit ist
  document.addEventListener('pointerdown', () => { if (K.ton) try { init(); } catch (e) {} }, { passive: true });

  const ziel = g => { g.connect(OUT); g.connect(HALL); return g; };
  const N = n => {
    const m = /^([A-G])(#?)(\d)$/.exec(n), s = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (s + (+m[3] + 1) * 12 - 69) / 12);
  };
  const T = () => AC.currentTime + .03;
  const sinus = (t, f, vol, dec, att = .005, typ = 'sine') => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = typ; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(.0001, t + att + dec);
    o.connect(g); ziel(g); o.start(t); o.stop(t + att + dec + .05);
  };
  const rausch = (t, dur, f, q, vol) => {
    const s = AC.createBufferSource(), b = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = RAUSCH; b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(b).connect(g); ziel(g); s.start(t, Math.random()); s.stop(t + dur + .02);
  };
  const I = {
    kalimba: (t, n, v = 1, dec = 1.1) => { const f = N(n); sinus(t, f, .32 * v, dec); sinus(t, f * 5.9, .05 * v, .12); rausch(t, .015, f * 3, 2, .05 * v); },
    glocke: (t, n, v = 1, dec = 2.4) => { const f = N(n); [[1, 1], [2.76, .35], [5.4, .15], [8.93, .06]].forEach(([k, a], i) => sinus(t, f * k, .2 * v * a, dec / (1 + i * .9), .003)); },
    holz: (t, f = 1600, v = 1) => { sinus(t, f, .25 * v, .05, .002, 'triangle'); rausch(t, .03, f * 1.6, 6, .25 * v); },
    wind: (t, dur = 2.5, v = 1) => {
      const s = AC.createBufferSource(), b = AC.createBiquadFilter(), g = AC.createGain();
      s.buffer = RAUSCH; b.type = 'bandpass'; b.Q.value = 1.2;
      b.frequency.setValueAtTime(350, t); b.frequency.linearRampToValueAtTime(1300, t + dur * .6); b.frequency.linearRampToValueAtTime(700, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.09 * v, t + dur * .5); g.gain.linearRampToValueAtTime(.0001, t + dur);
      s.connect(b).connect(g); ziel(g); s.start(t); s.stop(t + dur + .05);
    },
  };
  const folge = (inst, noten, v = 1) => { const t = T(); noten.forEach(([s, n, vv = 1, d]) => I[inst](t + s, n, v * vv, d)); };

  const TRUHE = [
    [[0, 'C5'], [.12, 'G5', 1, 1.3]],
    [[0, 'C5'], [.11, 'E5'], [.22, 'G5'], [.38, 'C6', 1, 1.6]],
    [[0, 'G4'], [.1, 'C5'], [.2, 'E5'], [.3, 'G5'], [.4, 'C6'], [.62, 'E6', 1, 2.2], [.9, 'G6', .35], [1.1, 'C7', .25], [1.3, 'E6', .2]],
    [[0, 'C5'], [.18, 'D5'], [.36, 'E5'], [.54, 'G5'], [.72, 'A5'], [.9, 'C6'],
     [1.2, 'E6', .7], [1.27, 'D6', .65], [1.34, 'C6', .6], [1.41, 'A5', .55], [1.48, 'G5', .5],
     [1.8, 'C4', .8, 3], [1.8, 'C5', .7, 3], [1.82, 'E5', .6, 3], [1.84, 'G5', .6, 3], [1.86, 'D6', .5, 3]],
  ];
  const truhe = r => {
    folge('kalimba', TRUHE[r]);
    if (r >= 2) folge('glocke', r === 2 ? [[.62, 'E6', .4]] : [[1.8, 'C6', .5, 3.5], [1.86, 'G6', .3, 3]]);
    if (r === 3) I.wind(T(), 3.2, 1);
  };

  // Moment → [Ton, Vibrationsmuster in ms]
  const MOMENTE = {
    start:   [() => folge('kalimba', [[0, 'C5'], [.1, 'E5'], [.2, 'G5']]), [30]],
    wuerfel: [() => { const t = T(); [0, .13, .23, .3, .35, .39].forEach((s, i) => I.holz(t + s, 1300 + Math.random() * 900, 1 - i * .13)); }, [15, 40, 15, 40, 15]],
    nah:     [() => folge('kalimba', [[0, 'E5', .6], [.25, 'E5', .6]]), [30, 60, 30, 60, 30]],
    da:      [() => { folge('kalimba', [[0, 'C5'], [.1, 'E5'], [.2, 'G5'], [.3, 'C6', 1, 1.6]]); folge('glocke', [[.3, 'C6', .4]]); }, [100, 60, 100, 60, 250]],
    r0:      [() => truhe(0), [30, 50, 60]],
    r1:      [() => truhe(1), [50, 50, 50, 50, 150]],
    r2:      [() => truhe(2), [80, 50, 80, 50, 250]],
    r3:      [() => truhe(3), [30, 60, 50, 60, 80, 60, 120, 60, 700]],
    kurz:    [() => folge('kalimba', [[0, 'G5'], [.13, 'C6', 1, 1.4]]), [70, 60, 140]],
    kopie:   [() => I.holz(T(), 1800, .6), [15]],
    nein:    [() => folge('kalimba', [[0, 'E5', .5], [.15, 'C5', .5]]), [30]],
  };

  const K = {
    ton: true,
    spiel(id) {
      const m = MOMENTE[id]; if (!m) return;
      try { if (navigator.vibrate) navigator.vibrate(m[1]); } catch (e) {}
      if (!K.ton) return;
      try { init(); m[0](); } catch (e) {}
    },
  };
  return K;
})();
