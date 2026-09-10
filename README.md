<p align="left">
  <img src="app/assets/brand/logo.svg" width="280" alt="Befundatlas">
</p>

Auswahlgeführte Anwendung für radiologische Referenz- und Normalbefunde.
Vier Klicks — **Modalität → Untersuchungsregion → Thema → Fragestellung** — führen zu einem
passenden Normalbefund und zu allen Referenzbefunden derselben Konstellation. Jeder angezeigte
Befund lässt sich anschließend über die OpenRouter-API verändern, ohne den Referenzstil zu
verlassen: Das Modell bekommt echte Befunde derselben Auswahl als Stilvorbild, ein aus dem
Korpus gemessenes Stilprofil und eine Ordnungsvorgabe für den jeweiligen Fragestellungstyp.

## Starten

Doppelklick auf `app/index.html` genügt für den vollen Funktionsumfang der Befundauswahl —
die Daten werden per `<script>` geladen und funktionieren deshalb auch direkt von der Festplatte.

Für die KI-Funktion wird ein lokaler Server empfohlen; der Browser meldet dann eine reguläre
Herkunft statt `null`:

```
python3 serve.py     # Linux/macOS, öffnet http://localhost:8000
./start.sh           # dasselbe als Startskript
start.cmd            # Windows
```

### Als App installieren

Die Anwendung bringt ein Web-App-Manifest, eigene Symbole und ein Standalone-Layout mit
(Safe-Area-Ränder, Fensterleisten-Overlay, eigene Startziele für Suche und KI-Panel).
Über einen lokalen oder internen Server lässt sie sich damit als eigenständige App
installieren: Chrome und Edge über „Installieren“ in der Adressleiste beziehungsweise
`⋮ → Apps → Diese Seite installieren`, iOS über „Zum Home-Bildschirm“, Android über
„App installieren“.

Bewusst **ohne Service Worker**. Das heißt: kein Hintergrund-Cache und keine Offline-Schicht
über den Browser-Cache hinaus — und in Chrome erscheint der automatische Installationsdialog
deshalb nicht von selbst, der Menüeintrag funktioniert aber. Der Verzicht ist gewollt: ein
Service Worker liefert veraltete Befunddaten aus, solange er nicht aktiv erneuert wird, und
das ist bei einem Referenzwerk das falsche Verhalten.

Ohne Netzverbindung sind Auswahl, Suche, Anzeige, Kopieren und Drucken vollständig nutzbar;
nur die KI-Anpassung braucht Internetzugang. Es werden keine externen Bibliotheken,
CDN-Ressourcen oder Build-Schritte benötigt.

## Datenbestand

| Kennzahl | Wert |
|---|---|
| Referenzbefunde | 11 733 |
| komponierte Normalbefunde | 1 964 |
| Untersuchungsregionen | 66 (CT 25 / MRT 41) |
| Themen | 37 |
| Fragestellungs-Phänotypen | 14 |

### Wie die Struktur entsteht

1. **Parsen** — `tools/parse_corpus.py` zerlegt jeden Rohbefund in Titel, Klin. Angaben,
   Fragestellung, Methodik, Befund und Beurteilung. Der Export nutzt die Feldmarken teils
   mit, teils ohne Doppelpunkt; beide Varianten werden erkannt.
2. **Kanonisieren** — `tools/taxonomy.py` bildet die 343 Rohbezeichnungen der
   Studienbeschreibung auf 66 Regionen ab (`Becken^Prostata`, `Becken Prostata`,
   `Becken_neu^Prostata` → *Prostata*, Gruppe *Becken*), leitet das **Thema** regelbasiert aus
   den klinischen Angaben und die **Fragestellung** aus dem gleichnamigen Feld ab.
3. **Sortieren** — innerhalb jeder Konstellation werden die Referenzbefunde nach einem
   Qualitätsmaß gereiht: Vollständigkeit der Felder, Befundlänge im typischen Korridor,
   vorhandene Beurteilung; abgebrochene Untersuchungen fallen nach hinten. Textgleiche
   Befunde werden entfernt.
4. **Normalbefund komponieren** — `tools/normal_templates.py` enthält für jede der
   66 Modalität-Region-Kombinationen ein Normalinventar, dessen Sätze aus den häufigsten
   Negativ- und Normalformulierungen des Korpus stammen (`tools/mine_normals.py` erhebt sie).
   Der Generator setzt daraus je Pfad einen Befund zusammen: Regionsinventar plus
   themenabhängige Zusätze (onkologisch, traumatologisch, entzündlich) plus
   fragestellungsabhängige Ordnung und Beurteilung.

Erfunden wird dabei nichts: keine Messwerte, keine Vorbefunde, keine Serien- oder
Bildnummern. Wo ein Vergleich zum Phänotyp gehört, steht ein ausdrücklicher Platzhalter
`[Datum]`, der in der Oberfläche farbig markiert ist.

## Bedienung

