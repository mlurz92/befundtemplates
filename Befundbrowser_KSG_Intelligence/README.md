# KSG Befundbrowser · Intelligence 5.0

**Klinik für Radiologie und Nuklearmedizin · Klinikum St. Georg Leipzig**

Lokale Anwendung zur Auswahl, Anpassung und Übernahme radiologischer Beispielbefunde
im Prof.-Schäfer-Stil. Läuft vollständig im Browser, ohne Server, ohne Framework,
ohne CDN. Nur die optionale KI-Funktion benötigt eine Internetverbindung.

---

## Inhalt

1. [Was die Anwendung leistet](#1-was-die-anwendung-leistet)
2. [Schnellstart](#2-schnellstart)
3. [Bedienung](#3-bedienung)
4. [Die drei Texttypen](#4-die-drei-texttypen)
5. [Datengrundlage und Kategorisierung](#5-datengrundlage-und-kategorisierung)
6. [Standard-Befundvorlagen](#6-standard-befundvorlagen)
7. [Der Prof.-Schäfer-Stil in dieser Anwendung](#7-der-prof-schäfer-stil-in-dieser-anwendung)
8. [KI-Werkstatt](#8-ki-werkstatt)
9. [OpenRouter einrichten](#9-openrouter-einrichten)
10. [Probleme mit kostenlosen Modellen](#10-probleme-mit-kostenlosen-modellen)
11. [Datenschutz](#11-datenschutz)
12. [Paketinhalt und Neuaufbau](#12-paketinhalt-und-neuaufbau)
13. [Störungssuche](#13-störungssuche)
14. [Versionsverlauf](#14-versionsverlauf)
15. [Sicherheitshinweis](#15-sicherheitshinweis)

---

## 1. Was die Anwendung leistet

Die Anwendung beantwortet eine einzige Frage schnell und belegbar:

> *Wie hat Prof. Schäfer eine Untersuchung dieser Art bei dieser Fragestellung befundet?*

Dafür stehen 11.796 Originalbefunde bereit (7.367 MRT,
4.429 CT). Die Originale werden nicht verändert, sondern
indexiert, kategorisiert und nach Repräsentativität sortiert.

Drei Bausteine:

| Baustein | Zweck |
|---|---|
| **Clinical Navigator** | vier aufeinander aufbauende Auswahlebenen bis zur passenden Fallgruppe |
| **Standard-Normalbefund** | korpusbasierte Normalvorlage als erster Treffer jeder Gruppe |
| **AI Report Workshop** | kontrollierte Anpassung einer Vorlage über OpenRouter, mit lokaler Absicherung |

Was die Anwendung **nicht** tut: Sie befundet keine Bilder, sie stellt keine Diagnose,
und sie ersetzt keine ärztliche Prüfung. Sie liefert Textvorlagen.

---

## 2. Schnellstart

1. ZIP entpacken.
2. `index.html` im Browser öffnen (Doppelklick genügt; ein Webserver ist nicht nötig).
3. Modalität, Region, Klinische Angaben und Fragestellung wählen.
4. Vorlage lesen, mit **Kopieren** übernehmen.

Für die KI-Funktion zusätzlich: **KI & Modelle** öffnen, OpenRouter-API-Key eintragen,
Modell wählen. Ohne Key ist die Anwendung voll benutzbar — nur die Anpassung entfällt.

---

## 3. Bedienung

### 3.1 Die vier Auswahlebenen

| Ebene | Inhalt | Anzahl |
|---|---|---:|
| 1 · Modalität | CT oder MRT | 2 |
| 2 · Untersuchungsregion | anatomische Region der gefahrenen Untersuchung | 33 |
| 3 · Klinische Angaben | Indikation bzw. Grunderkrankung | 46 |
| 4 · Fragestellung | diagnostische Aufgabe | 21 |

Jede Ebene zeigt nur Optionen, die im gewählten Pfad tatsächlich belegt sind, mit der
jeweiligen Fallzahl rechts. Die Ebenen 2 bis 4 sind durchsuchbar; `Enter` übernimmt den
ersten Treffer. Insgesamt ergeben sich 1.233 Auswahlkombinationen mit
im Median 5 Vorlagen.

### 3.2 Trefferleiste und Vorlagenansicht

Nach der vierten Auswahl erscheint die Trefferleiste:

- `★` — der Standard-Normalbefund der Gruppe, immer an erster Stelle
- `1`, `2`, `3` … — die Originalbefunde, nach Repräsentativität sortiert

Ein Klick springt direkt zu einer Vorlage. Die Ansicht zeigt je nach Typ:

| Feld | Original | Normalbefund |
|---|---|---|
| Klinische Angaben und Fragestellung im Originalwortlaut | ja | entfällt |
| Befund und Beurteilung | ja | ja |
| Methodik, RIS-Studienbeschreibung, Korpuszeile | ja | entfällt |
| Belegte Korpussätze mit Häufigkeit | entfällt | ja |
| Repräsentativitätsrang | ja | entfällt |

### 3.3 Tastatur

| Taste | Wirkung |
|---|---|
| `←` `→` | vorherige / nächste Vorlage |
| `Home` `End` | erste / letzte Vorlage der Gruppe |
| `/` | Fokus in das Suchfeld der aktuell offenen Ebene |
| `C` | Gesamtbefund kopieren |
| `Esc` | Suchfeld verlassen, sonst Auswahl zurücksetzen |
| `Strg` + `Enter` | im Anweisungsfeld: KI-Änderung starten |

### 3.4 Verlinkbare Auswahl

Eine vollständige Auswahl steht im URL-Fragment:

```
index.html#MRT/Becken%20%2F%20Prostata/Prostatakarzinom/Therapie-%20%2F%20OP-Planung
```

Der Link stellt die Auswahl beim Öffnen wieder her. Ungültige Fragmente werden ignoriert.

### 3.5 Kopieren

Drei Schaltflächen: **Befund**, **Beurteilung** und **Gesamtbefund**. Der Gesamtbefund
enthält bei Originalen zusätzlich klinische Angaben und Fragestellung. Wird gerade ein
KI-Entwurf angezeigt, wird dieser kopiert, nicht das Original.

---

## 4. Die drei Texttypen

Die Anwendung trennt strikt und kennzeichnet in der Oberfläche:

| Typ | Kennzeichen | Herkunft |
|---|---|---|
| **Originalbefund** | `ORIGINAL` | unveränderter Datensatz aus dem Korpus |
| **Standard-Normalbefund** | `★ REFERENZ` | aus Korpussätzen zusammengesetzte Vorlage, kein zusammenhängendes Originalzitat |
| **KI-Entwurf** | `✦ KI-ENTWURF` | temporäre Transformation, erst nach manueller Übernahme im Viewer |

Der Korpus wird durch keine dieser Operationen verändert.

---

## 5. Datengrundlage und Kategorisierung

Aktueller Build: `2026-09-09-intelligence-5-0`

| Kennzahl | Wert |
|---|---:|
| Originaldatensätze | 11.796 |
| Auswahlkombinationen | 1.233 |
| davon mit nur einem Treffer | 38 (3.1 %) |
| Median Vorlagen je Kombination | 5 |
| Standard-Normalbefunde | 337 |
| exakte Dubletten (nur nachgeordnet) | 33 |

### 5.1 Normalisierung des Exports

Der RIS-Export ersetzt jedes Komma durch `/`. Drei Klassen werden unterschieden:

| Klasse | Beispiel | Ergebnis |
|---|---|---|
| Listenkomma | `Leber/ Milz` | `Leber, Milz` |
| Dezimalkomma vor Einheit | `1/5 Tesla`, `2/2 cm` | `1,5 Tesla`, `2,2 cm` |
| echte Notation | `LWK 4/5`, `ng/ml`, `12/2023` | unverändert |

Pauschales Ersetzen würde `1/5 Tesla` zu `1, 5 Tesla` und `ng/ml` zu `ng, ml` verfälschen.

Die Abschnittserkennung kommt mit beiden Korpusformaten zurecht — mit Doppelpunkt
(`Befund:`) und ohne (`Befund `): 9.476 Befunde über
das explizite Schema, 2.108 über das
ältere Markerschema, 212 heuristisch.

### 5.2 Herkunft der vier Ebenen

| Ebene | Quelle | Verfahren |
|---|---|---|
| Modalität | Feld `Modalität` | erstes Token (`MR\SR` → MRT) |
| Region | Feld `Studienbeschreibung` | Regelwerk über den RIS-Protokollnamen |
| Klinische Angaben | Abschnitt `Klin. Angaben` | kontrolliertes Vokabular inkl. ICD-10-Kodes |
| Fragestellung | Abschnitt `Fragestellung` | kontrolliertes Vokabular |

Die Region stammt bewusst aus dem Protokollnamen: Er beschreibt die tatsächlich
gefahrene Untersuchung und ist damit verlässlicher als eine Textheuristik über den
Befund. Die 343 Protokollvarianten (`Becken Prostata`, `Becken^Prostata`,
`Becken_neu^Prostata`) werden normalisiert, RIS-Abkürzungen expandiert.

Die Fragestellung lag im Rohkorpus als Freitext vor — 2.893 Formulierungen, ganz
überwiegend Einzelvorkommen. Als Navigationsebene war das wertlos, weil die Auswahl auf
genau eine Vorlage führte. Sie wird auf 21 kanonische
Fragestellungen abgebildet; der Originalwortlaut bleibt am Datensatz und wird angezeigt.
Seltene Kategorien werden innerhalb ihres Pfades zu *Weitere Indikationen* bzw.
*Weitere Fragestellungen* gebündelt.

---

## 6. Standard-Befundvorlagen

Jede der 337 Vorlagen ist **aus dem Korpus abgeleitet**, nicht
formuliert. Je Modalität, Region und Fragestellung werden die tatsächlich verwendeten
Negativ- und Normalsätze gezählt und die typischsten zusammengesetzt. Jeder Satz wird
mit seiner Belegzahl angezeigt.

Vier Auswahlkriterien:

1. **Zulässige Satzform.** Nur ein Satz mit führender Verneinung oder Normalitätsaussage
   (`Keine Sekretverhalte.`) oder eine kopulative Normalaussage
   (`Die Prostatakapsel ist intakt.`). Eine Verneinung irgendwo im Satz genügt nicht:
   *„Das Hauptfragment, in dem keine Schrauben verankert sind, ist abgerutscht."* enthält
   `keine` und ist dennoch ein positiver pathologischer Befund. Sätze mit Maßen,
   Datumsangaben, Seitenangaben, Vergleichsbezug oder einschränkenden Konjunktionen
   entfallen.
2. **Distinktivität statt Häufigkeit.** `Kein Aszites.` ist in fast jeder Region häufig.
   Gewertet wird der Anteil in der Gruppe gegenüber dem Anteil im Gesamtkorpus, damit
   keine abdominellen Sätze in eine NNH-Vorlage geraten.
3. **Dublettenfreiheit.** Über Stemming, Synonymklassen und Kompositazerlegung gelten
   `Keine Lungenmetastasen.` / `Keine pulmonalen Metastasen.` und
   `Normales Knochenmark.` / `Unauffälliges Knochenmark.` als dieselbe Aussage.
4. **Belastbare Evidenz vor genauer Passung.** Trägt die fragestellungsgenaue Evidenz
   nicht, wird die breitere Regionsevidenz verwendet. Eine Vorlage aus Sätzen, die je
   genau einmal im Korpus stehen, ist kein Standard.

Der Zielbefund der Fragestellung steht am Anfang, nicht hinter einem Organinventar.

**Beurteilungszeile.** Sie muss die Fragestellung beantworten. Wo der Korpus einen
passenden, verdichteten Negativsatz hergibt, wird er übernommen
(55 Vorlagen, etwa `Kein Lokalrezidiv.` oder `Kein Metastasennachweis.`);
sonst greift eine kuratierte, ebenso knappe Zeile (282 Vorlagen).

| Kennzahl | Wert |
|---|---:|
| Vorlagen / verschiedene Texte | 337 / 233 |
| Evidenzniveau hoch / mittel / orientierend | 26 / 86 / 225 |
| Basis Fragestellung / Region | 152 / 185 |
| Abdeckung der Auswahlkombinationen | 100 % |

Das Evidenzniveau steht an jeder Vorlage. Die ärztliche Endkontrolle bleibt in jedem
Fall erforderlich.

---

## 7. Der Prof.-Schäfer-Stil in dieser Anwendung

### 7.1 Quantitative Anker

Aus der Auswertung des Korpus:

| Merkmal | Median | 90. Perzentil |
|---|---:|---:|
| Satzlänge Befund | 6 Wörter | 17 Wörter |
| Satzlänge Beurteilung | 4 Wörter | 13 Wörter |
| Beurteilung im Verhältnis zum Befund | 14 % | — |

Das sind **Richtwerte, keine Quoten**. Ein klinisch notwendiger Satz darf länger sein.
Die Anwendung prüft daher auf Ausreißer und meldet sie; sie erzwingt keine Zahlen.

Weitere Merkmale des Stils:

- kompakte, informationsdichte Prosa, häufig nominal, in der Regel eine eigenständige
  diagnostische Aussage pro Satz,
- diagnostisches Ziel und ein gültiger Vergleich stehen früh,
- Maße stehen unmittelbar bei dem Befund, den sie quantifizieren,
- unabhängige Aussagen werden nicht mechanisch mit `und` verkettet,
- `Kein Nachweis …` bezeichnet die Nichtdarstellung einer **Struktur**,
  `Keine Hinweise auf …` das Fehlen von Zeichen eines **Prozesses** — die beiden
  Wendungen sind keine Synonyme,
- keine Lehrbuchprosa, keine Übergangsfloskeln, keine Wiederholung der Fragestellung.

### 7.2 Die Stil-Engine

`ai-core.js` enthält eine deterministische Stilprüfung, die auf beide Textquellen
angewendet wird — auf die Standardvorlagen im Build und auf jede KI-Ausgabe zur Laufzeit.

Geprüft wird:

| Prüfung | Auslöser |
|---|---|
| Befundsatz deutlich zu lang | über 26 Wörter |
| Unabhängige Aussagen mit `und` verkettet | über 17 Wörter und `und` im Satz |
| Beurteilungssatz zu lang | über 20 Wörter |
| Beurteilung zu wenig verdichtet | über 55 % der Befundlänge bei mindestens 40 Befundwörtern |
| Nicht korpustypische Wendung | acht Floskelmuster, u. a. `Es zeigt sich hier`, `Zusammenfassend lässt sich` |
| Negationslogik | `Keine Hinweise auf` + Struktur, `Kein Nachweis` + Prozess |

Zusätzlich wird die Typografie deterministisch normalisiert (Leerzeichen, Satzzeichen,
Satzabschluss). Diese Normalisierung ändert ausschließlich Zeichensetzung, niemals
Wortlaut, Zahlen oder Reihenfolge.

### 7.3 Der Stilkorrekturpass

Verletzt eine KI-Fassung die Anker, folgt **genau ein** Korrekturpass. Er bekommt die
konkreten Beanstandungen vorgelegt und darf ausschließlich die Formulierung ändern:
lange Sätze trennen, Floskeln streichen, die Beurteilung verdichten, die Negationslogik
richtigstellen.

Entscheidend ist die Absicherung danach: Das Ergebnis wird mit demselben Consistency
Guard geprüft, der auch die inhaltliche Änderung absichert. Hat sich Lateralisierung,
Zahl, Maß, Negation, Sicherheitsgrad oder Vergleich bewegt, **wird der Korrekturpass
verworfen** und die inhaltlich gesicherte Fassung bleibt bestehen. Ebenso, wenn er die
Zahl der Abweichungen nicht senkt. Der Vorgang wird in der Statusanzeige und am
Ergebnis ausgewiesen.

### 7.4 Nachweis über alle Vorlagen

```bash
node tools/verify_templates.mjs .
```

Prüft jede der 337 Standardvorlagen mit derselben Engine. Aktueller Stand:

```
Vorlagen: 337
Stilverstöße: 0
längster Befundsatz: 14 Wörter (Grenze 26)
längster Beurteilungssatz: 7 Wörter (Grenze 20)
```

Das Skript endet mit Rückgabewert 1, sobald eine Vorlage abweicht, und eignet sich damit
als Prüfschritt nach jedem Neuaufbau.

---

## 8. KI-Werkstatt

### 8.1 Ablauf

1. Vorlage auswählen, **Mit KI anpassen** öffnen.
2. Ausgangsbefund und Ausgangsbeurteilung stehen unverändert links als Referenz.
3. Änderungsanweisung formulieren — frei oder über eine der sechs Schnellaktionen.
4. `Strg` + `Enter` oder **Änderung mit KI ausführen**.
5. Die Anwendung durchläuft die Pipeline (siehe 8.2) und zeigt das Ergebnis mit
   Semantic Diff, Stilbericht und Warnliste.
6. Weitere Änderungen sind möglich; Undo, Redo und Rückkehr zum Original stehen bereit.
7. Erst **In Befundviewer übernehmen** macht den Entwurf zur angezeigten Fassung.

### 8.2 Live-Status

Während des Laufs zeigt die Anwendung den tatsächlichen Stand — keine Fortschrittsattrappe:

- **Aktueller Schritt** mit Detailzeile (Modell, Transport, Prüfumfang)
- **Laufzeit**, die sichtbar mitläuft, sodass ein hängender Aufruf erkennbar ist
- **Protokoll** der abgeschlossenen Schritte mit Einzeldauer
- **Kennzahlen** am Ende: Modell, Anzahl Modellaufrufe, Tokenverbrauch, Befundsätze,
  Verdichtungsgrad

Die möglichen Schritte:

| Schritt | Bedeutung |
|---|---|
| Modellaufruf 1 von 2 · Entwurf | erster Aufruf im agentischen Harness |
| Lokaler Consistency Guard | Prüfung des Entwurfs im Browser |
| Modellaufruf 2 von 2 · Endfassung | Rückgabe der Prüfhinweise, Einreichung der Endfassung |
| Modellaufruf · Transformation | einstufiger Pfad bei Modellen ohne Harness-Pflicht |
| Format-Reparatur | nur wenn die Antwort nicht sicher zerlegbar war |
| Modellwechsel nach Formatfehler | nur wenn auch die Reparatur scheiterte; einmalig |
| Stilprüfung | Abgleich mit den Korpusankern |
| Stilkorrektur | nur bei Abweichungen; wird bei inhaltlicher Bewegung verworfen |

### 8.3 Edit Contract

Der Systemprompt trennt Änderungs- und Stilregeln und stellt den medizinischen Inhalt
ausdrücklich über den Stil.

**Änderungsregeln**

- ausschließlich die verlangten medizinischen Sachverhalte ändern,
- jede übrige Befundtatsache semantisch exakt erhalten: Seitenangabe, Lokalisation,
  Segment, Maße, Anzahl, Vergleichsdynamik, diagnostische Sicherheit, relevante
  Negativbefunde,
- nichts hinzuerfinden: keine Pathologie, keine Voruntersuchung, kein Vergleichsintervall,
  keine Methodik, keine Sequenzliste, keine Serien- oder Bildnummer, keine Empfehlung,
  kein Normalbefund-Inventar,
- Unsicherheitsgrade weder verstärken noch abschwächen,
- Befund und Beurteilung widerspruchsfrei halten,
- immer die vollständige Fassung ausgeben.

Abschließend fordert der Prompt eine stille Selbstprüfung auf Seitenangaben, Maße,
Zahlen, Vergleichsangaben und Sicherheitsgrade.

### 8.4 Consistency Guard

Unabhängig vom Modell prüft die Anwendung lokal und meldet:

| Prüfung | Meldung |
|---|---|
| Lateralisierung | rechts / links / beidseits verändert |
| Zahlen und Maße | hinzugekommene oder entfallene Werte |
| Negation | veränderte Zahl der Negationsmarker |
| Diagnostische Sicherheit | `V. a.`, `suspekt`, `am ehesten` gegen `gesichert`, `Nachweis` |
| Vergleich neu eingeführt | Verlaufsangabe ohne Grundlage im Ausgangstext |
| Widerspruch Befund / Beurteilung | unterschiedliche Seite oder gegenläufige Polarität |

Jede Meldung ist gekennzeichnet, ob sie durch die Anweisung gedeckt ist
(`in Anweisung`) oder zu prüfen bleibt (`prüfen`). Der Guard blockiert nicht — er macht
sichtbar.

### 8.5 Semantic Diff und Versionierung

Der Diff arbeitet auf Wortebene über die längste gemeinsame Teilfolge und zeigt
Hinzufügungen und Entfernungen gegen die Vorversion. Jede Änderung erzeugt eine neue
Version (`V1`, `V2`, …) mit Undo, Redo und Sprung zu jeder Zwischenfassung.

---

## 9. OpenRouter einrichten

1. Konto auf [openrouter.ai](https://openrouter.ai) anlegen, API-Key erzeugen.
2. In der Anwendung **KI & Modelle** öffnen, Key eintragen.
3. `API-Key auf diesem Gerät speichern` nur setzen, wenn das Gerät ausschließlich von
   Ihnen genutzt wird — der Key liegt dann unverschlüsselt im Browserprofil.
4. **Verbindung testen** lädt den Live-Modellkatalog.
5. Modell auswählen. Kostenlose Modelle stehen oben.

Die Anwendung sendet die von OpenRouter dokumentierten Attribution-Header
(`HTTP-Referer`, `X-Title`) und keine weiteren. Andere `X-OpenRouter-*`-Header stehen
nicht in der CORS-Freigabe und lassen den Aufruf bereits im Preflight scheitern.

Zwei Datenschutzschalter stehen zur Verfügung: `provider.data_collection = deny` und
`provider.zdr = true`.

---

## 10. Probleme mit kostenlosen Modellen

Kostenlose OpenRouter-Endpunkte sind für diese Anwendung attraktiv — sie kosten nichts
und viele bieten große Kontextfenster. Sie sind aber **deutlich unzuverlässiger als der
Modellkatalog vermuten lässt**. Dieser Abschnitt dokumentiert, was gemessen wurde und
wie die Anwendung damit umgeht.

### 10.1 Messaufbau

Getestet wurde nicht ein generischer Prompt, sondern **exakt die Anfrage, die die
Anwendung stellt**: dieselbe Vorlage, derselbe Systemprompt, dieselbe Pfadentscheidung
(JSON-Schema bei `response_format`-Fähigkeit, sonst Tool Calling), einschließlich des
Format-Reparaturpasses bei unbrauchbarer erster Antwort.

Aufgabe: In eine Knie-MRT-Normalvorlage ist eine Innenmeniskus-Hinterhornläsion zu
ergänzen, alle übrigen Aussagen bleiben unverändert.

Bewertet wurde:

| Kriterium | Prüfung |
|---|---|
| **Antwort brauchbar** | Befund und Beurteilung sicher trennbar |
| **Anweisung umgesetzt** | die verlangte Läsion steht im Text |
| **Fakten bewahrt** | Außenmeniskus und Knorpelaussagen unverändert vorhanden |
| **Stil** | Verstöße gegen die Korpusanker aus Abschnitt 7 |

### 10.2 Ergebnisse

| Modell | Ergebnis | Aufrufe | Reparaturpass | Stilabweichungen | Laufzeit |
|---|---|---:|---|---:|---:|
| `inclusionai/ling-3.0-flash-sante:free` | GUT | 1 | nein | 0 | 5,7 s |
| `nex-agi/nex-n2.5-pro:free` | GUT | 1 | nein | 0 | 23,9 s |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | GUT | 1 | nein | 0 | 21,7 s |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | GUT | 2 | ja | 0 | 98,9 s |
| `cohere/north-mini-code:free` | UNPARSBAR | 2 | ja | 0 | 24,8 s |
| `dots-studio/dots-3-note-preview:free` | UNPARSBAR | 2 | ja | 0 | 30,2 s |
| `inclusionai/ling-3.0-flash-fin:free` | UNPARSBAR | 2 | ja | 0 | 12,1 s |
| `liquid/lfm-2.5-2.6b:free` | UNPARSBAR | 2 | ja | 0 | 20,7 s |
| `nex-agi/nex-n2.5-mini:free` | UNPARSBAR | 2 | ja | 0 | 15,2 s |
| `nvidia/nemotron-3-super-120b-a12b:free` | UNPARSBAR | 2 | ja | 0 | 22,7 s |
| `nvidia/nemotron-3.5-content-safety:free` | UNPARSBAR | 2 | ja | 0 | 7,6 s |
| `thinkingmachines/inkling-small:free` | GESPERRT | 0 | — | — | 0,2 s |
| `thinkingmachines/inkling:free` | GESPERRT | 0 | — | — | 0,0 s |
| `poolside/laguna-s-2.1:free` | RATE LIMIT | 0 | — | — | 0,1 s |
| `google/gemma-4-26b-a4b-it:free` | NICHT ROUTBAR | 0 | — | — | 0,0 s |
| `google/gemma-4-31b-it:free` | NICHT ROUTBAR | 0 | — | — | 0,1 s |
| `nvidia/nemotron-3.5-lightning:free` | ZEITÜBERSCHREITUNG | 0 | — | — | 75,0 s |
| `poolside/laguna-xs-2.1:free` | ZEITÜBERSCHREITUNG | 0 | — | — | 75,0 s |

Von 18 kostenlosen Modellen lieferten **4 eine brauchbare Fassung**, 7 hielten das
Ausgabeformat auch nach dem Reparaturpass nicht ein, 2 sind zugangsgesperrt, 2 im Katalog
gelistet aber nicht routbar, 2 antworteten binnen 75 Sekunden gar nicht, 1 lief in ein
Rate Limit.

Bemerkenswert: Das schnellste brauchbare Modell war mit 5,7 Sekunden ein kleines,
medizinisch getuntes (`ling-3.0-flash-sante`), während das größte Modell des Feldes
(`nemotron-3-ultra-550b`) 98,9 Sekunden benötigte und einen Reparaturpass brauchte.

### 10.3 Die Fehlerbilder

**1 · Zugangssperre.** Die Thinking-Machines-Modelle (`inkling`, `inkling-small`) geben
kostenlosen Zugang ausschließlich für auf openrouter.ai/apps registrierte
Agentic-Harness-Clients frei:

> `… is only available on agentic harnesses. Try plugging it into a coding agent or productivity app listed on https://openrouter.ai/apps`

Maßgeblich ist die registrierte App-Identität, nicht die Struktur der Anfrage. Eine
eigenständige Web-Anwendung kann diese Endpunkte **nicht** aufrufen — auch nicht mit
einem fachlich vollwertigen mehrstufigen Tool-Loop. Der Fehler tritt sofort auf
(unter 200 ms), noch bevor das Modell Text erzeugt.

**2 · Im Katalog gelistet, aber nicht ausführbar.** Einzelne Modelle stehen unter
`/api/v1/models`, liefern beim Aufruf aber HTTP 404. Der Katalog ist damit keine
Verfügbarkeitszusage.

**3 · Rate Limits.** Kostenlose Endpunkte teilen sich ein knappes Kontingent. HTTP 429
kann bereits beim ersten Aufruf des Tages auftreten und ist nicht an Ihr Nutzungsverhalten
gebunden.

**4 · Zeitüberschreitung.** Mehrere Endpunkte antworten unter Last überhaupt nicht.
Im Test wurde nach 75 Sekunden abgebrochen.

**5 · Unbrauchbares Ausgabeformat — der häufigste Fall.** Das ist die eigentliche
Schwachstelle. Modelle, die im Katalog `response_format` und `tools` führen, halten das
erzwungene JSON-Schema oder den Tool-Aufruf trotzdem nicht ein. Typische Muster:

- Fließtext statt strukturierter Ausgabe,
- JSON in einem Markdown-Codeblock mit erklärendem Vor- und Nachtext,
- nur der Befund, ohne Beurteilung,
- eine Beschreibung der Änderung statt des geänderten Befundes,
- der Tool-Aufruf wird angekündigt, aber nicht ausgeführt.

**6 · Anweisung ignoriert.** Manche Modelle geben die Ausgangsvorlage nahezu unverändert
zurück. Das ist der gefährlichste Fall, weil das Ergebnis auf den ersten Blick sauber
aussieht — deshalb prüft die Anwendung mit dem Semantic Diff, ob überhaupt etwas
geändert wurde.

**7 · Stil.** Auch inhaltlich brauchbare Antworten weichen regelmäßig vom Korpusstil ab:
lange verkettete Sätze, Übergangsfloskeln, eine Beurteilung, die den Befund nacherzählt
statt ihn zu verdichten.

**8 · Instabilität zwischen Läufen.** Derselbe Endpunkt liefert bei Wiederholung ein
anderes Ergebnis — im Vergleich zweier Messreihen wechselten mehrere Modelle zwischen
brauchbar, unparsbar und Zeitüberschreitung. Eine einmalige gute Antwort ist daher keine
Zusage für den nächsten Lauf.

### 10.4 Was die Anwendung dagegen tut

| Fehlerbild | Gegenmaßnahme |
|---|---|
| Zugangssperre | Gesperrte Modelle werden erkannt, gemerkt (mit Verfall nach 7 Tagen) und automatisch durch ein gleichwertiges freies Modell ersetzt. Der Wechsel wird offen ausgewiesen, nie stillschweigend vollzogen. |
| Nicht routbar, Rate Limit | Klartextmeldung mit Statuscode statt roher Providermeldung. |
| Zeitüberschreitung | Die Laufzeit läuft sichtbar mit, sodass ein hängender Aufruf sofort erkennbar ist. |
| Unbrauchbares Format | Mehrstufige Parserkaskade (JSON, Tool-Argumente, Markdown-Codeblock, Abschnittsmarker, Überschriftsvarianten, Absatzheuristik), dann ein Format-Reparaturpass, dann **einmalig das nächste Modell der Ausweichkette**. Scheitert auch das, bleibt die Ausgangsvorlage unverändert — es wird nie eine halbe Fassung übernommen. |
| Anweisung ignoriert | Semantic Diff und Consistency Guard machen sichtbar, was sich tatsächlich geändert hat. |
| Stilabweichung | Stilprüfung gegen die Korpusanker und ein abgesicherter Stilkorrekturpass (Abschnitt 7.3). |
| Instabilität | Alle Prüfungen laufen bei **jedem** Lauf, nicht nur beim ersten. |

### 10.5 Empfehlung für den Alltag

1. Für die tägliche Arbeit ist ein **kostenpflichtiges Modell mit verlässlichem
   Structured Output** die ruhigere Wahl. Die Anwendung ist nicht auf kostenlose
   Endpunkte angewiesen — der Modellkatalog steht vollständig offen.
2. Wer kostenlos arbeitet: Modell wechseln, sobald zweimal hintereinander eine
   Formatreparatur nötig war. Die Statusanzeige zeigt das an.
3. Kontextlänge ist **kein** Qualitätsmerkmal. Modelle mit sehr großem Kontextfenster
   schnitten im Test nicht besser ab.
4. Die Angaben `response_format` und `tools` im Katalog sind Absichtserklärungen des
   Anbieters, keine Garantie.
5. Keine Patientendaten in kostenlose Endpunkte.

**Die Ausweichkette der Anwendung folgt dieser Messung**, nicht den Katalogangaben:

```
inclusionai/ling-3.0-flash-sante:free          Standard, schnellste brauchbare Antwort
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
nex-agi/nex-n2.5-pro:free
nex-agi/nex-n2.5-mini:free
nvidia/nemotron-3-super-120b-a12b:free         nur über den Reparaturpass brauchbar
```

Die beiden zuvor eingetragenen Gemma-4-Endpunkte wurden entfernt: Sie stehen im Katalog,
antworten beim Aufruf aber mit HTTP 404. Ist keines der Modelle verfügbar, wählt die
Anwendung das bestbewertete freie Modell des Live-Katalogs mit Tool- oder
Structured-Output-Fähigkeit.

---

## 11. Datenschutz

| Punkt | Verhalten |
|---|---|
| Korpus | liegt lokal in `data/reports.js`, verlässt den Rechner nie |
| Auswahl und Navigation | vollständig lokal, keine Telemetrie |
| API-Key | standardmäßig nur für die Sitzung (`sessionStorage`); dauerhaft nur auf ausdrückliche Anforderung, dann unverschlüsselt im Browserprofil |
| KI-Anfrage | überträgt Kontext, Befund, Beurteilung und Anweisung an OpenRouter |
| Provider-Filter | `Provider mit Datensammlung ausschließen` und `Nur Zero-Data-Retention-Endpunkte` schränken die Weitergabe ein |

**Kostenlose Endpunkte protokollieren Prompts und Ausgaben in der Regel und verwenden
sie zur Modellverbesserung.** In die KI-Werkstatt gehören daher keine vertraulichen oder
personenbezogenen Patientendaten. Die Vorlagen des Korpus sind deidentifiziert; eigene
Ergänzungen sind es nicht automatisch.

---

## 12. Paketinhalt und Neuaufbau

```
Befundbrowser_KSG_Intelligence5_0/
├── index.html            Oberfläche
├── styles.css            Aero Glass, Animationen, Bewegungsreduktion
├── core.js               Auswahl-, Filter- und Sortierlogik
├── app.js                Navigation, Viewer, Tastatur, Deep-Links
├── ai-core.js            Prompts, Edit Contract, Parser, Consistency Guard, Stil-Engine
├── ai.js                 OpenRouter-Transport, Modellkatalog, KI-Werkstatt, Live-Status
├── data/
│   ├── reports.js        Korpus und Standard-Normalbefunde
│   └── build-summary.json Kennzahlen des Builds
├── tools/                Build-Pipeline und Prüfskript
├── README.md             diese Dokumentation
└── README.txt            Kurzhinweis
```

Kein Framework, kein Build-Werkzeug, kein CDN. `index.html` ist direkt lauffähig.

### Korpus neu bauen

```bash
python3 tools/build_corpus.py <referenz.csv> data
node tools/verify_templates.mjs .
```

Der Build ist deterministisch: gleiche CSV, gleiches Ergebnis.

| Datei | Aufgabe |
|---|---|
| `tools/corpus_parse.py` | CSV-Parsing, Sektionserkennung, Schrägstrich-Rückführung |
| `tools/taxonomy_region.py` | Region aus dem RIS-Protokollnamen |
| `tools/taxonomy_text.py` | kontrolliertes Vokabular, ICD-10-Zuordnung |
| `tools/normal_miner.py` | Auswahl der Normalsätze aus Korpusevidenz |
| `tools/build_corpus.py` | Zusammenbau, Bündelung, Ranking, Ausgabe |
| `tools/verify_templates.mjs` | Stilprüfung aller Vorlagen |

### Syntaxprüfung

```bash
node --check core.js && node --check app.js && node --check ai-core.js && node --check ai.js
```

---

## 13. Störungssuche

| Symptom | Ursache und Abhilfe |
|---|---|
| `OpenRouter API-Key fehlt` | Kein Key hinterlegt. **KI & Modelle** öffnen und eintragen. |
| Modell erscheint nicht im Katalog | Katalog ist live. **Verbindung testen** lädt neu; Filter prüfen. |
| `… is only available on agentic harnesses` | Modell ist für registrierte Harness-Apps reserviert. Die Anwendung weicht automatisch aus (Abschnitt 10.4). |
| `Failed to fetch` sofort nach dem Start | Netzwerk oder Firewall blockiert `openrouter.ai`. Die Anwendung sendet nur CORS-zulässige Header. |
| „Modellantwort war nicht sicher strukturierbar" | Das Modell hält das Ausgabeformat nicht ein. Format-Reparaturpass ist gelaufen und ebenfalls gescheitert — anderes Modell wählen (Abschnitt 10.5). |
| Antwort dauert sehr lange | Kostenlose Endpunkte sind lastabhängig. Die Laufzeit läuft sichtbar mit; bei über 60 s ist meist der Endpunkt überlastet. |
| Stilkorrekturpass „verworfen" | Der Korrekturpass hätte den medizinischen Inhalt verändert. Die inhaltlich gesicherte Fassung bleibt bestehen — das ist das gewünschte Verhalten. |
| Auswahl nach Neuladen weg | Nur eine vollständige Auswahl steht im URL-Fragment. Link kopieren, nicht nur die Seite neu laden. |

---

## 14. Versionsverlauf

### 5.0 — Stil-Engine, Live-Status, Aero Glass

- **Stil-Engine** in `ai-core.js`: deterministische Prüfung gegen die quantitativen
  Korpusanker, angewendet auf Standardvorlagen und jede KI-Ausgabe.
- **Stilkorrekturpass** mit Absicherung durch den Consistency Guard: Bewegt er den
  medizinischen Inhalt, wird er verworfen.
- **Beurteilungszeilen der Vorlagen** ebenfalls aus Korpusevidenz, mit Prüfung auf
  fachlichen Bezug zur Fragestellung.
- **Live-Status** beim KI-Auftrag: tatsächlicher Schritt, Modell, Transport, mitlaufende
  Laufzeit, Protokoll mit Einzeldauern, Kennzahlen und Stilbericht.
- **Aero Glass** verfeinert: Glaslagen mit Unschärfe und Kantenlicht, zeigergeführtes
  Spekularlicht, dezente Bewegung; `prefers-reduced-motion` wird respektiert.
- Bedienkomfort: `Strg` + `Enter` startet den Auftrag, zwei zusätzliche Schnellaktionen
  (`Seite spiegeln`, `Verlauf ergänzen`).
- **Modellwechsel nach Formatfehler:** Hält ein Modell das Ausgabeformat auch nach der
  Reparatur nicht ein, wird einmalig das nächste Modell der Ausweichkette versucht,
  statt den Benutzer ohne Ergebnis zu lassen. Der Wechsel wird ausgewiesen.
- `tools/verify_templates.mjs` prüft alle Vorlagen und eignet sich als Build-Gate.
- **Ausweichkette auf Messdaten umgestellt** (Abschnitt 10.5): Das bisherige
  Standardmodell lieferte im Test unparsbare Antworten, die beiden Gemma-4-Ausweichmodelle
  antworten mit HTTP 404. Beide sind ersetzt bzw. entfernt.
- Behoben: drei kuratierte Beurteilungszeilen verletzten die eigene Negationslogik-Regel
  (`Kein Nachweis einer Fernmetastasierung` → `Kein Nachweis von Fernmetastasen`).
- Behoben: Das synthetische Ausweichmodell (genutzt, solange der Katalog nicht geladen
  ist) behauptete `response_format` und `tools`. Unterstützt der reale Endpunkt das nicht,
  antwortet OpenRouter mit HTTP 404 *„No endpoints found that can handle the requested
  parameters"*. Es behauptet jetzt keine Fähigkeiten mehr; zusätzlich lädt die Anwendung
  den Katalog vor dem ersten Lauf nach, statt Fähigkeiten zu raten.

### 4.2.0 — Kategorisierung und Vorlagen

- Region deterministisch aus dem RIS-Protokollnamen; Regionen-Dubletten zusammengeführt.
- Fragestellung von 2.893 Freitexten auf kanonische Kategorien; Sackgassen mit genau
  einem Treffer von 69,2 % auf 3,1 % gesenkt.
- Standard-Befundvorlagen vollständig aus Korpusevidenz statt aus 35 Bausteinen.
- Schrägstrich-Rückführung korrigiert (`1/5 Tesla` → `1,5 Tesla`).
- Trefferleiste, Regionssuche, Tastatursteuerung, verlinkbare Auswahl, `defer`-Laden.
- Behoben: Zähl-Animation konnte negative Werte zeigen.

### 4.1.3 — Harness-Sperre und Umbenennung

- Harness-Sperre modellunabhängig behandelt: Laufzeiterkennung, Merken mit Verfall,
  Ausweichkette, offene Ausweisung des Modellwechsels.
- CORS-Preflight repariert (`X-OpenRouter-Metadata` entfernt), `X-Title` statt
  `X-OpenRouter-Title`.
- Anwendungsname ohne Personennamen; Storage-Keys migrieren automatisch.

### 4.1.2 — Erste Behandlung der Inkling-Sperre

- Ursache erkannt: Zugangsbeschränkung auf registrierte Harness-Apps, kein Formatproblem.
- Automatisches, transparentes Ausweichmodell eingeführt.

---

## 15. Sicherheitshinweis

Diese Anwendung ist ein Arbeits- und Vorlagenwerkzeug. Sie befundet keine Bilder und
stellt keine Diagnose.

- Jeder übernommene Text ist vor klinischer Verwendung ärztlich zu prüfen.
- KI-Entwürfe sind Vorschläge. Der Consistency Guard und die Stilprüfung machen
  Auffälligkeiten sichtbar, sie garantieren keine medizinische Richtigkeit.
- Standard-Normalbefunde sind Vorlagen, keine Aussage über einen konkreten Patienten.
  Ein Normalbefund darf nur übernommen werden, wenn er für den vorliegenden Fall
  tatsächlich zutrifft.
- In kostenlose Endpunkte gehören keine Patientendaten.
