# Schäfer Befundbrowser · Intelligence 4.1.1

**KSG Aero Glass · corpusbasierter Beispielbefundbrowser · AI Report Workshop via OpenRouter**

## 1. Zweck der Anwendung

Der Schäfer Befundbrowser ist eine lokale HTML/CSS/JavaScript-Anwendung zur schnellen Auswahl typischer radiologischer Beispielbefunde im Stil von Prof. Schäfer. Die zugrunde liegende Datenbank umfasst 11.796 Originalbefunde. Die Anwendung verändert diese Originalberichte nicht, sondern indexiert und sortiert sie für eine klinisch sinnvolle Navigation.

Die Bedienlogik lautet:

1. **Modalität:** CT oder MRT
2. **Untersuchungsregion**
3. **klinisches Thema**
4. **Fragestellung**
5. **Normalreferenz an Position 1**, anschließend gerankte Originalbeispiele

Zusätzlich enthält Intelligence 4.1.1 eine optionale **AI Report Workshop**. Damit kann die aktuell ausgewählte Vorlage vor dem Kopieren kontrolliert verändert werden. Die KI-Bearbeitung erzeugt ausschließlich einen temporären Entwurf; der Corpus selbst bleibt unverändert.

---

## 2. Corpus und klinische Datenlogik

Aktueller Build:

- **11.796 Originaldatensätze**
- **7.367 MRT**
- **4.429 CT**
- **1.701 Standard-Normalreferenzen**
- exakt eine Normalreferenz für jede im Corpus vorkommende Kombination aus **Modalität × Region × kanonisierter Fragestellung**
- **3.375 Modalität–Region–Thema–Fragestellung-Auswahlgruppen**
- **11.083/11.796 Fälle (94,0 %)** mit kuratiertem klinischem Thema
- **713 Fälle** bleiben bewusst generisch, wenn eine spezifischere Einordnung nicht ausreichend sicher ist
- **27 exakte Dubletten** bleiben erhalten und werden lediglich im Ranking nachgeordnet

### 2.1 Originalbefund vs. Normalreferenz vs. KI-Entwurf

Die Anwendung unterscheidet strikt drei Texttypen:

- **Originalbefund:** unveränderter Datensatz aus dem Schäfer-Corpus
- **Schäfer-Stil · Standard-Normalbefund:** corpusbasierte, deidentifizierte Referenzvorlage; kein Originalzitat von Prof. Schäfer
- **KI-Entwurf:** temporäre, vom Benutzer ausgelöste Transformation einer ausgewählten Vorlage

Diese Trennung wird auch in der Oberfläche sichtbar gekennzeichnet.

---

## 3. Start der Anwendung

### Runtime-Paket

1. ZIP entpacken.
2. Den vollständigen Ordner zusammenlassen.
3. `index.html` in einem aktuellen Chromium-/Edge-/Chrome-/Firefox-Browser öffnen.
4. Corpusnavigation, Normalreferenzen, Originalbefunde, Suche, Ranking, Kopieren und UI funktionieren vollständig lokal.
5. Nur die optionale OpenRouter-KI-Funktion benötigt Internetzugriff.

Es gibt **kein externes JavaScript-Framework und kein CDN**. Die Corpusdaten liegen lokal in `data/reports.js`.

---

## 4. Intelligence 4.1.1 · AI Report Workshop

Bei einem ausgewählten Bericht steht die Aktion **„Mit KI anpassen“** zur Verfügung.

### 4.1 Ablauf

1. Ausgangsbefund und Ausgangsbeurteilung werden als unveränderte Referenz angezeigt.
2. Der Benutzer formuliert eine explizite Änderungsanweisung.
3. Die App sendet nur den erforderlichen Kontext an OpenRouter:
   - Modalität
   - Region
   - Thema
   - kanonisierte Fragestellung
   - Befund
   - Beurteilung
   - Änderungsanweisung
