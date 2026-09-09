# KSG Befundbrowser · Intelligence 4.1.3

**KSG Aero Glass · corpusbasierter Beispielbefundbrowser · AI Report Workshop via OpenRouter**

## 1. Zweck der Anwendung

Der KSG Befundbrowser ist eine lokale HTML/CSS/JavaScript-Anwendung zur schnellen Auswahl typischer radiologischer Beispielbefunde im Prof.-Schäfer-Stil. Die zugrunde liegende Datenbank umfasst 11.796 Originalbefunde. Die Anwendung verändert diese Originalberichte nicht, sondern indexiert und sortiert sie für eine klinisch sinnvolle Navigation.

Die Bedienlogik lautet:

1. **Modalität:** CT oder MRT
2. **Untersuchungsregion**
3. **Klinische Angaben**
4. **Fragestellung**
5. **Standard-Normalbefund an Position 1**, anschließend gerankte Originalbeispiele

Zusätzlich enthält Intelligence 4.2.0 eine optionale **AI Report Workshop**. Damit kann die aktuell ausgewählte Vorlage vor dem Kopieren kontrolliert verändert werden. Die KI-Bearbeitung erzeugt ausschließlich einen temporären Entwurf; der Corpus selbst bleibt unverändert.

---

## 2. Korpus und klinische Datenlogik

Aktueller Build (`taxonomy_version 2026-09-09-intelligence-4-2`):

| Kennzahl | Wert |
|---|---:|
| Originaldatensätze | 11.796 |
| MRT | 7.367 |
| CT | 4.429 |
| Untersuchungsregionen | 33 |
| Kategorien Klinische Angaben | 46 |
| Kanonische Fragestellungen | 21 |
| Auswahlkombinationen (Blätter) | 1.233 |
| davon mit nur einem Treffer | 38 (3,1 %) |
| Median Vorlagen je Kombination | 5 |
| Standard-Normalbefunde | 337 |
| exakte Dubletten (nur nachgeordnet) | 33 |

Die Sektionserkennung trennt 9.476 Befunde über das explizite Schema,
2.108 über das ältere Markerschema ohne Doppelpunkt und
212 heuristisch.

### 2.0 Normalisierung des CSV-Exports

Der RIS-Export ersetzt jedes Komma durch `/`. Die Rückführung unterscheidet drei Klassen:

| Klasse | Beispiel | Ergebnis |
|---|---|---|
| Listenkomma | `Leber/ Milz` | `Leber, Milz` |
| Dezimalkomma vor Einheit | `1/5 Tesla`, `2/2 cm` | `1,5 Tesla`, `2,2 cm` |
| echte Notation | `LWK 4/5`, `ng/ml`, `12/2023` | unverändert |

Ein pauschales Ersetzen würde `1/5 Tesla` zu `1, 5 Tesla` und `ng/ml` zu `ng, ml` verfälschen.

### 2.1 Originalbefund vs. Normalreferenz vs. KI-Entwurf

Die Anwendung unterscheidet strikt drei Texttypen:

- **Originalbefund:** unveränderter Datensatz aus dem Schäfer-Korpus
- **Standard-Normalbefund:** korpusbasierte, deidentifizierte Vorlage. Jeder Satz ist ein im Korpus tatsächlich verwendeter Negativ- oder Normalsatz der gewählten Gruppe; kein zusammenhängendes Originalzitat von Prof. Schäfer
- **KI-Entwurf:** temporäre, vom Benutzer ausgelöste Transformation einer ausgewählten Vorlage

Diese Trennung wird auch in der Oberfläche sichtbar gekennzeichnet.

---

### 2.2 Kategorisierung

Die vier Ebenen werden deterministisch aus dem Datensatz abgeleitet:

