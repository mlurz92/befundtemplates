# Befundatlas

Auswahlgeführte Anwendung für radiologische Referenz- und Normalbefunde.
Vier Klicks — **Modalität → Untersuchungsregion → Thema → Fragestellung** — führen zu einem
passenden Normalbefund und zu allen Referenzbefunden derselben Konstellation.
Jeder angezeigte Befund lässt sich anschließend KI-gestützt über die OpenRouter-API verändern,
ohne den Referenzstil zu verlassen.

## Starten

Doppelklick auf `app/index.html` genügt für den vollen Funktionsumfang der Befundauswahl
(die Daten werden per `<script>` geladen und funktionieren deshalb auch direkt von der Festplatte).

Für die KI-Funktion wird ein lokaler Server empfohlen — dann meldet der Browser eine
reguläre Herkunft statt `null`:

```
python3 serve.py          # Linux/macOS, öffnet http://localhost:8000
./start.sh                # dasselbe als Startskript
start.cmd                 # Windows
```

Es werden keine externen Bibliotheken, CDN-Ressourcen oder Build-Schritte benötigt.
Ohne Netzverbindung sind Auswahl, Suche, Anzeige, Kopieren und Drucken vollständig nutzbar;
nur die KI-Anpassung braucht Internetzugang.

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
   mit, teils ohne Doppelpunkt; beide Varianten werden erkannt (99,9 % Trefferquote beim Befund).
2. **Kanonisieren** — `tools/taxonomy.py` bildet die 343 Rohbezeichnungen der
   Studienbeschreibung auf 66 Regionen ab (`Becken^Prostata`, `Becken Prostata`,
   `Becken_neu^Prostata` → *Prostata*, Gruppe *Becken*), leitet das **Thema** regelbasiert aus
   den klinischen Angaben und die **Fragestellung** aus dem gleichnamigen Feld ab.
3. **Sortieren** — innerhalb jeder Konstellation werden die Referenzbefunde nach einem
   Qualitätsmaß gereiht: Vollständigkeit der Felder, Befundlänge im typischen Korridor,
   vorhandene Beurteilung; abgebrochene oder nicht auswertbare Untersuchungen fallen nach hinten.
   Textgleiche Befunde werden entfernt.
4. **Normalbefund komponieren** — `tools/normal_templates.py` enthält für jede der
   66 Modalität-Region-Kombinationen ein Normalinventar, dessen Sätze aus den häufigsten
   Negativ- und Normalformulierungen des Korpus stammen (`tools/mine_normals.py` erhebt sie).
   Der Generator setzt daraus je Pfad einen Befund zusammen: Regionsinventar plus
   themenabhängige Zusätze (onkologisch, traumatologisch, entzündlich) plus
   fragestellungsabhängige Ordnung und Beurteilung.

Erfunden wird dabei nichts: Es gibt keine erfundenen Messwerte, keine erfundenen Vorbefunde und
keine erfundenen Serien-/Bildnummern. Wo ein Vergleich zum Phänotyp gehört, steht ein
ausdrücklicher Platzhalter `[Datum]`, der in der Oberfläche farbig markiert ist.

## Bedienung

| Aktion | Weg |
|---|---|
| Auswahl treffen | Klick, oder Zifferntasten `1`–`9` in der offenen Stufe |
| Auswahl zurücknehmen | Krümelpfad anklicken oder `Backspace` |
| zwischen Referenzbefunden blättern | Pfeiltasten `←` `→` oder Liste |
| Volltextsuche über alle Befunde | `/`, Treffer springt direkt in die passende Auswahl |
| Abschnitt kopieren | Zeigen auf „Befund“/„Beurteilung“ → *kopieren* |
| gesamten Befund kopieren | Schaltfläche *Kopieren* |
| als PDF sichern | *Drucken* (das Druck-Stylesheet blendet die Oberfläche aus) |
| hell/dunkel | Mondsymbol; die Wahl wird gespeichert |
| Panels schließen | `Esc` |

Enthält eine Stufe nur eine einzige Option, wird sie übersprungen.

## KI-Anpassung (OpenRouter)

**Einstellungen → API-Key.** Der Key gilt standardmäßig nur für die laufende Sitzung; erst das
Ankreuzfeld *Key im Browser speichern* legt ihn in `localStorage` ab. *Key prüfen* fragt
`GET /api/v1/key` ab und zeigt Limit und Verbrauch.