4. Das Modell erzeugt eine vollständige neue Fassung.
5. Ein lokaler **Consistency Guard** analysiert sensible Veränderungen.
6. Ein **Semantic Diff** zeigt Hinzufügungen und Entfernungen.
7. Der Benutzer kann die Fassung weiter editieren, erneut mit KI verändern, Undo/Redo verwenden oder zum Original zurückkehren.
8. Erst nach manueller Übernahme wird der KI-Entwurf im Hauptviewer angezeigt und kann kopiert werden.

### 4.2 Edit Contract

Der Systemprompt fordert das Modell auf:

- ausschließlich die explizit verlangte medizinische Änderung vorzunehmen,
- alle übrigen Befundtatsachen zu erhalten,
- Lateralisierung, Lokalisation, Maße, Anzahl, Vergleichsdynamik und diagnostische Sicherheit nicht eigenmächtig zu verändern,
- relevante Negativbefunde zu erhalten,
- Befund und Beurteilung konsistent zu halten,
- final kompakt im Schäfer-Stil zu formulieren.

Der lokale Consistency Guard ersetzt **keine ärztliche Endkontrolle**.

---

## 5. OpenRouter-Einstellungen

Die Einstellungen befinden sich im Aero-Glass-Einstellungsmodal.

### API-Key

- kein API-Key ist im Release- oder Sourcecode eingebettet
- Standard: Speicherung nur für die Browser-Sitzung (`sessionStorage`)
- optional: dauerhafte lokale Speicherung (`localStorage`)
- der persistierte Key ist Browser-Speicher und **nicht zusätzlich verschlüsselt**
- „API-Key aus Browser entfernen“ löscht Session- und LocalStorage-Einträge
- bei blockiertem Browser-Storage verwendet die App einen flüchtigen In-Memory-Fallback

### Modellkatalog

Der Modellkatalog wird live über OpenRouter geladen:

- `GET https://openrouter.ai/api/v1/models`
- zusätzliche ZDR-Abfrage über `GET https://openrouter.ai/api/v1/models?zdr=true`

**FREE-Modelle werden prominent an erster Stelle angezeigt.**

Filter:

- Alle
- FREE
- Structured
- Reasoning
- Tools
- ZDR

Bei Hover oder Keyboard-Focus erscheint ein Aero-Glass-Tooltip mit:

- Modellname und Slug
- FREE-Status
- Kontextfenster
- maximaler Output
- Input-/Outputpreis pro 1 Mio. Tokens
- Structured-Output-Unterstützung
- Tool Calling
- Reasoning
- ZDR-Verfügbarkeit
- Moderationsstatus
- Ein-/Ausgabemodalitäten
- Ausführungsmodus: Standard oder Agentic Harness
- Modellbeschreibung

---

## 6. Harness-only-Modelle: Inkling / Inkling Small Free

### 6.1 Das aufgetretene Problem

Bei einem direkten Aufruf von

`thinkingmachines/inkling-small:free`

trat die OpenRouter-Meldung auf:

> `thinkingmachines/inkling-small:free is only available on agentic harnesses.`

Dies ist **keine Parserstörung**, sondern eine Nutzungsrestriktion des kostenlosen Thinking-Machines-Endpunkts. OpenRouter kennzeichnet Inkling und Inkling Small Free ausdrücklich als nur für **agentische Harnesses** bestimmt.

Offizielle Referenzen:

- https://openrouter.ai/thinkingmachines/inkling-small:free
- https://openrouter.ai/thinkingmachines/inkling:free
- https://openrouter.ai/docs/agent-sdk/overview
- https://openrouter.ai/docs/agent-sdk/call-model/overview

### 6.2 Ursache: eine Zugangsbeschränkung, kein Formatproblem

Die Meldung stammt vom OpenRouter-Gateway, bevor das Modell überhaupt Text erzeugt. Sie ist **keine Parser-, Transport- oder Prompt-Störung**, sondern eine Freigabebeschränkung:

> `... is only available on agentic harnesses. Try plugging it into a coding agent or productivity app listed on https://openrouter.ai/apps`

OpenRouter gibt die kostenlosen Thinking-Machines-Endpunkte ausschließlich für **auf openrouter.ai/apps registrierte** Agentic-Harness-Clients frei. Maßgeblich ist die registrierte App-Identität des aufrufenden Clients, nicht die Struktur des Requests.