| Ebene | Quelle | Verfahren |
|---|---|---|
| Modalität | Feld `Modalität` | erstes Token (`MR\SR` → MRT), nur CT und MRT |
| Untersuchungsregion | Feld `Studienbeschreibung` | Regelwerk über den RIS-Protokollnamen |
| Klinische Angaben | Abschnitt `Klin. Angaben` | kontrolliertes Vokabular, inkl. ICD-10-Kodes |
| Fragestellung | Abschnitt `Fragestellung` | kontrolliertes Vokabular |

Die **Region** stammt bewusst aus dem Protokollnamen und nicht aus einer Textheuristik
über den Befund: Der Protokollname beschreibt die tatsächlich gefahrene Untersuchung.
Die 343 Protokollvarianten (`Becken Prostata`, `Becken^Prostata`, `Becken_neu^Prostata`)
werden zuvor normalisiert; RIS-Abkürzungen werden expandiert, damit
`Hals+Tho.+OB ven.` als Hals-Thorax-Oberbauch-Untersuchung erkannt wird.

Die **klinischen Angaben** werden gestuft ausgewertet: zuerst das Feld selbst, dann
Titel, dann Fragestellung. Alleinstehende ICD-10-Kodes (`C34.1 rechts.`) werden auf
die Entität abgebildet.

**Das eigentliche Problem der Vorversion war die Fragestellung.** Sie wurde nahezu als
Freitext durchgereicht: 2.893 verschiedene Formulierungen, davon der weit überwiegende
Teil genau einmal. Als Navigationsebene war das wertlos, weil die Auswahl auf eine
einzige Vorlage führte. Der Freitext bleibt als `question_raw` am Datensatz erhalten und
wird in der Vorlage angezeigt; für die Navigation wird auf 21 kanonische Fragestellungen
abgebildet.

Zusätzlich werden seltene Kategorien **innerhalb ihres Pfades** gebündelt: Klinische
Angaben mit weniger als 4 Fällen je Region werden zu *Weitere Indikationen*,
Fragestellungen mit weniger als 3 Fällen je Knoten zu *Weitere Fragestellungen*. Eine
Auswahl, die auf genau einen Treffer führt, ist als Navigationsebene keine Hilfe.

Wirkung auf die Sackgassen-Quote:

| | vorher | jetzt |
|---|---:|---:|
| Auswahlkombinationen | 3.375 | 1.233 |
| davon mit genau einem Treffer | 2.336 (69,2 %) | 38 (3,1 %) |
| Median Vorlagen je Kombination | 1 | 5 |

### 2.3 Standard-Befundvorlagen

Die Vorlagen der Vorversion waren generisch: 1.701 Referenzen bestanden aus lediglich
35 verschiedenen Texten, 633 davon ohne jede Korpusevidenz.

Die Vorlagen werden jetzt **aus dem Korpus abgeleitet**. Je Modalität, Region und
Fragestellung werden die tatsächlich verwendeten Negativ- und Normalsätze gezählt und
die typischsten zusammengesetzt. Erfunden wird nichts; jeder Satz stammt wörtlich aus
dem Korpus und wird mit seiner Belegzahl angezeigt.

Vier Auswahlkriterien:

1. **Zulässige Satzform.** Nur zwei Formen werden akzeptiert: ein Satz, der mit einer
   Verneinung oder Normalitätsaussage beginnt (`Keine Sekretverhalte.`), oder eine
   kopulative Normalaussage (`Die Prostatakapsel ist intakt.`). Eine Verneinung
   irgendwo im Satz genügt ausdrücklich nicht — *„Das Hauptfragment, in dem keine
   Schrauben verankert sind, ist abgerutscht."* enthält `keine` und ist dennoch ein
   positiver pathologischer Befund. Sätze mit Maßen, Datumsangaben, Seitenangaben,
   Vergleichsbezug oder einschränkenden Konjunktionen (`aber`, `jedoch`) entfallen.