**Modellauswahl.** Die Liste wird live über `GET /api/v1/models` geladen; voreingestellt ist der
Filter auf kostenfreie Modelle (`:free` bzw. Preis 0 für Prompt und Completion). Das Angebot an
freien Modellen wechselt bei OpenRouter laufend — deshalb wird nichts fest verdrahtet, sondern
jeweils die aktuelle Liste angeboten. Ist die Liste nicht erreichbar, greift eine kleine
Standardauswahl.

**Anfrage.** `POST /api/v1/chat/completions` mit `Authorization`, `HTTP-Referer` und `X-Title`,
`temperature` voreingestellt auf 0,25, `max_tokens` 2200, `reasoning: {exclude: true}` und
optionalem SSE-Streaming. Der Antwortstrom wird tokenweise angezeigt; Keep-Alive-Kommentarzeilen
(`: OPENROUTER PROCESSING`) werden übersprungen.

**Stiltreue.** Der Systemprompt bindet die Stilregeln des Korpus: telegraphischer Nominalstil,
eine diagnostische Aussage je Satz, diagnostisches Ziel und Vergleich früh, Maße mit Komma,
ADC als `x 10-3 mm²/s`, getrennte Negationslogik (`Kein Nachweis …` gegenüber
`Keine Hinweise auf …`), stark komprimierte Beurteilung sowie die harten Verbote
(`Es zeigt sich`, `Im Bereich des/der`, `Kein Anhalt für`, `DD:`, `Zusammenfassend`, Markdown).
Er verlangt außerdem ein festes Feldformat und verbietet Nachworte.

Nach der Generierung greifen drei Sicherungen:

* **Bereinigung** — Reasoning-Blöcke, angehängte Selbstkommentare und Markdown werden entfernt,
  Dezimalpunkte in Maßangaben zu Kommata korrigiert, verbotene Wendungen satzinitial ersetzt.
* **Stilprüfung** — verbleibende Verstöße werden benannt statt still korrigiert, weil eine
  Entfernung mitten im Satz die Grammatik zerstören würde.
* **Plausibilitätsprüfung** — liefert ein Modell kein verwertbares Feldformat (manche Modelle
  hängen ihren Denkschritt an), wird das gemeldet, statt einen kaputten Befund zu übernehmen.

Erst *Übernehmen* ersetzt die Anzeige; die Vorlage bleibt bis dahin unverändert.

Acht vorgefertigte Anweisungen (u. a. *Pathologisch machen*, *Verlaufskontrolle*,
*Staging ergänzen*, *Beurteilung schärfen*, *Straffen*) lassen sich anklicken und frei ergänzen.
`Strg`/`Cmd` + `Enter` startet die Anfrage.

> Die KI-Funktion verändert Textbausteine. Jeder erzeugte Befund ist vor Verwendung fachlich zu
> prüfen. Die Anwendung enthält ausschließlich Referenztexte, keine patientenbezogenen Daten.

## Aufbau

```
app/
  index.html
  assets/tokens.css      Designtokens (Marke, Typo-, Abstands- und Linienleitern, Aero-Glass)
  assets/styles.css      Oberfläche, Druckstylesheet, Responsive-Verhalten
  assets/app.js          Navigation, Shard-Nachladen, Befundanzeige, Suche
  assets/ai.js           OpenRouter-Anbindung, Stilprüfung
  data/index.js          Auswahlbaum + Metadaten (229 KB)
  data/reports/*.js      66 Regionspakete, bei Bedarf nachgeladen
tools/                   Aufbereitungspipeline (Parser, Taxonomie, Normalbefunde, Build)
serve.py, start.sh, start.cmd
```

Datenbestand neu erzeugen:

```
python3 tools/parse_corpus.py <korpus.csv> parsed.json
python3 tools/build_app_data.py parsed.json
```

## Gestaltung

Corporate-Basis in Aero-Glass-Ausführung: Markenrot `#E3000B` und Markengrau `#555553` bleiben
den belegten Akzenten und Statusangaben vorbehalten, Arial als Schrift, kühl harmonisierte
neutrale Rampe. Alle Größen und Abstände folgen den festgelegten Leitern
(Schrift 11 · 13 · 15 · 17 · 20 · 24 · 30 px, Abstände 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 48 px),
Fließtext hält eine Satzbreite von höchstens 68 Zeichen, Ziffern laufen tabellarisch.
Fokus ist mit 2 px plus 2 px Versatz sichtbar, Bedienflächen sind mindestens 44 px hoch,
`prefers-reduced-motion` schaltet Bewegung ab, ein dunkles Medium ist vollständig ausgeführt.
Flächiges Rot gibt es nicht; der Befund bleibt in Graustufen druck- und faxfähig.