| Aktion | Weg |
|---|---|
| Auswahl treffen | Klick, oder Zifferntasten `1`–`9` in der offenen Stufe |
| Auswahl zurücknehmen | Krümelpfad anklicken oder `Backspace` |
| Suchen und springen | `⌘K` / `Strg K` oder `/` — Regionen, Themen, Befehle und Volltext in einer Palette |
| zwischen Referenzbefunden blättern | Pfeiltasten `←` `→` oder Liste |
| Abschnitt kopieren | Zeigen auf „Befund“/„Beurteilung“ → *kopieren* |
| gesamten Befund kopieren | Schaltfläche *Kopieren* |
| als PDF sichern | *Drucken* — das Druck-Stylesheet blendet die Oberfläche aus |
| hell und dunkel | Sonnen- beziehungsweise Mondsymbol; die Wahl wird gespeichert |
| Panels schließen | `Esc` |

Enthält eine Stufe nur eine einzige Option, wird sie übersprungen.

## KI-Anpassung über OpenRouter

### Was das Modell bekommt

Der Auftrag wird für jede Anfrage aus dem Korpus gebaut (`app/assets/ai-style.js`) und
besteht aus sechs Abschnitten:

1. **Auswahl** — Modalität, Region, Thema, Fragestellung, Vorlagentyp.
2. **Gemessenes Stilprofil** — aus bis zu 120 Befunden derselben Auswahl erhoben:
   Median-Wortzahl und Satzzahl von Befund und Beurteilung, mittlere Satzlänge, übliche
   Methodikzeile, übliche Eröffnung, die stiltragenden Kurzaussagen der Region und die
   üblichen ersten Beurteilungszeilen. In den Mustersätzen sind alle Zahlen durch
   Auslassungspunkte ersetzt — das Muster ist der Stil, der Messwert wäre ein Inhaltsleck.
3. **Ordnungsvorgabe** für den Fragestellungs-Phänotyp: Was zuerst genannt wird, was danach,
   womit die Beurteilung schließt — für alle 14 Phänotypen einzeln hinterlegt.
4. **Echte Referenzbefunde** als Stilvorbild. Die Auswahl läuft über vier Stufen absteigender
   Passgenauigkeit: identische Auswahl → gleiche Region und Fragestellung → gleiche Region
   und Thema → gleiche Region. Innerhalb einer Stufe entscheidet das Qualitätsmaß, danach
   wird auf inhaltliche Streuung geachtet. Die verwendete Stufe wird in der Oberfläche
   angezeigt.
5. **Der zu bearbeitende Befund.**
6. **Die Änderungsanweisung** plus automatisch abgeleitete Bindungen: Platzhalter erhalten,
   nativ ohne Kontrastmittelaussagen, keine Verlaufsaussage ohne Voruntersuchung,
   CT- gegenüber MRT-Terminologie.

Der Systemprompt trennt Stil und Inhalt ausdrücklich: aus den Referenzen darf kein Befund,
kein Maß, keine Seitenangabe, kein Datum, keine Serien- oder Bildnummer, kein Stadium und
keine Empfehlung übernommen werden — nur Wortwahl, Satzbau, Satzlänge, Reihenfolge und
Verdichtungsgrad.

### Der Ablauf in fünf Stufen

Jede Stufe meldet ihren Zustand im Panel, dazu ein Fortschrittsring, die verstrichene Zeit,
die Schreibrate und nach dem Lauf der Tokenverbrauch.

| Stufe | Was passiert |
|---|---|
| Referenzbefunde sammeln | Stilvorbilder wählen, Stilprofil messen — meldet Anzahl und Retrieval-Stufe |
| Auftrag zusammenstellen | sechsteiliger Auftrag, meldet die geschätzte Tokenzahl |
| Befund wird geschrieben | Generierung, Streaming Zeichen für Zeichen |
| Stilangleich | zweiter Aufruf, der ausschließlich die Form überarbeitet; der Inhalt ist festgeschrieben |
| Stilprüfung | lokale Bereinigung, Verbotsprüfung und Dichtemessung gegen das Stilprofil |

Der Stilangleich ist kein Beiwerk: Im Abnahmetest hatte der erste Durchgang „zeigt sich ein
1,8 cm großer Herd“ geschrieben — eine im Korpus verbotene Wendung. Der zweite Durchgang hat
daraus „findet sich ein 1,8 cm großer, T2-hypointenser Herd“ gemacht.

Die Stilprüfung entfernt Reasoning-Blöcke und angehängte Selbstkommentare, korrigiert
Dezimalpunkte in Maßangaben, ersetzt satzinitiale Floskeln und benennt verbleibende Verstöße,
statt sie mitten im Satz grammatikalisch kaputt zu reparieren. Anschließend misst sie
Befundlänge, Satzlänge, Beurteilungslänge und die Zahl der Sätze über 17 Wörtern gegen die
Zielwerte der Konstellation. Liefert ein Modell kein verwertbares Feldformat, wird das
gemeldet und *Übernehmen* bleibt gesperrt.