Daraus folgt: Eine eigenständige, lokal ausgelieferte Web-Anwendung kann diese Modelle **nicht** aufrufen — auch dann nicht, wenn sie einen fachlich vollwertigen mehrstufigen Tool-Loop implementiert. Die frühere Annahme in Version 4.1.1, ein „echter“ Harness-Loop genüge zur Freischaltung, war falsch; deshalb schlugen beide Transportpfade zwangsläufig fehl und die App zeigte `OpenRouter-Anfrage fehlgeschlagen`.

### 6.3 Lösung: automatisches, transparentes Ausweichmodell

Harness-only-Modelle bleiben im Katalog sichtbar und wählbar, werden aber nie mehr als stiller Fehlschlag ausgeführt:

1. Ist das gewählte Modell als harness-gesperrt bekannt, ersetzt die App es **vor** dem Request durch ein gleichwertiges freies Modell.
2. Meldet OpenRouter die Sperre für ein bisher unbekanntes Modell zur Laufzeit, merkt die App sich die Modell-ID (`localStorage: schaefer-openrouter-gated-models`) und wiederholt den Lauf sofort mit dem Ausweichmodell.
3. Der Vorgang wird nicht verschwiegen: Modellzeile, Datenschutzhinweis, ein Warneintrag in der Ergebnisliste und ein Toast nennen das gesperrte Modell **und** das tatsächlich verwendete. Die Version im Verlauf wird mit der real genutzten Modell-ID gespeichert.

Ausweichreihenfolge (kuratiert, alle frei, Tool-Calling- und JSON-Schema-fähig):

```
nvidia/nemotron-3-super-120b-a12b:free
google/gemma-4-31b-it:free
nex-agi/nex-n2.5-pro:free
google/gemma-4-26b-a4b-it:free
dots-studio/dots-3-note-preview:free
```

Ist keines davon im Live-Katalog verfügbar, wählt die App das bestbewertete freie Modell mit Tool- oder Structured-Output-Fähigkeit. Ist der Katalog noch nicht geladen, wird der erste Listeneintrag synthetisch verwendet. Standardmodell der Anwendung ist `nvidia/nemotron-3-super-120b-a12b:free`.

Der mehrstufige Loop (Review → lokaler Consistency Guard → Submit) bleibt unverändert erhalten und läuft nun auf einem Modell, das ihn auch ausführen darf.

#### Primär: OpenResponses Agent Harness

1. `POST https://openrouter.ai/api/v1/responses`
2. Tool `review_radiology_edit` wird erzwungen.
3. Die Toolargumente enthalten die vollständige vorgeschlagene Fassung.
4. Die App führt lokal den Consistency Guard aus.
5. Das Ergebnis wird als `function_call_output` an OpenRouter zurückgegeben.
6. Anschließend wird `submit_radiology_edit` erzwungen.
7. Erst dessen vollständige Fassung wird als KI-Ergebnis übernommen.

#### Sekundär: Chat-Completions Tool Harness

Falls der OpenResponses-Transport vom Gateway/Provider nicht unterstützt wird, führt die Anwendung **ohne Modellwechsel** denselben Review→Toolresult→Submit-Loop über `POST /api/v1/chat/completions` aus. Authentifizierungsfehler und Rate Limits werden nicht kaschiert.

### 6.4 OpenRouter-App-Attribution und CORS

Die Requests enthalten nur die von OpenRouter im CORS-Preflight zugelassenen Attribution-Header:

- `HTTP-Referer` — Origin der laufenden App (bei `file://`-Start `https://localhost/`)
- `X-Title: Schaefer Befundbrowser Intelligence 4.1.1`

**Behobener Fehler:** Die Vorversion sendete auf dem Responses-Pfad zusätzlich `X-OpenRouter-Metadata`. Dieser Header steht **nicht** in `Access-Control-Allow-Headers` von OpenRouter; der Preflight scheiterte, der Aufruf endete als `Failed to fetch`, ohne die API je zu erreichen. Der Header wurde entfernt.

Referenz: https://openrouter.ai/docs/app-attribution