2. **Distinktivität statt Häufigkeit.** `Kein Aszites.` ist in fast jeder Region häufig.
   Gewertet wird der Anteil in der Gruppe gegenüber dem Anteil im Gesamtkorpus, damit
   keine abdominellen Sätze in eine NNH-Vorlage geraten.
3. **Dublettenfreiheit.** Über Stemming, Synonymklassen und Kompositazerlegung gelten
   `Keine Lungenmetastasen.` / `Keine pulmonalen Metastasen.` und `Normales Knochenmark.`
   / `Unauffälliges Knochenmark.` als dieselbe Aussage.
4. **Belastbare Evidenz vor genauer Passung.** Trägt die fragestellungsgenaue Evidenz
   nicht, wird die breitere Regionsevidenz verwendet. Eine Vorlage aus Sätzen, die je
   genau einmal im Korpus stehen, ist kein Standard. Die verwendete Basis
   (`Fragestellung` oder `Region`) steht in der Oberfläche.

Der Zielbefund der Fragestellung steht am Anfang der Vorlage, nicht hinter einem
Organinventar.

| | vorher | jetzt |
|---|---:|---:|
| Vorlagen | 1.701 | 337 |
| verschiedene Vorlagentexte | 35 | 337 |
| Vorlagen ohne Korpusevidenz | 633 | 0 |
| Abdeckung der Auswahlkombinationen | – | 100 % |

Evidenzniveau: 26 hoch, 86 mittel, 225 orientierend. Das Niveau
wird an der Vorlage ausgewiesen; die ärztliche Endkontrolle bleibt in jedem Fall
erforderlich.

## 3. Start der Anwendung

### Runtime-Paket

1. ZIP entpacken.
2. Den vollständigen Ordner zusammenlassen.
3. `index.html` in einem aktuellen Chromium-/Edge-/Chrome-/Firefox-Browser öffnen.
4. Corpusnavigation, Normalreferenzen, Originalbefunde, Suche, Ranking, Kopieren und UI funktionieren vollständig lokal.
5. Nur die optionale OpenRouter-KI-Funktion benötigt Internetzugriff.

Es gibt **kein externes JavaScript-Framework und kein CDN**. Die Corpusdaten liegen lokal in `data/reports.js`.

---

## 4. Intelligence 4.2.0 · AI Report Workshop

Bei einem ausgewählten Bericht steht die Aktion **„Mit KI anpassen“** zur Verfügung.

### 4.1 Ablauf

1. Ausgangsbefund und Ausgangsbeurteilung werden als unveränderte Referenz angezeigt.
2. Der Benutzer formuliert eine explizite Änderungsanweisung.
3. Die App sendet nur den erforderlichen Kontext an OpenRouter:
   - Modalität, Region, Kategorie der klinischen Angaben, kanonische Fragestellung
   - klinische Angaben und Fragestellung im Originalwortlaut sowie der Untersuchungstitel
   - Befund und Beurteilung
   - Änderungsanweisung
4. Das Modell erzeugt eine vollständige neue Fassung.
5. Ein lokaler **Consistency Guard** analysiert sensible Veränderungen.
6. Ein **Semantic Diff** zeigt Hinzufügungen und Entfernungen.
7. Der Benutzer kann die Fassung weiter editieren, erneut mit KI verändern, Undo/Redo verwenden oder zum Original zurückkehren.
8. Erst nach manueller Übernahme wird der KI-Entwurf im Hauptviewer angezeigt und kann kopiert werden.

### 4.2 Edit Contract

Der Systemprompt trennt zwei Regelblöcke und stellt den medizinischen Inhalt ausdrücklich über den Stil.

**Änderungsregeln**

