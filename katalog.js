// Schatzsuche – Fundstück-Katalog (Stand 23.11.2026)
// Schnittstelle zu Greatopolis: Die Nummern (id) sind dauerhaft und dürfen nie neu vergeben werden.
// Neue Fundstücke bekommen immer die nächste freie Nummer. Seltenheit: 0 gewöhnlich, 1 selten, 2 episch, 3 legendär.

const SELTENHEIT = ['gewöhnlich', 'selten', 'episch', 'legendär'];

const POOLS = {
  normal: { name: 'Normal', icon: '🌤️' },
  regen: { name: 'Regen', icon: '🌧️' },
  nebel: { name: 'Nebel', icon: '🌫️' },
  frost: { name: 'Frost', icon: '❄️' },
  schnee: { name: 'Schnee', icon: '🌨️' },
  hitze: { name: 'Hitze', icon: '🔥' },
  dunkel: { name: 'Dunkelheit', icon: '🌙' }
};

const KATALOG = [
  // Normal
  { id: 1, pool: 'normal', r: 0, name: 'Kiesel', icon: '🪨', text: 'Glatt, grau, irgendwie gemütlich.' },
  { id: 2, pool: 'normal', r: 0, name: 'Eichel', icon: '🌰', text: 'Mit Hütchen. Ein Eichhörnchen sucht sie bestimmt schon.' },
  { id: 3, pool: 'normal', r: 0, name: 'Vogelfeder', icon: '🪶', text: 'Leicht wie nichts.' },
  { id: 4, pool: 'normal', r: 0, name: 'Schneckenhaus', icon: '🐚', text: 'Leer. Die Bewohnerin ist umgezogen.' },
  { id: 5, pool: 'normal', r: 1, name: 'Rheinkiesel', icon: '💎', text: 'Ein Quarz, vom Rhein rundgeschliffen.' },
  { id: 6, pool: 'normal', r: 1, name: 'Alte Münze', icon: '🪙', text: 'Die Prägung ist kaum noch zu lesen.' },
  { id: 7, pool: 'normal', r: 1, name: 'Murmel', icon: '🔮', text: 'Mit einer bunten Spirale im Inneren.' },
  { id: 8, pool: 'normal', r: 2, name: 'Vierblättriges Kleeblatt', icon: '🍀', text: 'Wirklich vier! Nachgezählt.' },
  { id: 9, pool: 'normal', r: 2, name: 'Fossil', icon: '🐌', text: 'Ein Ammonit, Millionen Jahre alt.' },
  { id: 10, pool: 'normal', r: 3, name: 'Bernstein mit Einschluss', icon: '🟠', text: 'Darin schläft ein winziges Insekt aus der Urzeit.' },
  // Regen
  { id: 11, pool: 'regen', r: 0, name: 'Pfützenscherbe', icon: '🪞', text: 'Spiegelt den Himmel, auch wenn er grau ist.' },
  { id: 12, pool: 'regen', r: 0, name: 'Regentropfen im Glas', icon: '💧', text: 'Ein einzelner Tropfen, sorgfältig eingefangen.' },
  { id: 13, pool: 'regen', r: 1, name: 'Weinbergschneckenhaus', icon: '🐌', text: 'Groß, gestreift und bei Regen am schönsten.' },
  { id: 14, pool: 'regen', r: 2, name: 'Regenbogen-Regenschirm', icon: '☂️', text: 'Macht jeden grauen Tag bunter.' },
  { id: 15, pool: 'regen', r: 3, name: 'Regenbogen-Kristall', icon: '🌈', text: 'Fängt Licht und wirft Regenbögen an die Wand.' },
  // Nebel
  { id: 16, pool: 'nebel', r: 0, name: 'Tau im Spinnennetz', icon: '🕸️', text: 'Hunderte winzige Perlen an feinen Fäden.' },
  { id: 17, pool: 'nebel', r: 1, name: 'Nebelperle', icon: '⚪', text: 'Schimmert milchig und ist immer ein bisschen kühl.' },
  { id: 18, pool: 'nebel', r: 2, name: 'Irrlicht-Laterne', icon: '🏮', text: 'Leuchtet, ohne dass jemand sie angezündet hat.' },
  // Frost
  { id: 19, pool: 'frost', r: 0, name: 'Eisblatt', icon: '🍁', text: 'Ein Blatt mit glitzerndem Frostrand.' },
  { id: 20, pool: 'frost', r: 0, name: 'Schneekratzer', icon: '🧹', text: 'Hat schon viele Windschutzscheiben gerettet.' },
  { id: 21, pool: 'frost', r: 1, name: 'Raureif-Zweig', icon: '🌿', text: 'Jede Nadel trägt einen weißen Pelz.' },
  { id: 22, pool: 'frost', r: 1, name: 'Schlittschuhe', icon: '⛸️', text: 'Frisch geschliffen. Wartet auf den gefrorenen See.' },
  { id: 23, pool: 'frost', r: 2, name: 'Eiskristall', icon: '❄️', text: 'Schmilzt nicht. Niemand weiß, warum.' },
  // Schnee
  { id: 24, pool: 'schnee', r: 0, name: 'Heiße Schokolade mit Marshmallows', icon: '☕', text: 'Dampft noch. Unbedingt gleich trinken.' },
  { id: 25, pool: 'schnee', r: 1, name: 'Schneeflocke im Glas', icon: '🫙', text: 'Keine gleicht der anderen, diese schon gar nicht.' },
  { id: 26, pool: 'schnee', r: 2, name: 'Schneekugel', icon: '🔮', text: 'Darin ein winziges Greatopolis im Winter.' },
  { id: 27, pool: 'schnee', r: 2, name: 'Schlitten', icon: '🛷', text: 'Aus Holz, mit roter Kordel.' },
  { id: 28, pool: 'schnee', r: 3, name: 'Yeti-Haar', icon: '🦶', text: 'Weiß, zottelig, eindeutig echt.' },
  // Hitze
  { id: 29, pool: 'hitze', r: 0, name: 'Sonnengetrocknetes Blatt', icon: '🍂', text: 'Raschelt bei jeder Berührung.' },
  { id: 30, pool: 'hitze', r: 0, name: 'Eiskalter Eistee', icon: '🧋', text: 'Die Eiswürfel klirren noch.' },
  { id: 31, pool: 'hitze', r: 1, name: 'Sonnenstein', icon: '🟡', text: 'Speichert die Wärme und gibt sie abends wieder ab.' },
  { id: 32, pool: 'hitze', r: 2, name: 'Brennglas', icon: '🔍', text: 'Bündelt die Sonne zu einem hellen Punkt.' },
  { id: 33, pool: 'hitze', r: 2, name: 'Sonnenfeder', icon: '🌞', text: 'Golden und angenehm warm.' },
  { id: 34, pool: 'hitze', r: 3, name: 'Phönixfeder', icon: '🔥', text: 'Glüht von innen und ist niemals kalt.' },
  // Dunkelheit
  { id: 35, pool: 'dunkel', r: 0, name: 'Katzenauge-Reflektor', icon: '🔴', text: 'Funkelt, sobald Licht darauf fällt.' },
  { id: 36, pool: 'dunkel', r: 1, name: 'Glühwürmchen-Glas', icon: '✨', text: 'Ein paar Lichter tanzen darin.' },
  { id: 37, pool: 'dunkel', r: 2, name: 'Sternschnuppe', icon: '🌠', text: 'Noch ganz warm vom Fallen.' },
  { id: 38, pool: 'dunkel', r: 3, name: 'Mondstein', icon: '🌕', text: 'Leuchtet bei Vollmond besonders hell.' }
];