### 6.5 Datenschutz bei Inkling Free

OpenRouter/Thinking Machines weisen beim kostenlosen Inkling-Endpunkt darauf hin, dass Prompts und Outputs protokolliert und zur Verbesserung der Modelle/Produkte verwendet werden können. Vertrauliche oder personenbezogene Daten sollen dort nicht eingegeben werden.

**Für reale identifizierbare Patientendaten ist dieser Free-Endpunkt daher nicht vorgesehen.**

Die Anwendung blendet diesen Hinweis im Workshop sichtbar ein.

---

## 7. Problem: „Modellantwort enthält keinen vollständig parsbaren Befund und keine Beurteilung“

### 7.1 Das aufgetretene Problem

Mit anderen OpenRouter-Modellen trat in einer früheren Version auf:

> `Modellantwort enthält keinen vollständig parsbaren Befund und keine Beurteilung.`

Die Ursache war ein zu strenger Parser. Verschiedene Modelle liefern denselben fachlich brauchbaren Inhalt in unterschiedlichen Strukturen zurück.

Beispiele:

- striktes JSON
- JSON in Markdown-Codefences
- deutsche JSON-Schlüssel wie `Befund` und `Beurteilung`
- verschachtelte Ergebnisobjekte
- Tool Calls statt `message.content`
- Markdown-Überschriften
- `Befund (angepasst):`
- Inline-Labels
- zwei unlabeled radiologische Absätze
- teilweise strukturierte Ausgabe mit nur einer sicher erkannten Sektion

### 7.2 Lösung: mehrstufige Parserkaskade

Intelligence 4.1.1 verwendet folgende Auswertungskaskade:

1. **Tool-/Function-Call-Argumente** (`submit_radiology_edit`, `review_radiology_edit`)
2. **Structured JSON**
3. **JSON-Codefence**
4. **deutsche oder englische JSON-Schlüssel**
5. **verschachtelte Ergebnisobjekte**
6. **strikte Abschnittsmarker**
7. **Markdown-/Textüberschriften**
8. **modifizierte Überschriften** wie `Befund (angepasst):`
9. **Inline-Labels**
10. **radiologischer Zwei-Absatz-Fallback** mit Beurteilungs-Cue
11. **automatischer Format-Reparaturpass**
12. bei weiterhin unsicherer Struktur: **sichere Erhaltung der Ausgangssektion statt destruktiver Übernahme**

### 7.3 Teilweise brauchbare Antworten

Wenn beispielsweise ein vollständiger Befund, aber keine sicher parsbare Beurteilung vorliegt:

- wird der neue Befund nicht pauschal verworfen,
- die Ausgangsbeurteilung wird vorläufig erhalten,
- eine deutliche Parserwarnung wird angezeigt,
- anschließend versucht die App einen Format-Reparaturpass.

Wenn eine völlig unstrukturierte Antwort keine sichere Trennung erlaubt, werden Befund und Beurteilung **nicht spekulativ erfunden**. Die Ausgangsvorlage bleibt erhalten und der Benutzer erhält eine Warnung.

---

## 8. Structured Outputs und Tool Calling

Bei normalen Modellen gilt:

- unterstützt das Modell laut Live-Katalog `response_format`, fordert die App ein striktes JSON-Schema an,
- unterstützt ein Modell Tools, aber kein `response_format`, wird bevorzugt `submit_radiology_edit` als Function Tool erzwungen,
- andernfalls wird das tolerante Textformat verwendet.

Inkling Small Free unterstützt laut OpenRouter Tool Calling, aber kein erzwungenes `response_format`. Deshalb läuft es in der Harness-Toolkaskade und nicht im Structured-Output-Pfad.

---

## 9. Local Consistency Guard

Nach jeder KI-Transformation prüft die Anwendung lokal insbesondere:

- Lateralisierungsänderungen
- Zahlen- und Maßänderungen
- Negationsänderungen
- Änderungen diagnostischer Sicherheit
- neu eingeführte Vergleichs-/Verlaufsaussagen
- Lateralisierungswidersprüche zwischen Befund und Beurteilung
- Negations-/Polaritätswidersprüche zwischen Befund und Beurteilung