- ausschließlich die von der Anweisung verlangten medizinischen Sachverhalte ändern,
- jede übrige Befundtatsache semantisch exakt erhalten: Seitenangabe, Lokalisation, Segment, Maße, Anzahl, Vergleichsdynamik, diagnostische Sicherheit, relevante Negativbefunde,
- nichts hinzuerfinden: keine Pathologie, keine Voruntersuchung, kein Vergleichsintervall, keine Methodik, keine Sequenzliste, keine Serien- oder Bildnummer, keine Empfehlung, kein Normalbefund-Inventar,
- Unsicherheitsgrade (`V. a.`, `suspekt`, `am ehesten`, `DD`) weder verstärken noch abschwächen,
- Befund und Beurteilung widerspruchsfrei halten,
- immer die vollständige Fassung ausgeben, nicht nur die geänderte Passage.

**Stilregeln (quantitativ aus dem Korpus abgeleitet)**

| Regel | Anker |
|---|---|
| Satzlänge Befund | typischerweise 6–17 Wörter (Median 6, P90 17) |
| Satzlänge Beurteilung | typischerweise 4–13 Wörter (Median 4, P90 13) |
| Verdichtung der Beurteilung | Richtwert etwa ein Siebtel der Befundlänge |
| Satzbau | eine eigenständige diagnostische Aussage pro Satz, nominaler Stil |
| Reihenfolge | diagnostisches Ziel und gültiger Vergleich früh |
| Maße | unmittelbar bei dem Befund, den sie quantifizieren |

Zwei Regeln adressieren wiederkehrende Fehler generischer Modelle:

- **Negationslogik:** `Kein Nachweis ...` bezeichnet die direkte Nichtdarstellung der genannten Struktur, `Keine Hinweise auf ...` das Fehlen von Zeichen eines Prozesses. Die Wendungen sind keine Synonyme und werden nicht gegeneinander ausgetauscht.
- **Koordination:** unabhängige Aussagen werden nicht mechanisch mit `und` verkettet; `und` bleibt dort, wo die Grammatik es verlangt. Echte medizinische Schrägstrich-Notation (`C5/6`, `LWK 5/SWK 1`, `ng/ml`) bleibt erhalten.

Abschließend fordert der Prompt eine stille Selbstprüfung: Jede Seitenangabe, jedes Maß, jede Zahl, jede Vergleichsangabe und jeder Sicherheitsgrad muss entweder unverändert oder von der Anweisung ausdrücklich verlangt sein.

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

### 6.3 Lösung: modellunabhängiger, transparenter Modellwechsel

Das Verfahren ist **nicht auf Inkling zugeschnitten**. Es greift für jedes OpenRouter-Modell, das die Harness-Sperre meldet — heute bekannte ebenso wie künftig hinzukommende:

1. **Seed-Liste.** Bekannte gesperrte Modell-IDs sind vorkonfiguriert, damit der erste Aufruf nicht unnötig in den Fehler läuft.
2. **Laufzeiterkennung.** Meldet OpenRouter die Sperre für ein bisher unbekanntes Modell, erkennt die App das an der Providermeldung, merkt sich die Modell-ID und wiederholt den Lauf sofort mit einem Ausweichmodell. Dafür ist kein Update der Anwendung nötig.
3. **Verfall nach 7 Tagen.** Gelernte Sperren laufen ab (`localStorage: befundbrowser-openrouter-gated-models`, ID → Zeitstempel). Ein Modell, das OpenRouter später freigibt, wird dadurch nicht dauerhaft ausgeschlossen.
4. **Kette statt Einzelversuch.** Ist auch das Ausweichmodell gesperrt, rückt die App weiter (maximal drei Modelle pro Lauf).
5. **Sichtbarkeit.** Gelernte Sperren erscheinen sofort als `HARNESS`-Badge im Modellkatalog. Der Wechsel wird in Modellzeile, Datenschutzhinweis, Warnliste, Toast und Versionshistorie ausgewiesen; die Version im Verlauf speichert die real verwendete Modell-ID.

**Messung vom 09.09.2026:** Alle 18 kostenlosen OpenRouter-Modelle wurden einzeln gegen `POST /api/v1/chat/completions` geprüft. Genau zwei sind harness-gesperrt:

| Modell | Status |
|---|---|
| `thinkingmachines/inkling:free` | gesperrt (agentic harnesses only) |
| `thinkingmachines/inkling-small:free` | gesperrt (agentic harnesses only) |
| übrige 16 freie Modelle | regulär aufrufbar |

Die Seed-Liste enthält daher genau diese beiden IDs. Alle weiteren Fälle deckt die Laufzeiterkennung ab.

Ausweichreihenfolge (kuratiert, alle frei, Tool-Calling- und JSON-Schema-fähig, sämtlich gegen die Live-API verifiziert):

```
nvidia/nemotron-3-super-120b-a12b:free
google/gemma-4-31b-it:free
nex-agi/nex-n2.5-pro:free
google/gemma-4-26b-a4b-it:free
dots-studio/dots-3-note-preview:free
```

Ist keines davon im Live-Katalog verfügbar, wählt die App das bestbewertete freie Modell mit Tool- oder Structured-Output-Fähigkeit; ist der Katalog noch nicht geladen, wird der erste Listeneintrag synthetisch verwendet. Standardmodell ist `nvidia/nemotron-3-super-120b-a12b:free`.

Der mehrstufige Loop (Review → lokaler Consistency Guard → Submit) bleibt unverändert erhalten und läuft auf einem Modell, das ihn ausführen darf.

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
- `X-Title: Befundbrowser KSG Intelligence 4.1.3`

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

Intelligence 4.1.3 verwendet folgende Auswertungskaskade:

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

## 12. Oberfläche und Bedienung

### 12.1 Navigation

Die vier Auswahlebenen bauen aufeinander auf; jede Ebene zeigt nur Optionen, die im
gewählten Pfad tatsächlich belegt sind, mit der jeweiligen Fallzahl. Alle drei
Textebenen (Region, Klinische Angaben, Fragestellung) sind durchsuchbar; `Enter`
übernimmt den ersten Treffer.

Innerhalb einer Auswahl steht eine **Trefferleiste** zur Verfügung: `★` ist der
Standard-Normalbefund, die Ziffern sind die nach Repräsentativität sortierten
Originalbefunde. Damit ist jede Vorlage direkt erreichbar, statt sich durch bis zu
mehrere hundert Treffer zu klicken.

### 12.2 Tastatur

| Taste | Wirkung |
|---|---|
| `←` `→` | vorherige / nächste Vorlage |
| `Home` `End` | erste / letzte Vorlage der Gruppe |
| `/` | Fokus in das Suchfeld der aktuell offenen Ebene |
| `C` | Gesamtbefund kopieren |
| `Esc` | Suchfeld verlassen, sonst Auswahl zurücksetzen |

### 12.3 Verlinkbare Auswahl

Eine vollständige Auswahl wird in den URL-Fragmentbezeichner geschrieben
(`#MRT/Becken%20%2F%20Prostata/Prostatakarzinom/Therapie-%20%2F%20OP-Planung`) und
beim Laden wiederhergestellt. Ein Kollege erhält damit über einen Link genau die
Vorlage, die gemeint war. Ungültige oder veraltete Fragmente werden ignoriert.

### 12.4 Bewegung und Effekte

Die Oberfläche nutzt durchgehend Bewegung: Zeigerparallaxe im Hintergrund,
gestaffelt einlaufende Optionslisten, ein sich füllender Fortschrittsbalken,
quittierte Schrittabschlüsse, Einblenden des Berichts beim Wechsel, animierte
Trefferleiste, Zähl-Animation der Kennzahlen, Kopier-Rückmeldung direkt am Auslöser
und ein Skeleton-Zustand, solange der Korpus lädt.

`prefers-reduced-motion: reduce` schaltet diese Effekte auf nahezu null Dauer
zurück, ohne Funktionen zu entfernen. Die Zeigerparallaxe bleibt davon bewusst
ausgenommen, weil sie ausdrücklich gewünscht ist.

