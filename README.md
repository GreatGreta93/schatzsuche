# Schatzsuche

Kleine Web-App, die zum Rausgehen motiviert: Ziel auf der Karte ansteuern, Fundstück einsammeln, per Fund-Code ins Sammelalbum von Greatopolis übertragen.

- `index.html` – Oberfläche
- `app.js` – Logik (Standort, Wetter, Zielsuche, Funde)
- `katalog.js` – Fundstück-Katalog (Schnittstelle zu Greatopolis, Nummern nie neu vergeben)
- `technik-test.html` – Technik-Test vom 20.11.2026
- `klang.js` – Töne und Vibrationsmuster (ausgewählt per Hörprobe)
- `hoerprobe.html` – Hörprobe zum Auswählen von Tönen und Vibrationsmustern (24.11.2026)

## Ton & Vibration (Stand 24.11.2026)
- Getestet auf Android: **Chrome** kann Ton, Vibration und „Bildschirm anlassen“. In **DuckDuckGo** geht die Vibration nicht. Die App wird deshalb in Chrome genutzt.
- Eingebaut: Testknopf unter Einstellungen; Knopf „☀️ Bildschirm anlassen“ (Wake Lock) auf Karte und bei „Kurz raus“, standardmäßig aus, endet beim Verlassen der Suche.
- Entschieden (24.11.2026): Klangrichtung weich & natürlich, fast alles Kalimba; Ton-Schalter (🔔/🔕) auf Karte, bei „Kurz raus“ und in den Einstellungen, Ton standardmäßig an, Vibration bleibt immer; „fast da“ eine Stufe bei 100 m; „legendär“ als großer Moment.
- Eingebaut (`klang.js`): Ziel gefunden, neu gewürfelt, fast da (100 m), Ziel erreicht (unter 30 m), Truhe nach Seltenheit, Kurz raus geschafft (50 m), Code kopiert, Abbruch / Kurz raus schon erledigt. „Fast da“ und „Ziel erreicht“ kommen einmal pro Ziel.

Karte © OpenStreetMap-Mitwirkende · Wetter: Open-Meteo