Änderungen, die in der Benutzeranweisung explizit vorkommen, werden als anweisungsbezogen markiert. Die Prüfung ist heuristisch und ersetzt keine medizinische Validierung.

---

## 10. Semantic Diff und Versionierung

Jede erfolgreiche Transformation erzeugt eine lokale Version:

`Original → V1 → V2 → V3 ...`

Funktionen:

- Undo
- Redo
- Direktwahl einer Version
- Original wiederherstellen
- weitere KI-Bearbeitung auf Basis der aktuellen Version
- Befund und Beurteilung manuell nachbearbeiten
- Gesamtbefund kopieren
- Entwurf in den Hauptviewer übernehmen

Der Corpus selbst wird dabei nie überschrieben.

---

## 11. Datenschutzoptionen

Je nach Modell/Provider können folgende OpenRouter-Routingoptionen gesetzt werden:

- `provider.data_collection = "deny"`
- `provider.zdr = true`

Wenn die gewählten Datenschutzanforderungen mit dem Modell/Provider nicht vereinbar sind, soll OpenRouter transparent fehlschlagen. Die Anwendung wechselt nicht heimlich auf ein anderes Modell.

---

## 12. KSG Aero Glass UI

Die Oberfläche orientiert sich an der Rot-/Weiß-/Mineral-Grundsprache des Klinikum St. Georg und kombiniert diese mit einem eigenständigen Aero-Glass-Layer:

- transluzente Glasebenen
- selektiver Backdrop-Blur
- Lichtreflexe und Sheen
- animierte Tiefenringe
- Pointer-Parallax
- AI-Orb
- Diff-Reveal
- animierte Modellkarten
- FREE-Modelle mit hervorgehobener Glaskante
- Hover-/Focus-Tooltips

Entsprechend der expliziten Projektvorgabe ist **kein `prefers-reduced-motion`-Fallback** implementiert.

---

## 13. Source-Paket

Das Source-Paket enthält:

- `app/` – vollständige Runtime
- `corpus/` – bereinigte Ausgangs-CSV
- `tools/build_data.py` – deterministische Corpus-Build-Pipeline
- `tests/` – Python-, JavaScript- und Chromium-E2E-Tests
- `qa/` – visuelle QA-Screenshots
- `docs/` – soweit im Build vorhanden, Design-/Implementierungsunterlagen
- `README.md` – diese Dokumentation

### Corpus neu bauen

```bash
python tools/build_data.py \
  --input corpus/aschaefer_MR_CT_bereinigt.csv \
  --output-dir app/data
```

### Test-Suite

```bash
python -m unittest discover -s tests -v
node tests/core.test.js
node tests/ai-core.test.js
node -c app/core.js
node -c app/app.js
node -c app/ai-core.js
node -c app/ai.js
python tests/e2e_smoke.py
SCHAEFER_E2E_HARNESS_FALLBACK=1 python tests/e2e_smoke.py
```

Der zweite Chromium-Lauf simuliert gezielt die reale OpenRouter-Fehlermeldung `only available on agentic harnesses` am primären Responses-Transport und verifiziert den automatischen Fallback auf den zweiten Tool-Harness **ohne Modellwechsel**.

---

## 14. QA-Grundsätze

Die Release-QA prüft unter anderem:

- exakte Corpusgröße und Modalitätszahlen
- vollständige Regionen
- Normalreferenzabdeckung
- Rankingintegrität
- Erhalt aller Originaltexte
- Dublettenbehandlung
- UI-Struktur
- Aero-Glass-Motion
- Modellkatalog und FREE-Priorisierung
- Tooltip-Top-Layer
- API-Key-Speicherung und -Löschung
- Secret-Scan
- Structured-Output- und Tool-Payloads
- OpenResponses-Harness
- Harness-Transport-Fallback
- Parservarianten
- Consistency Guard
- Semantic Diff
- Undo/Redo
- 390-px-Mobile-Layout ohne horizontalen Overflow
- JavaScript-Syntax
- reproduzierbaren Corpus-Neubau
- Bytegleichheit zwischen getesteter Source-App und Runtime-Paket