### 12.5 Ladeverhalten

Der Korpus ist rund 25 MB groß. Alle Skripte werden mit `defer` geladen, damit die
Oberfläche vor dem Korpus erscheint; die Ausführungsreihenfolge bleibt dabei
erhalten. Bis `BEFUND_DATA` verfügbar ist, zeigen die Kennzahlen einen
Skeleton-Zustand. Gemessen im Chromium-Test: erster Seitenaufbau nach rund 1,4 s.

---

## 13. Paketinhalt und Neuaufbau

Das ausgelieferte Paket ist zugleich Runtime und Quellpaket:

```
Befundbrowser_KSG_Intelligence4_2_0/
├── index.html            Oberfläche
├── styles.css            KSG Aero Glass, Animationen, Bewegungsreduktion
├── core.js               Auswahl-, Filter- und Sortierlogik
├── app.js                Navigation, Viewer, Tastatur, Deep-Links
├── ai-core.js            Prompts, Edit Contract, Parser, Consistency Guard
├── ai.js                 OpenRouter-Transport, Modellkatalog, KI-Werkstatt
├── data/
│   ├── reports.js        Korpus und Standard-Normalbefunde (rund 25 MB)
│   └── build-summary.json Kennzahlen des Builds
├── tools/                Build-Pipeline (siehe unten)
├── README.md             diese Dokumentation
└── README.txt            Kurzhinweis
```

Es gibt kein Framework, kein Build-Werkzeug und kein CDN. `index.html` ist direkt
lauffähig.

### Korpus neu bauen

```bash
python3 tools/build_corpus.py <referenz.csv> data
```

Der Build ist deterministisch: gleiche CSV, gleiches Ergebnis. Er schreibt
`data/reports.js` und `data/build-summary.json` und gibt die Kennzahlen aus.

| Datei | Aufgabe |
|---|---|
| `tools/corpus_parse.py` | CSV-Parsing, Sektionserkennung mit und ohne Doppelpunkt, Schrägstrich-Rückführung |
| `tools/taxonomy_region.py` | Region aus dem RIS-Protokollnamen |
| `tools/taxonomy_text.py` | kontrolliertes Vokabular für Klinische Angaben und Fragestellung, ICD-10-Zuordnung |
| `tools/normal_miner.py` | Auswahl der Normalsätze aus Korpusevidenz |
| `tools/build_corpus.py` | Zusammenbau, Bündelung seltener Kategorien, Ranking, Ausgabe |

### Prüfungen

```bash
node --check core.js && node --check app.js && node --check ai-core.js && node --check ai.js
python3 -c "import sys; sys.path.insert(0,'tools'); import build_corpus"
```

Fachliche Prüfung der erzeugten Vorlagen (jeder Satz muss die Normalprüfung bestehen,
keine inhaltlichen Dubletten, vollständige Abdeckung der Auswahlkombinationen) erfolgt
über die Funktionen in `tools/normal_miner.py`; das Vorgehen ist in Abschnitt 2.3
beschrieben.

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

Intelligence 4.1.3 versucht automatisch:

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


---

## 18. Änderungen in Intelligence 4.1.3

### 18.1 Umbenennung der Anwendung

Der Name „Prof. Schäfer" ist aus dem **Anwendungsnamen** entfernt:

| | vorher | jetzt |
|---|---|---|
| Fenstertitel | Schäfer Befundbrowser · Intelligence 4.1.2 | Befundbrowser · Intelligence 4.1.3 |
| Kopfzeile | Schäfer **Befundbrowser** | KSG **Befundbrowser** |
| Eyebrow | Schäfer Corpus Intelligence | Befundkorpus Intelligence |
| OpenRouter `X-Title` | Schaefer Befundbrowser Intelligence 4.1.2 | Befundbrowser KSG Intelligence 4.1.3 |
| Globale Objekte | `SchaeferAI`, `SchaeferCore`, `SchaeferAppBridge`, `SchaeferAIWorkshop`, `SCHAEFER_DATA` | `BefundAI`, `BefundCore`, `BefundAppBridge`, `BefundAIWorkshop`, `BEFUND_DATA` |
| Storage-Keys | `schaefer-*` | `befundbrowser-*` |