Erst *Übernehmen* ersetzt die Anzeige; die Vorlage bleibt bis dahin unverändert.

### Einstellungen

**API-Key.** Gilt standardmäßig nur für die laufende Sitzung; erst das Ankreuzfeld
*Key im Browser speichern* legt ihn in `localStorage` ab. *Key prüfen* fragt
`GET /api/v1/key` ab und zeigt Limit und Verbrauch.

**Modellkatalog.** Die Liste wird live über `GET /api/v1/models` geladen und als
durchsuchbarer Katalog dargestellt — je Modell Kontextfenster, maximale Ausgabelänge, Preis
je einer Million Token beziehungsweise die Kennzeichnung *kostenfrei*, Eingabearten und
Reasoning-Verhalten. Voreingestellt ist der Filter auf kostenfreie Modelle. Das Angebot an
freien Modellen wechselt bei OpenRouter laufend, deshalb ist nichts fest verdrahtet;
ist die Liste nicht erreichbar, greift eine kleine Standardauswahl. Modelle, die von
sich aus mit einem Denkschritt beginnen, tragen die Kennzeichnung *denkt vor* und stehen am
Ende der Liste — sie schreiben diesen Denkschritt häufig in die Antwort und halten das
Feldformat schlechter ein.

**Weitere Regler.** Anzahl der mitgeschickten Referenzbefunde (0 bis 8), Kreativität
(Voreinstellung 0,25), Stilangleich, Stilprüfung und Streaming.

**Technisch.** `POST /api/v1/chat/completions` mit `Authorization`, `HTTP-Referer` und
`X-Title`, `max_tokens` 2400, `reasoning: {exclude: true}` und `usage: {include: true}`.
Der SSE-Strom wird tokenweise verarbeitet, Keep-Alive-Kommentarzeilen werden übersprungen.

> Die KI-Funktion verändert Textbausteine. Jeder erzeugte Befund ist vor Verwendung fachlich
> zu prüfen. Die Anwendung enthält ausschließlich Referenztexte, keine patientenbezogenen Daten.

## Aufbau

```
app/
  index.html
  manifest.webmanifest
  assets/tokens.css        Designtokens: Marke, Typo-, Abstands- und Linienleitern, Aero-Glass
  assets/styles.css        Oberfläche, Bewegung, Druckstylesheet, Responsive-Verhalten
  assets/app.js            Navigation, Nachladen der Regionspakete, Anzeige, Befehlspalette
  assets/ai-style.js       Referenzauswahl, Stilprofil, Auftragsbau
  assets/ai.js             OpenRouter-Anbindung, Stufenablauf, Stil- und Dichteprüfung
  assets/brand/            Bildmarke, Logo, Favicon, App-Symbole
  data/index.js            Auswahlbaum und Metadaten
  data/reports/*.js        66 Regionspakete, bei Bedarf nachgeladen
tools/                     Aufbereitungspipeline
serve.py, start.sh, start.cmd
```

Datenbestand neu erzeugen:

```
python3 tools/parse_corpus.py <korpus.csv> parsed.json
python3 tools/build_app_data.py parsed.json
```

## Marke und Gestaltung

Die Bildmarke verbindet beide Bedeutungen des Namens: der Ring mit den vier Justiermarken
ist zugleich Schnittebene und Himmelsrichtung, die Nadel darin macht daraus einen Kompass.
Für kleine Größen gibt es eine vereinfachte Fassung ohne Justiermarken, die bis 16 Pixel
lesbar bleibt.

Corporate-Basis in Aero-Glass-Ausführung: Markenrot `#E3000B` und Markengrau `#555553`
bleiben den belegten Akzenten und Statusangaben vorbehalten, Arial als Schrift, kühl
harmonisierte neutrale Rampe. Alle Größen und Abstände folgen den festgelegten Leitern
(Schrift 11 · 13 · 15 · 17 · 20 · 24 · 30 px, Abstände 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 ·
32 · 48 px), Fließtext hält eine Satzbreite von höchstens 68 Zeichen, Ziffern laufen
tabellarisch. Fokus ist mit 2 px plus 2 px Versatz sichtbar, Bedienflächen sind mindestens
44 px hoch, ein dunkles Medium ist vollständig ausgeführt. Flächiges Rot gibt es nicht;
der Befund bleibt in Graustufen druck- und faxfähig.

Bewegung ist Teil der Bedienung: die Auswahlstufen falten sich auf, Optionen laufen
gestaffelt ein, die Mengenbalken wachsen aus dem Nullpunkt, der Segmentschalter fährt
federnd um, Glasflächen tragen einen zeigergesteuerten Glanz, der Fortschrittsring und die
pulsierenden Stufenpunkte zeigen den Stand der KI-Anfrage, und beim Laden eines
Regionspakets steht ein Skelett statt eines Sprungs. Auf eine Rücknahme bei
`prefers-reduced-motion` wurde auf ausdrücklichen Wunsch verzichtet.