### Wichtig zum API-E2E-Test

Der Browser-E2E-Test verwendet **gemockte OpenRouter-Antworten**. Ein realer persönlicher OpenRouter-Key wird bewusst nicht in automatisierte Testartefakte übernommen und nicht in Release-Dateien geschrieben.

Damit wird der Request-/Responsevertrag reproduzierbar getestet, ohne Zugangsdaten offenzulegen oder externe Free-Research-Datenverarbeitung auszulösen.

---

## 15. Troubleshooting

### „OpenRouter API-Key fehlt“

Einstellungen öffnen, Key eintragen und speichern. Standardmäßig bleibt er nur für die Browser-Sitzung erhalten.

### Modell erscheint nicht

„Verbindung prüfen“ ausführen. Der Modellkatalog wird live geladen und kann sich bei OpenRouter ändern.

### Inkling meldet weiterhin „only available on agentic harnesses“

Intelligence 4.1.1 versucht automatisch:

1. OpenResponses-Agent-Harness
2. bei einem geeigneten Transport-/Harnessfehler: Chat-Completions-Tool-Harness

Wenn **beide** Wege vom OpenRouter-/Thinking-Machines-Gateway abgewiesen werden, zeigt die App beide Ursachen zusammen an. Das Modell wird dabei nicht stillschweigend gewechselt. In diesem Fall liegt die Einschränkung serverseitig beim aktuellen OpenRouter-/Provider-Zugang bzw. den Research-Endpoint-Bedingungen; ein Client kann eine serverseitige Nutzungsfreigabe nicht umgehen.

### Modellantwort wird nicht erkannt

Die Parserkaskade und der automatische Reparaturpass sollten die häufigsten Formate erfassen. Falls beide scheitern, bleibt die Ausgangsvorlage erhalten; im Warning-Bereich erscheint die konkrete Parserursache.

### KI-Funktion offline

Die Corpusanwendung funktioniert offline. Die KI-Werkstatt benötigt Internetzugriff zu `https://openrouter.ai`.

---

## 16. Sicherheitshinweis

Diese Anwendung ist ein Arbeits- und Vorlagenwerkzeug. KI-generierte oder KI-veränderte radiologische Texte müssen vor klinischer Verwendung ärztlich geprüft werden. Externe Free-Research-Endpunkte dürfen nicht mit Daten verwendet werden, die nach den jeweiligen Datenschutz-/Nutzungsbedingungen dort nicht verarbeitet werden dürfen.



### 6.6 Hotfix 4.1.1 (historisch, teilweise überholt): `Failed to fetch` bei Inkling

> **Nachtrag 4.1.2:** Die hier beschriebene Transportanalyse war unvollständig. `Failed to fetch` entstand nicht durch `file://` allein, sondern durch den nicht CORS-freigegebenen Header `X-OpenRouter-Metadata` auf dem Responses-Pfad (siehe 6.4). Und selbst nach erfolgreichem Transport bleibt Inkling gesperrt: die Beschränkung gilt der registrierten App-Identität, nicht dem Transport. Die Aussage „kein stiller Wechsel auf ein anderes Modell“ gilt seit 4.1.2 bewusst nicht mehr — der Wechsel findet statt, ist aber **nicht still**, sondern in Modellzeile, Warnliste, Toast und Versionshistorie ausgewiesen. Abschnitt 6.3 ist maßgeblich.


**Symptom:** Bei `thinkingmachines/inkling-small:free` erschien unmittelbar `OpenRouter-Anfrage fehlgeschlagen – Failed to fetch`, während andere Modelle (z. B. Nemotron) funktionierten.

**Ursache:** Das Problem lag nicht am API-Key und nicht an der allgemeinen OpenRouter-Verbindung. Normale Modelle wurden über `POST /api/v1/chat/completions` erfolgreich aus der lokalen HTML-Anwendung aufgerufen. Inkling nutzte dagegen primär `POST /api/v1/responses`; dieser Request konnte beim direkten Start der Anwendung über `file://` bereits auf Browser-/CORS-/Transportebene scheitern, bevor OpenRouter eine HTTP-Antwort lieferte.

