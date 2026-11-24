# Schatzsuche

Kleine Web-App, die zum Rausgehen motiviert: Ziel auf der Karte ansteuern, Fundstück einsammeln, per Fund-Code ins Sammelalbum von Greatopolis übertragen.

- `index.html` – Oberfläche
- `app.js` – Logik (Standort, Wetter, Zielsuche, Funde)
- `katalog.js` – Fundstück-Katalog (Schnittstelle zu Greatopolis, Nummern nie neu vergeben)
- `technik-test.html` – Technik-Test vom 20.11.2026
- `hoerprobe.html` – Hörprobe zum Auswählen von Tönen und Vibrationsmustern (24.11.2026)

## Ton & Vibration (Stand 24.11.2026)
- Getestet auf Android: **Chrome** kann Ton, Vibration und „Bildschirm anlassen“. In **DuckDuckGo** geht die Vibration nicht. Die App wird deshalb in Chrome genutzt.
- Eingebaut: Testknopf unter Einstellungen; Knopf „☀️ Bildschirm anlassen“ (Wake Lock) auf Karte und bei „Kurz raus“, standardmäßig aus, endet beim Verlassen der Suche.
- Entschieden (24.11.2026): Klangrichtung weich & natürlich (Kalimba, Holz, Tropfen, Windspiel); Ton-Schalter in der App, Ton standardmäßig an; eine Stufe „fast da“; „legendär“ wird ein großer Moment.
- Offen: Sounds und Vibrationsmuster für die einzelnen Momente festlegen und einbauen (z. B. Fund, „fast da“, Ziel erreicht). Töne werden per Web Audio im Code erzeugt (Funktion `ton()` in `app.js`), Audiodateien sind nicht nötig.

Karte © OpenStreetMap-Mitwirkende · Wetter: Open-Meteo