Bereits gespeicherte Einstellungen und API-Keys gehen dabei **nicht** verloren: beim ersten Lesen werden die alten Schlüssel automatisch übernommen und entfernt.

**Bewusst unverändert** bleibt die Nennung als *Befundstil* und als *Herkunftsangabe des Korpus* — dort ist sie eine fachliche Aussage, kein Produktname:

- die Stilvorgabe im KI-Systemprompt („kompakter Prof.-Schäfer-Stil")
- die Kennzeichnung „Schäfer-Stil · Standard-Normalbefund"
- der Provenienzhinweis „Kein Originalbefund von Prof. Schäfer"

### 18.2 Harness-Sperre modellunabhängig behandelt

Die in 4.1.2 für Inkling eingeführte Logik gilt jetzt für **jedes** Modell, das OpenRouter so beschränkt (Details in 6.3):

- Laufzeiterkennung an der Providermeldung — auch für Modelle, die es heute noch nicht gibt, ohne Update der Anwendung.
- Gelernte Sperren werden mit Zeitstempel gespeichert und verfallen nach 7 Tagen, damit eine später aufgehobene Beschränkung nicht dauerhaft nachwirkt.
- Ist auch das Ausweichmodell gesperrt, rückt die App in der Ausweichliste weiter (max. drei Modelle pro Lauf).
- Gelernte Sperren erscheinen sofort als `HARNESS`-Badge im Modellkatalog; ZDR-Kennzeichnung bleibt dabei erhalten.

**Empirische Grundlage:** Alle 18 kostenlosen OpenRouter-Modelle wurden einzeln gegen die Live-API geprüft. Genau die beiden Inkling-Modelle sind gesperrt; die übrigen 16 sind regulär aufrufbar. Die Seed-Liste bildet exakt diesen Messstand ab — alles Weitere übernimmt die Laufzeiterkennung.


---

## 19. Änderungen in Intelligence 4.2.0

Vier Arbeitsschwerpunkte, alle auf Basis der Referenz-CSV neu gebaut.

### 19.1 Kategorisierung

- Region jetzt deterministisch aus dem RIS-Protokollnamen statt aus einer Textheuristik; 343 Protokollvarianten normalisiert, RIS-Abkürzungen expandiert.
- Regionen-Dubletten der Vorversion zusammengeführt (`Ellenbogen / Bizeps` + `Ellenbogen`, `Hand / Handgelenk / Finger` + `Hand / Handgelenk`, `Hals + Thorax` + `Hals / Thorax`, `Gefäße / Angiographie` + `Gefäße / MR-Angiographie`); Kleinstregionen fachlich zugeordnet.
- Klinische Angaben auf ein kontrolliertes Vokabular abgebildet, einschließlich alleinstehender ICD-10-Kodes.
- Fragestellung von 2.893 Freitexten auf 21 kanonische Kategorien abgebildet; der Originalwortlaut bleibt erhalten und wird angezeigt.
- Seltene Kategorien werden innerhalb ihres Pfades gebündelt. Sackgassen mit genau einem Treffer: von 69,2 % auf 3,1 % gesunken, Median je Kombination von 1 auf 5 gestiegen.
- Rückführung der Export-Schrägstriche korrigiert: `1/5 Tesla` → `1,5 Tesla`, `2/2 cm` → `2,2 cm`, während `LWK 4/5` und `ng/ml` erhalten bleiben.

### 19.2 Standard-Befundvorlagen

- Vollständig aus Korpusevidenz abgeleitet: 337 Vorlagen mit 337 verschiedenen Texten statt 1.701 Referenzen aus 35 Bausteinen; keine Vorlage ohne Evidenz.
- Jeder Satz wird mit seiner Belegzahl ausgewiesen.
- Satzformfilter verhindert, dass ein positiver pathologischer Befund mit Nebensatz-Verneinung in eine Normalvorlage gerät — im Test tatsächlich aufgetreten und behoben.
- Auswahl nach Distinktivität statt roher Häufigkeit; Dublettenerkennung über Stemming, Synonymklassen und Kompositazerlegung.
- Bei dünner fragestellungsgenauer Evidenz wird die belastbarere Regionsevidenz verwendet; die Basis wird ausgewiesen.
- Prüfung über alle 337 Vorlagen: kein Satz verfehlt die Normalprüfung, kein positiver Pathologiemarker ohne führende Verneinung, keine inhaltliche Dublette, 100 % Abdeckung der Auswahlkombinationen.

### 19.3 KI-Prompt

- Systemprompt in Änderungsregeln und Stilregeln getrennt, medizinischer Inhalt ausdrücklich über den Stil gestellt.
- Stilregeln mit den quantitativen Ankern des Korpus hinterlegt (Satzlängen, Verdichtung der Beurteilung).
- Negationslogik (`Kein Nachweis` vs. `Keine Hinweise auf`) und Koordinationsregel ergänzt; Erhalt der Schrägstrich-Notation gefordert.
- Abschließende Selbstprüfung auf Seitenangaben, Maße, Zahlen, Vergleichsangaben und Sicherheitsgrade.
- Der Kontext enthält jetzt auch klinische Angaben und Fragestellung im Originalwortlaut sowie den Untersuchungstitel.

### 19.4 Oberfläche

- Ebene 3 heißt jetzt `Klinische Angaben` statt `Thema` und entspricht damit dem Quellfeld.
- Suchfeld für die Region ergänzt; `Enter` übernimmt in allen Suchfeldern den ersten Treffer.
- Trefferleiste für den direkten Sprung zu jeder Vorlage der Gruppe.
- Tastatursteuerung: `←` `→`, `Home`, `End`, `/`, `C`, `Esc`.
- Verlinkbare Auswahl über den URL-Fragmentbezeichner.
- Neue Animationen: Zähl-Animation der Kennzahlen, Trefferleiste, quittierter Schrittabschluss, Kopier-Rückmeldung am Auslöser, Skeleton während des Ladens. `prefers-reduced-motion` wird respektiert.
- Skripte mit `defer`: erster Seitenaufbau nach rund 1,4 s statt Blockade durch den 25-MB-Korpus.
- Behoben: Die Zähl-Animation konnte kurzzeitig negative Werte anzeigen, weil der Zeitstempel von `requestAnimationFrame` vor dem zuvor gelesenen `performance.now()` liegen kann.
- Angepasst an das neue Datenschema: Herkunftsangaben und Kennzeichnungen der Vorlagen zeigten sonst leere Werte.

### 19.5 Reproduzierbarkeit

Der Korpus wird nicht mehr als Blackbox ausgeliefert. `tools/` enthält den vollständigen Build:

```
python3 tools/build_corpus.py <referenz.csv> Befundbrowser_KSG_Intelligence/data
```

| Datei | Aufgabe |
|---|---|
| `tools/corpus_parse.py` | CSV-Parsing, Sektionserkennung, Schrägstrich-Rückführung |
| `tools/taxonomy_region.py` | Region aus dem RIS-Protokollnamen |
| `tools/taxonomy_text.py` | kontrolliertes Vokabular für Klinische Angaben und Fragestellung |
| `tools/normal_miner.py` | Auswahl der Normalsätze aus Korpusevidenz |
| `tools/build_corpus.py` | Zusammenbau, Bündelung, Ranking, Ausgabe |