**Lösung in 4.1.1:**

- Bei direktem `file://`-Start werden Harness-only-Modelle sofort über den mehrstufigen **Chat-Completions-Tool-Harness** ausgeführt.
- Bei HTTP/HTTPS bleibt OpenResponses der bevorzugte Harness-Pfad.
- `Failed to fetch`, `NetworkError`, CORS-/Load-Fehler und kompatible Gatewayfehler lösen automatisch einen Fallback auf den Chat-Tool-Harness aus.
- Der **Modell-Slug bleibt identisch**; es findet kein stiller Wechsel auf ein anderes Modell statt.
- Sobald der Responses-Transport in einer Sitzung als nicht funktionsfähig erkannt wurde, wird er für weitere Harness-Aufrufe dieser Sitzung übersprungen.
- Wenn nach dem Transport-Fallback ein Format-Reparaturpass nötig wird, bleibt auch dieser auf dem bereits funktionierenden Chat-Tool-Harness und springt nicht erneut zu `/responses` zurück.
- Authentifizierungs- und Quota-Fehler (`401`, `403`, `429`) werden ausdrücklich **nicht** als Transportfehler maskiert.

Damit erklärt sich auch, warum ein Nemotron-Modell bereits funktionierte: dessen normaler Chat-Completions-Pfad war von dem Responses-spezifischen Fehler nicht betroffen.


---

## 17. Änderungen in Intelligence 4.1.2

**Auslöser:** Jede KI-Änderung mit `thinkingmachines/inkling:free` endete mit
`OpenRouter-Anfrage fehlgeschlagen — ... is only available on agentic harnesses.`

**Drei Ursachen, drei Korrekturen:**

1. **Zugangsbeschränkung des Modells (Hauptursache).** OpenRouter gibt die Inkling-Free-Endpunkte nur für auf openrouter.ai/apps registrierte Agentic-Harness-Apps frei. Aus einer eigenständigen Web-App ist das nicht erreichbar — unabhängig von der Requeststruktur. → Die App erkennt gesperrte Modelle vorab bzw. am Providerfehler, lernt neu gesperrte IDs dazu und führt die Anfrage automatisch mit einem gleichwertigen freien Modell aus. Der Ersatz wird in Modellzeile, Datenschutzhinweis, Warnliste, Toast und Versionshistorie offengelegt.

2. **CORS-Preflight-Fehler.** `X-OpenRouter-Metadata` stand nicht in `Access-Control-Allow-Headers` von OpenRouter; der Responses-Aufruf scheiterte vor Erreichen der API (`Failed to fetch`). → Header entfernt.

3. **Falsche Attribution-Header.** `X-OpenRouter-Title` wurde durch den dokumentierten `X-Title` ersetzt; `HTTP-Referer` ist nicht mehr auf `http://localhost:8765/` festgenagelt, sondern nutzt den echten Origin der laufenden App (Fallback `https://localhost/` bei `file://`).

**Weitere Anpassungen:**

- Standardmodell: `nvidia/nemotron-3-super-120b-a12b:free` statt `thinkingmachines/inkling-small:free`.
- Kuratierte Ausweichliste plus dynamische Auswahl aus dem Live-Katalog (`AI.pickFallbackModel`).
- Neue Kernfunktionen: `isHarnessGateError`, `isHarnessGatedModel`, `pickFallbackModel`, `FALLBACK_MODEL_IDS`.
- Gesperrte Modell-IDs werden unter `localStorage: schaefer-openrouter-gated-models` gemerkt.
- Der Format-Reparaturpass läuft auf dem tatsächlich verwendeten Ausweichmodell, nicht mehr auf dem gesperrten Modell.
- Ist kein Ausweichmodell verfügbar, erscheint eine klare Handlungsanweisung statt einer rohen Providermeldung.

**Was bewusst nicht getan wurde:** Es wird nicht versucht, die App-Identität eines registrierten Harness-Clients vorzutäuschen, um die Inkling-Sperre zu umgehen. Das wäre eine Umgehung der Nutzungsbedingungen des Anbieters und technisch nicht stabil.
