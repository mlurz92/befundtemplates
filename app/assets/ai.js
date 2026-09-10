/* =========================================================================
   Befundatlas - KI-Anpassung über die OpenRouter-API
   Ablauf in Stufen: Referenzen sammeln -> Auftrag bauen -> Generierung ->
   optionaler Stilangleich -> Stilprüfung. Jede Stufe meldet ihren Zustand.
   ========================================================================= */
(function () {
  "use strict";

  var API = "https://openrouter.ai/api/v1";
  var $ = function (id) { return document.getElementById(id); };
  var toast = window.BTtoast;
  var ST = window.BTStyle;

  /* --------------------------------------------------------- Einstellungen */
  var LS = {
    key: "bt.or.key", model: "bt.or.model", remember: "bt.or.remember",
    temp: "bt.or.temp", guard: "bt.or.guard", stream: "bt.or.stream",
    free: "bt.or.freeonly", refine: "bt.or.refine", nref: "bt.or.nref"
  };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var sessionKey = "";
  function apiKey() { return sessionKey || get(LS.key, ""); }

  /* ------------------------------------------------------------ Stilregeln */
  var SYSTEM = [
    "Du bist Redaktionsassistenz für radiologische Befundtexte und schreibst ausschließlich",
    "im Stil des mitgelieferten Referenzkorpus deutschsprachiger CT- und MRT-Befunde.",
    "",
    "TRENNUNG VON STIL UND INHALT - oberste Regel",
    "Die mitgelieferten Referenzbefunde sind Stilvorbild und niemals Inhaltsquelle.",
    "Aus ihnen wird kein Befund, kein Maß, keine Seitenangabe, kein Datum, keine Serien-",
    "oder Bildnummer, kein Stadium und keine Empfehlung übernommen. Übernommen werden",
    "ausschließlich Wortwahl, Satzbau, Satzlänge, Reihenfolge und Verdichtungsgrad.",
    "",
    "AUFGABE",
    "Du erhältst einen bestehenden Befund und eine Änderungsanweisung. Gib den vollständigen,",
    "geänderten Befund zurück - nicht nur den geänderten Teil, keine Erklärung, kein Kommentar.",
    "",
    "AUSGABEFORMAT - exakt diese Feldmarken, jede in einer eigenen Zeile, Reihenfolge fest:",
    "Titel: …",
    "Klin. Angaben: …",
    "Fragestellung: …",
    "Methodik: …",
    "Befund: …",
    "Beurteilung: …",
    "Die Beurteilung entfällt nur, wenn sie in der Vorlage fehlt und die Anweisung sie nicht verlangt.",
    "Die Ausgabe endet unmittelbar nach der Beurteilung. Kein Nachwort, keine Selbstprüfung,",
    "keine Aufzählung geprüfter Regeln, keine englischsprachigen Zwischenschritte.",
    "",
    "SATZBAU UND DICHTE",
    "1. Telegraphischer Nominalstil, kurze Sätze. Median Befundsatz etwa 6 Wörter,",
    "   90. Perzentil 17. Pro Satz genau eine eigenständige diagnostische Aussage.",
    "   Nominalstil vor Verbalstil, Beispiel:",
    "   richtig  „Alters- und volumengerechte Darstellung der Prostata.“",
    "   falsch   „Die Prostata zeigt eine alters- und volumengerechte Darstellung.“",
    "   richtig  „Intakte Kreuzbänder, Kollateralbänder und Retinacula.“",
    "   falsch   „Die Kreuzbänder und Kollateralbänder stellen sich intakt dar.“",
    "   Zerlege einen Nominalsatz nicht in mehrere Kurzsätze, nur um kürzer zu wirken.",
    "2. Verbinde eigenständige Aussagen nicht mechanisch mit „und“. Trenne sie.",
    "   „und“ bleibt, wo Grammatik oder Bedeutung es verlangen, etwa im letzten Glied",
    "   einer Aufzählung.",
    "3. Die diagnostisch entscheidende Aussage steht früh, nicht hinter einem Organinventar.",
    "4. Ein gültiger Vergleich steht früh: „Es liegt die CT/MRT vom … zum Vergleich vor.“",
    "   Verlaufsworte direkt am verfolgten Befund: konstant, unverändert, regredient, progredient.",
    "5. Maße stehen direkt bei dem Befund, den sie quantifizieren, mit Komma: 1,3 cm.",
    "   Niemals 1.3 cm. ADC als „x 10-3 mm²/s“, nicht hochgestellt.",
    "   Bildverweise ausschließlich als „(Serie X, Bild Y)“ und nur, wenn die Zahlen bekannt sind.",
    "6. Negationslogik strikt trennen: „Kein Nachweis …“ bedeutet, dass die genannte Struktur",
    "   oder der genannte Befund nicht direkt darstellbar ist. „Keine Hinweise auf …“ bedeutet,",
    "   dass keine Bildzeichen für den genannten Prozess sprechen. Keine Synonyme.",
    "7. Komposita nutzen: metastasensuspekt, kontrastmittelaffin, diffusionsgestört.",
    "   Im Fließtext „Herd“ statt „Läsion“.",
    "8. Negativaussagen nur, wenn sie die Fragestellung beantworten oder Stadium und",
    "   Komplikation eingrenzen. Kein mechanisches Normalorgan-Inventar.",
    "9. Beurteilung deutlich komprimierter als der Befund. Erster Satz beantwortet die",
    "   Fragestellung. Danach nur entscheidende Ausdehnung, Stadium, Verlauf, Komplikation.",
    "   Stadien direkt notieren: „mrT3a N2a MRF-“, „ypT2“, „PI-RADS 5“. Der kleingeschriebene",
    "   Präfix bleibt auch am Satzanfang erhalten. Keine Wiederholung des Befundes.",
    "10. Methodik: CT „Kontrastmittelgestützte Spiral-CT von …, 2D-Rekonstruktionen, MIP.“",
    "    - MIP nur bei Thorax und Lunge -, nativ „Spiral-CT des …“. MRT beginnt mit „3 Tesla, …“;",
    "    „1,5 Tesla“ nur mit Limitationssatz am Befundanfang. Niemals „3 T Tesla“.",
    "",
    "ABSOLUTE VERBOTE",
    "- „Es zeigt sich“ / „Es zeigen sich“",
    "- „Im Bereich des“ / „Im Bereich der“",
    "- „Kein Anhalt für“ - stattdessen „Keine Hinweise auf“ oder „Kein Nachweis“",
    "- „DD:“ als Abkürzung - ausschreiben: „Differenzialdiagnostisch …“",
    "- „Zusammenfassend“ in der Beurteilung",
    "- Aufzählungszeichen, Nummerierungen, Markdown, Überschriften, Fettung",
    "- Höflichkeitsfloskeln, Meta-Kommentare, Hinweise auf die eigene Rolle",
    "",
    "INHALTLICHE TREUE",
    "- Übernimm alle Angaben der Vorlage unverändert, soweit die Anweisung sie nicht betrifft:",
    "  Seitenangabe, Lokalisation, Segment, Etage, Kompartiment, Zahlen, Maße, Vergleichsdatum,",
    "  Sicherheitsgrad und Differenzialdiagnose-Hierarchie.",
    "- Erfinde keine Messwerte, keine Voruntersuchung, keine Serien- oder Bildnummern",
    "  und keine Empfehlung.",
    "- Platzhalter wie [Datum] bleiben Platzhalter, sofern die Anweisung keinen Wert nennt.",
    "- Ergänzt die Anweisung einen pathologischen Befund, entferne die dadurch falsch",
    "  gewordenen Negativaussagen und passe die Beurteilung an.",
    "- Sprache: Deutsch."
  ].join("\n");

  var PRESETS = [
    ["Pathologisch machen", "typischer pathologischer Befund",
     "Wandle die Vorlage in einen typischen pathologischen Befund für genau diese Fragestellung um. Wähle einen realistischen, zur klinischen Angabe passenden Hauptbefund mit plausibler Lokalisation und Größe, entferne die dadurch falsch gewordenen Negativaussagen und passe die Beurteilung an."],
    ["Verlaufskontrolle", "Vorbefund einarbeiten",
     "Formuliere den Befund als Verlaufskontrolle zu einer Voruntersuchung um: Vergleichssatz an den Anfang, Verlaufsaussagen direkt an die verfolgten Befunde, Beurteilung als Verlaufsaussage. Das Vergleichsdatum bleibt [Datum]."],
    ["Staging vervollständigen", "T, N und M",
     "Ergänze eine vollständige lokale und systemische Ausbreitungsbeurteilung in der für diesen Phänotyp vorgegebenen Reihenfolge und schließe die Beurteilung mit der passenden Stadien-Notation ab."],
    ["Beurteilung schärfen", "nur die Beurteilung",
     "Kürze und schärfe ausschließlich die Beurteilung: erster Satz beantwortet die Fragestellung, danach nur entscheidende Ausdehnung, Verlauf und Komplikation. Der Befund bleibt Wort für Wort unverändert."],
    ["Straffen", "Dichte erhöhen",
     "Straffe den Befund auf die gemessene Zieldichte: unnötige Normalaufzählungen entfernen, lange Sätze in eigenständige Kurzsätze trennen. Der Aussagegehalt bleibt vollständig erhalten."],
    ["Ausführlicher", "Negativbefunde ergänzen",
     "Ergänze die für diese Region und Fragestellung entscheidungsrelevanten Negativbefunde in der korpustypischen Reihenfolge. Kein mechanisches Organinventar."],
    ["Komplikation ergänzen", "Zweitbefund",
     "Ergänze eine für diese Konstellation typische Komplikation oder einen relevanten Nebenbefund und passe die Beurteilung an."],
    ["Nativ statt Kontrastmittel", "Methodik umstellen",
     "Formuliere die Untersuchung als native Untersuchung ohne Kontrastmittel um: Methodikzeile, alle kontrastmittelabhängigen Aussagen und die Beurteilung entsprechend anpassen."],
    ["Postoperativ", "nach Eingriff",
     "Formuliere den Befund als postoperative Kontrolle um: Operationsfolgen, Materiallage und typische Nachbefunde ergänzen, Beurteilung anpassen."],
    ["Voruntersuchung entfernen", "Erstuntersuchung",
     "Formuliere den Befund als Erstuntersuchung ohne Voraufnahmen um: Vergleichssatz und sämtliche Verlaufsaussagen entfernen, Beurteilung als Erstbefund formulieren."]
  ];

  /* -------------------------------------------------------------- Modelle */
  var FALLBACK = [
    { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", context_length: 262144,
      pricing: { prompt: "0", completion: "0" }, architecture: { modality: "text->text" }, supported_parameters: [] },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B A4B (free)", context_length: 262144,
      pricing: { prompt: "0", completion: "0" }, architecture: { modality: "text->text" }, supported_parameters: [] },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA: Nemotron 3 Ultra (free)", context_length: 1000000,
      pricing: { prompt: "0", completion: "0" }, architecture: { modality: "text->text" }, supported_parameters: [] }
  ];
  // Modelle, die ihren Denkschritt in die Antwort schreiben, liefern hier
  // unbrauchbare Feldstrukturen und stehen deshalb hinten.
  var PREFER = [/gemma-4/i, /llama-3\.[3-9]/i, /qwen.*instruct/i, /mistral/i, /gemma/i, /nemotron-3-ultra/i];

  var models = [], modelFilter = "";

  function isFree(m) {
    if (/:free$/.test(m.id)) return true;
    var p = m.pricing || {};
    return parseFloat(p.prompt || "1") === 0 && parseFloat(p.completion || "1") === 0;
  }
  function perM(v) {
    var n = parseFloat(v || "0") * 1e6;
    if (!n) return "0";
    return n < 1 ? n.toFixed(2) : n.toFixed(n < 10 ? 2 : 0);
  }
  function fmtCtx(n) {
    if (!n) return "–";
    return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + " M" : Math.round(n / 1000) + " K";
  }
  function modelById(id) {
    for (var i = 0; i < models.length; i++) if (models[i].id === id) return models[i];
    return null;
  }

  function loadModels() {
    var info = $("set-modelinfo");
    info.textContent = "Modelle werden geladen …";
    var headers = {};
    var k = apiKey();
    if (k) headers.Authorization = "Bearer " + k;
    return fetch(API + "/models", { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        models = (j.data || []).map(function (m) {
          var sp = m.supported_parameters || [];
          return {
            id: m.id, name: m.name || m.id, free: isFree(m),
            ctx: m.context_length || (m.top_provider && m.top_provider.context_length) || 0,
            maxOut: (m.top_provider && m.top_provider.max_completion_tokens) || 0,
            modality: (m.architecture && m.architecture.modality) || "text->text",
            prompt: perM(m.pricing && m.pricing.prompt),
            completion: perM(m.pricing && m.pricing.completion),
            tools: sp.indexOf("tools") >= 0,
            structured: sp.indexOf("structured_outputs") >= 0,
            reasoning: sp.indexOf("reasoning") >= 0,
            forcedReasoning: !!(m.reasoning && m.reasoning.mandatory),
            reasonDefault: (m.reasoning && m.reasoning.default_effort) || null,
            moderated: !!(m.top_provider && m.top_provider.is_moderated),
            desc: (m.description || "").replace(/\s+/g, " ").slice(0, 260)
          };
        });
        var nf = models.filter(function (m) { return m.free; }).length;
        info.textContent = nf + " kostenfreie von " + models.length + " Modellen";
        renderModelList();
        return models;
      })
      .catch(function () {
        models = FALLBACK.map(function (m) {
          return { id: m.id, name: m.name, free: true, ctx: m.context_length, maxOut: 0,
                   modality: "text->text", prompt: "0", completion: "0",
                   tools: false, structured: false, reasoning: false, forcedReasoning: false,
                   moderated: false, desc: "Aus der Standardauswahl - Liste nicht erreichbar." };
        });
        info.textContent = "Modellliste nicht erreichbar - Standardauswahl aktiv";
        renderModelList();
      });
  }

  function currentModel() {
    var id = get(LS.model, "");
    if (id && modelById(id)) return id;
    var list = visibleModels();
    for (var pi = 0; pi < PREFER.length; pi++)
      for (var li = 0; li < list.length; li++)
        if (PREFER[pi].test(list[li].id) && !list[li].forcedReasoning && !list[li].reasonDefault)
          return list[li].id;
    return (list[0] && list[0].id) || (models[0] && models[0].id) || "";
  }

  function visibleModels() {
    var freeOnly = $("set-freeonly").checked;
    var q = modelFilter.toLowerCase();
    var list = models.filter(function (m) {
      if (freeOnly && !m.free) return false;
      if (q && (m.name + " " + m.id).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var chosen = get(LS.model, "");
    list.sort(function (a, b) {
      if (a.id === chosen) return -1;
      if (b.id === chosen) return 1;
      var ra = (a.forcedReasoning || a.reasonDefault) ? 1 : 0;
      var rb = (b.forcedReasoning || b.reasonDefault) ? 1 : 0;
      if (ra !== rb) return ra - rb;
      var pa = PREFER.findIndex(function (r) { return r.test(a.id); });
      var pb = PREFER.findIndex(function (r) { return r.test(b.id); });
      if (pa < 0) pa = 99; if (pb < 0) pb = 99;
      return pa - pb || (b.free - a.free) || a.name.localeCompare(b.name, "de");
    });
    return list;
  }

  function chip(txt, cls) { return '<span class="mchip ' + (cls || "") + '">' + txt + "</span>"; }

  function renderModelList() {
    var host = $("model-list");
    if (!host) return;
    var list = visibleModels();
    var chosen = currentModel();
    set(LS.model, chosen);
    host.innerHTML = "";
    if (!list.length) {
      host.innerHTML = '<div class="empty-hint">Kein Modell passt zum Filter.</div>';
      return;
    }
    list.slice(0, 60).forEach(function (m, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard";
      b.setAttribute("aria-selected", String(m.id === chosen));
      b.style.animationDelay = Math.min(i, 16) * 18 + "ms";
      var badges = [
        chip(m.free ? "kostenfrei" : "$" + m.prompt + " / $" + m.completion + " je 1 M", m.free ? "ok" : "cost"),
        chip(fmtCtx(m.ctx) + " Kontext")
      ];
      if (m.maxOut) badges.push(chip(fmtCtx(m.maxOut) + " Ausgabe"));
      if (/image/.test(m.modality)) badges.push(chip("Bild"));
      if (m.forcedReasoning) badges.push(chip("Reasoning fest", "warn"));
      else if (m.reasonDefault) badges.push(chip("denkt vor (" + m.reasonDefault + ")", "warn"));
      else if (m.reasoning) badges.push(chip("Reasoning zuschaltbar"));
      if (m.structured) badges.push(chip("Structured"));
      var rec = PREFER.slice(0, 2).some(function (r) { return r.test(m.id); });
      b.innerHTML =
        '<span class="mcard-head"><span class="mcard-name"></span>' +
        (rec ? '<span class="mchip rec">empfohlen</span>' : "") + '</span>' +
        '<span class="mcard-id"></span>' +
        '<span class="mcard-chips">' + badges.join("") + "</span>";
      b.querySelector(".mcard-name").textContent = m.name;
      b.querySelector(".mcard-id").textContent = m.id;
      b.title = m.desc;
      b.onclick = function () {
        set(LS.model, m.id);
        renderModelList();
        syncModelLabel();
        toast("Modell: " + m.name);
      };
      host.appendChild(b);
    });
    syncModelLabel();
  }

  function syncModelLabel() {
    var m = modelById(currentModel());
    var lab = $("ai-model-label");
    if (!lab) return;
    if (!m) { lab.textContent = "kein Modell"; return; }
    lab.textContent = m.name;
    var meta = $("ai-model-meta");
    if (meta) meta.textContent = (m.free ? "kostenfrei" : "$" + m.prompt + "/$" + m.completion + " je 1 M") +
      " · " + fmtCtx(m.ctx) + " Kontext";
  }

  /* ------------------------------------------------------- Nachbearbeitung */
  var FIXES = [
    [/(^|[.!?]\s+)Es zeig(?:t|en) sich\s+/gi, "$1"],
    // „Im Bereich des/der“ wird bewusst NICHT automatisch entfernt: die Streichung
    // zerlegt den Satz grammatikalisch („Im Bereich der Leber ein Herd.“ → „Leber ein
    // Herd.“). Der Stilangleich formuliert um, die Stilprüfung meldet den Rest.
    [/\bKein Anhalt f(?:ü|ue|u)r\b/gi, "Keine Hinweise auf"],
    [/\bKeine Anhaltspunkte f(?:ü|ue|u)r\b/gi, "Keine Hinweise auf"],
    [/\bDD:\s*/g, "Differenzialdiagnostisch "],
    [/(^|[.!?]\s+)Zusammenfassend,?\s+/gi, "$1"],
    [/\b3\s*T\s+Tesla\b/g, "3 Tesla"],
    [/(\d)\.(\d)\s*(cm|mm|ml|mm²|Grad)\b/g, "$1,$2 $3"],
    [/x\s*10⁻³/g, "x 10-3"],
    [/^\s*[-*•]\s+/gm, ""],
    [/\*\*(.+?)\*\*/g, "$1"],
    [/^#{1,6}\s*/gm, ""]
  ];
  var WARN = [
    [/\bes zeigt(en)? sich\b/i, "„Es zeigt sich“"],
    [/\bim bereich (des|der)\b/i, "„Im Bereich des/der“"],
    [/\bkein anhalt f(ü|u)r\b/i, "„Kein Anhalt für“"],
    [/\bDD:/, "„DD:“"],
    [/\bzusammenfassend\b/i, "„Zusammenfassend“"],
    [/\bL(ä|a)sion(en)?\b/, "„Läsion“ statt „Herd“"],
    [/\d\.\d\s*(cm|mm)/, "Dezimalpunkt statt Komma"],
    [/\b3\s*T\s+Tesla\b/, "„3 T Tesla“"]
  ];

  function styleGuard(rep) {
    var found = [];
    ["befund", "beurteilung", "methodik"].forEach(function (f) {
      if (!rep[f]) return;
      FIXES.forEach(function (p) { rep[f] = rep[f].replace(p[0], p[1]); });
      rep[f] = rep[f].replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
      // Satzanfang großschreiben - außer bei Stadien-Notationen wie mrT3a, ypT2, pT1b,
      // die ihren Kleinbuchstaben-Präfix behalten müssen.
      rep[f] = rep[f].replace(/(^|[.!?]\s+)([a-zäöü]\S*)/g, function (_, a, w) {
        if (/[A-ZÄÖÜ]/.test(w)) return a + w;
        return a + w.charAt(0).toUpperCase() + w.slice(1);
      });
      WARN.forEach(function (w) { if (w[0].test(rep[f])) found.push(w[1]); });
    });
    return found.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  /** Abweichung von der gemessenen Zieldichte - rein informativ. */
  function densityReport(rep, prof) {
    if (!prof || prof.n < 3 || !rep.befund) return null;
    var sb = ST.sentences(rep.befund);
    var w = ST.words(rep.befund);
    var sl = ST.median(sb.map(ST.words));
    var uw = rep.beurteilung ? ST.words(rep.beurteilung) : 0;
    var lang = sb.filter(function (s) { return ST.words(s) > 17; }).length;
    return {
      woerter: w, ziel: prof.befundWoerter,
      satzLaenge: sl, zielSatz: prof.satzLaenge,
      beurteilung: uw, zielBeurteilung: prof.beurteilungWoerter,
      ueberlang: lang
    };
  }

  /* ----------------------------------------------------------- Parser */
  var META = /(<\/?think>|<\/?reasoning>|\bLet me\b|\bLet's\b|\bI should\b|\bI need to\b|\bWe (?:should|need|are|can|used|changed|kept|removed)\b|\bThe (?:instruction|user|original|answer)\b|\bCheck (?:for|that|measurement)\b|\bNow (?:ensure|check|final)\b|\bEnsure\b|\bNote:|\bOkay,|\bWait,|\bFinal answer\b|\bGood\.\s|\bThat's (?:allowed|fine|ok)\b|\bprohibited phrases\b|\bSelbstprüfung\b|\bPrüfschritt\b)/i;
  var EN = /\b(the|this|that|these|those|we|they|you|user|wants?|needs?|should|could|would|maybe|must|answer|question|sentence|words|unchanged|adjust|compressed|instruction|allowed|correct|removed?|keep|kept|check|rewrite|report|style|based|reference|examples?|specific|match|make|write|following|about|which|there|because)\b/gi;
  // Ein deutscher Befundsatz traegt fast immer eines dieser Merkmale.
  var DE = /\b(der|die|das|den|dem|des|ein|eine|einer|eines|kein|keine|keinen|nicht|und|mit|im|in|ist|sind|von|zur|zum|bei|auf|ohne|nach)\b|[äöüßÄÖÜ]/;

  function cutEnglish(text) {
    var parts = text.split(/(?<=[.!?])\s+/);
    var acc = 0;
    for (var i = 0; i < parts.length; i++) {
      var hits = parts[i].match(EN);
      var n = hits ? hits.length : 0;
      // zwei englische Funktionswoerter, oder eines ohne jedes deutsche Merkmal
      if (n >= 2 || (n >= 1 && !DE.test(parts[i]) && parts[i].split(/\s+/).length > 4))
        return text.slice(0, acc).trim();
      acc += parts[i].length + 1;
    }
    return text;
  }
  function istDeutsch(t) {
    t = String(t || "");
    if (!t) return false;
    var de = (t.match(new RegExp(DE.source, "gi")) || []).length;
    var en = (t.match(EN) || []).length;
    return de >= 2 && de > en;
  }
  function stripMeta(text) {
    text = String(text || "");
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, " ")
               .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, " ");
    var m = META.exec(text);
    if (m && m.index > 40) text = text.slice(0, m.index);
    return cutEnglish(text).trim();
  }

  function parseReport(text, fallback) {
    text = stripMeta(text);
    var rx = /(Titel|Klin\.?\s*Angaben|Fragestellung|Methodik|Befund|Beurteilung)\s*:/gi;
    var map = { titel: "titel", klinangaben: "klinik", fragestellung: "frage",
                methodik: "methodik", befund: "befund", beurteilung: "beurteilung" };
    var out = {}, m, hits = [];
    while ((m = rx.exec(text)) !== null) hits.push({ k: m[1], s: m.index, e: rx.lastIndex });
    if (!hits.length) {
      out = Object.assign({}, fallback);
      out.befund = text.trim();
      return out;
    }
    hits.forEach(function (h, i) {
      var key = map[h.k.toLowerCase().replace(/[\s.]/g, "")] || null;
      if (!key || out[key]) return;
      var end = i + 1 < hits.length ? hits[i + 1].s : text.length;
      out[key] = stripMeta(text.slice(h.e, end)).replace(/\s+/g, " ").trim();
    });
    ["titel", "klinik", "frage", "methodik", "befund", "beurteilung"].forEach(function (k) {
      if (out[k] == null) out[k] = fallback[k] || "";
    });
    return out;
  }

  /**
   * Manche Modelle stellen ihrem Ergebnis einen Denkschritt voran, in dem die
   * Feldmarken bereits vorkommen. Deshalb wird zusätzlich ab der letzten
   * „Titel:“-Marke geparst und die brauchbarere der beiden Fassungen genommen.
   */
  function parseBest(text, fallback) {
    var a = parseReport(text, fallback);
    var last = text.lastIndexOf("Titel:");
    if (last > 40) {
      var b = parseReport(text.slice(last), fallback);
      if (score(b) > score(a)) return b;
    }
    return a;
  }
  function score(rep) {
    var b = rep.befund || "";
    return (istDeutsch(b) ? 100 : 0) + Math.min(b.length, 900) / 10 +
           (rep.beurteilung ? 20 : 0) + (ST.sentences(b).length >= 3 ? 30 : 0);
  }

  /* ==================================================== Stufenanzeige */
  var STAGES = [
    ["ref", "Referenzbefunde sammeln"],
    ["prompt", "Auftrag zusammenstellen"],
    ["gen", "Befund wird geschrieben"],
    ["refine", "Stilangleich"],
    ["guard", "Stilprüfung"]
  ];
  var t0 = 0, tick = null, charCount = 0, usageInfo = null;

  function renderStages(active) {
    var host = $("ai-stages");
    host.innerHTML = "";
    STAGES.forEach(function (s) {
      if (s[0] === "refine" && !$("set-refine").checked) return;
      var d = document.createElement("div");
      d.className = "stage";
      d.id = "stage-" + s[0];
      d.innerHTML = '<span class="stage-dot"></span><span class="stage-t"></span><span class="stage-n"></span>';
      d.querySelector(".stage-t").textContent = s[1];
      host.appendChild(d);
    });
    if (active) stage(active, "run");
  }
  function stage(id, state, note) {
    var d = $("stage-" + id);
    if (!d) return;
    d.dataset.state = state;
    if (note != null) d.querySelector(".stage-n").textContent = note;
    if (state === "run") {
      var all = $("ai-stages").children;
      for (var i = 0; i < all.length; i++) {
        if (all[i] === d) break;
        if (all[i].dataset.state !== "fail") all[i].dataset.state = "done";
      }
    }
  }
  function progress(pct, label) {
    var r = $("ai-ring-fill");
    var c = 2 * Math.PI * 26;
    r.style.strokeDasharray = c;
    r.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, pct)));
    $("ai-ring-pct").textContent = Math.round(pct * 100) + "%";
    if (label != null) $("ai-ring-label").textContent = label;
  }
  function startClock() {
    t0 = performance.now(); charCount = 0; usageInfo = null;
    clearInterval(tick);
    tick = setInterval(function () {
      var s = (performance.now() - t0) / 1000;
      $("ai-elapsed").textContent = s.toFixed(1) + " s";
      if (charCount) $("ai-rate").textContent = Math.round(charCount / Math.max(s, .3)) + " Z/s";
    }, 100);
  }
  function stopClock() { clearInterval(tick); tick = null; }

  function busy(on) {
    $("ai-monitor").hidden = !on && !$("ai-monitor").dataset.keep;
    $("ai-run").disabled = on;
    $("ai-stop").hidden = !on;
    $("sheet-ai").classList.toggle("is-busy", on);
  }

  /* --------------------------------------------------------- Generierung */
  var controller = null, lastResult = null, lastContext = null;

  function callModel(messages, model, temp, stream, onDelta) {
    var key = apiKey();
    return fetch(API + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin && location.origin !== "null" ? location.origin : "https://befundatlas.local",
        "X-Title": "Befundatlas"
      },
      body: JSON.stringify({
        model: model, messages: messages, temperature: temp,
        max_tokens: 2400, stream: !!stream,
        reasoning: { exclude: true },
        usage: { include: true }
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try { msg = JSON.parse(t).error.message; } catch (e) {}
          throw new Error("OpenRouter " + res.status + ": " + msg);
        });
      }
      if (!stream) {
        return res.json().then(function (j) {
          if (j.usage) usageInfo = j.usage;
          var c = j.choices && j.choices[0] && j.choices[0].message;
          var txt = (c && (c.content || c.reasoning)) || "";
          if (onDelta) onDelta(txt, txt);
          return txt;
        });
      }
      return readStream(res, onDelta);
    });
  }

  function readStream(res, onDelta) {
    var reader = res.body.getReader(), dec = new TextDecoder();
    var buf = "", full = "";
    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) return full;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(function (line) {
          line = line.trim();
          if (!line || line.charAt(0) === ":") return;   // SSE-Keep-Alive
          if (line.indexOf("data:") !== 0) return;
          var payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            var j = JSON.parse(payload);
            if (j.usage) usageInfo = j.usage;
            var d = j.choices && j.choices[0] && j.choices[0].delta;
            if (d && d.content) { full += d.content; if (onDelta) onDelta(d.content, full); }
          } catch (e) { /* unvollstaendiges Fragment */ }
        });
        return pump();
      });
    })();
  }

  function run() {
    var ctx = window.BTcurrent();
    if (!ctx.report) return toast("Kein Befund ausgewählt.", true);
    if (!apiKey()) {
      toast("Zuerst einen API-Key hinterlegen.", true);
      window.BTopenSheet("sheet-set");
      return;
    }
    var instruction = $("ai-instruction").value.trim();
    if (!instruction) { $("ai-instruction").focus(); return toast("Bitte eine Anweisung angeben.", true); }

    var model = currentModel();
    var stream = $("set-stream").checked;
    var refine = $("set-refine").checked;
    var temp = parseFloat($("set-temp").value);
    if (isNaN(temp)) temp = 0.25;
    var nref = parseInt($("set-nref").value, 10) || 5;

    lastResult = null; lastContext = ctx;
    $("ai-apply").disabled = true;
    var out = $("ai-out");
    out.textContent = "";
    out.classList.add("live");
    var guardBox = $("ai-guard"); if (guardBox) guardBox.remove();
    $("ai-monitor").dataset.keep = "";
    renderStages("ref");
    progress(0.02, "Referenzen");
    startClock();
    busy(true);
    $("ai-monitor").scrollIntoView({ behavior: "smooth", block: "center" });
    controller = new AbortController();

    // -------- Stufe 1: Referenzen und Stilprofil
    var ex = ST.pick(ctx.path, nref);
    var prof = ST.profile(ctx.path);
    stage("ref", "done", ex.list.length + " Referenzen · Stufe " + ex.tier);
    $("ai-refinfo").textContent = ex.list.length
      ? ex.list.length + " Stilvorbilder aus " + (ex.n || 0) + " Befunden derselben Auswahl"
      : "keine Referenzen verfügbar - globaler Stil";

    // -------- Stufe 2: Auftrag
    stage("prompt", "run");
    var userMsg = ST.buildUser(
      { mod: ctx.path.mod, region: ctx.path.region, thema: ctx.path.thema, frage: ctx.path.frage,
        report: ctx.report, isNormal: ctx.isNormal },
      instruction, ex.list, prof);
    stage("prompt", "done", Math.round((SYSTEM.length + userMsg.length) / 4) + " Token ≈");
    progress(0.10, "Anfrage");

    // -------- Stufe 3: Generierung
    stage("gen", "run", "verbunden …");
    var msgs = [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }];
    var expect = Math.max(600, (prof && prof.befundWoerter ? prof.befundWoerter * 9 : 900));

    callModel(msgs, model, temp, stream, function (delta, full) {
      charCount = full.length;
      out.textContent = full;
      out.scrollTop = out.scrollHeight;
      progress(0.10 + 0.55 * Math.min(1, full.length / expect), "Generierung");
      stage("gen", "run", full.length + " Zeichen");
    }).then(function (txt) {
      if (!txt || !txt.trim()) throw new Error("Das Modell hat eine leere Antwort geliefert.");
      stage("gen", "done", txt.length + " Zeichen");
      var draft = parseBest(txt, ctx.report);

      if (!refine) return draft;

      // -------- Stufe 4: Stilangleich
      stage("refine", "run", "zweiter Durchgang");
      progress(0.70, "Stilangleich");
      out.textContent = "";
      var rmsg = [{ role: "system", content: SYSTEM },
                  { role: "user", content: ST.buildRepair(ctx.path, draft, ex.list, prof) }];
      return callModel(rmsg, model, Math.min(temp, 0.15), stream, function (delta, full) {
        charCount += delta.length;
        out.textContent = full;
        out.scrollTop = out.scrollHeight;
        progress(0.70 + 0.22 * Math.min(1, full.length / expect), "Stilangleich");
      }).then(function (t2) {
        var fixed = parseBest(t2, draft);
        if (!fixed.befund || fixed.befund.length < 40) {
          stage("refine", "warn", "verworfen - erster Durchgang übernommen");
          return draft;
        }
        stage("refine", "done", "übernommen");
        return fixed;
      }).catch(function (e) {
        if (e.name === "AbortError") throw e;
        var msg = String(e.message || e);
        stage("refine", "warn", /429|rate/i.test(msg) ? "Ratenlimit - übersprungen"
                                : msg.slice(0, 44));
        out.textContent = window.BTreportToText(draft);
        return draft;
      });
    }).then(function (rep) {
      // -------- Stufe 5: Stilprüfung
      stage("guard", "run");
      progress(0.94, "Stilprüfung");
      finish(rep, prof, ex);
    }).catch(function (e) {
      stopClock(); busy(false);
      out.classList.remove("live");
      if (e.name === "AbortError") {
        stage("gen", "fail", "abgebrochen");
        progress(0, "abgebrochen");
        toast("Abgebrochen.");
      } else {
        var cur = document.querySelector('.stage[data-state="run"]');
        if (cur) { cur.dataset.state = "fail"; cur.querySelector(".stage-n").textContent = "fehlgeschlagen"; }
        progress(0, "Fehler");
        showNotice("crit", String(e.message || e));
        toast("Fehler bei der Anfrage.", true);
      }
    });
  }

  function showNotice(kind, text, html) {
    var old = $("ai-guard"); if (old) old.remove();
    var n = document.createElement("div");
    n.id = "ai-guard";
    n.className = "notice " + kind;
    if (html) n.innerHTML = html; else n.textContent = text;
    $("ai-out").parentNode.appendChild(n);
    return n;
  }

  function finish(rep, prof, ex) {
    stopClock();
    var warn = $("set-guard").checked ? styleGuard(rep) : [];
    var dens = densityReport(rep, prof);
    var broken = !rep.befund || rep.befund.length < 40 ||
                 !istDeutsch(rep.befund) ||
                 ST.sentences(rep.befund).length < 2 ||
                 (rep.beurteilung || "").length > 600 ||
                 (rep.beurteilung && !istDeutsch(rep.beurteilung)) ||
                 /["„][^"“]{0,80}["“]\s*(none|correct|good)/i.test(rep.beurteilung || "");

    lastResult = rep;
    $("ai-out").textContent = window.BTreportToText(rep);
    $("ai-out").classList.remove("live");
    $("ai-apply").disabled = broken;
    $("ai-monitor").dataset.keep = "1";
    busy(false);
    progress(1, "fertig");

    if (usageInfo) {
      var u = usageInfo;
      $("ai-tokens").textContent = (u.prompt_tokens || 0) + " → " + (u.completion_tokens || 0) + " Token" +
        (u.cost ? " · $" + Number(u.cost).toFixed(5) : " · kostenfrei");
    }

    var rows = [];
    if (dens) {
      rows.push(row("Befundlänge", dens.woerter + " Wörter", "Ziel " + dens.ziel,
                    Math.abs(dens.woerter - dens.ziel) <= Math.max(25, dens.ziel * 0.45)));
      rows.push(row("Satzlänge", dens.satzLaenge + " Wörter", "Ziel " + dens.zielSatz,
                    Math.abs(dens.satzLaenge - dens.zielSatz) <= 4));
      if (dens.zielBeurteilung)
        rows.push(row("Beurteilung", dens.beurteilung + " Wörter", "Ziel " + dens.zielBeurteilung,
                      dens.beurteilung <= Math.max(28, dens.zielBeurteilung * 2.4)));
      rows.push(row("Sätze über 17 Wörtern", String(dens.ueberlang), "Ziel 0", dens.ueberlang === 0));
    }
    var html = "";
    if (rows.length) html += '<div class="qa">' + rows.join("") + "</div>";

    if (broken) {
      stage("guard", "fail", "Feldformat unbrauchbar");
      showNotice("crit",
        null,
        "<b>Das Modell hält das Feldformat nicht ein</b> und schreibt vermutlich seinen Denkschritt " +
        "in die Antwort. Bitte ein Modell ohne die Kennzeichnung „denkt vor“ wählen. " +
        '<button type="button" class="linkbtn" id="ai-switch">Modell wechseln</button>' + html);
      var sw = $("ai-switch");
      if (sw) sw.onclick = function () { window.BTopenSheet("sheet-set"); };
    } else if (warn.length) {
      stage("guard", "warn", warn.length + " Hinweis" + (warn.length > 1 ? "e" : ""));
      showNotice("warn", null, "<b>Stilprüfung:</b> " + warn.join(", ") +
        " - bitte vor der Übernahme prüfen." + html);
      toast("Befund erzeugt · " + warn.length + " Stilhinweis" + (warn.length > 1 ? "e" : ""));
    } else {
      stage("guard", "done", "ohne Beanstandung");
      showNotice("ok", null, "<b>Stilprüfung ohne Beanstandung.</b>" + html);
      toast("Befund erzeugt.");
    }
  }
  function row(label, val, ziel, ok) {
    return '<div class="qa-row' + (ok ? "" : " off") + '"><span>' + label +
      '</span><b>' + val + '</b><i>' + ziel + "</i></div>";
  }

  /* ------------------------------------------------------------- Bindung */
  function init() {
    // Voreinstellungen
    $("set-remember").checked = get(LS.remember, "0") === "1";
    if ($("set-remember").checked) $("set-key").value = get(LS.key, "");
    $("set-temp").value = get(LS.temp, "0.25");
    $("set-guard").checked = get(LS.guard, "1") === "1";
    $("set-stream").checked = get(LS.stream, "1") === "1";
    $("set-freeonly").checked = get(LS.free, "1") === "1";
    $("set-refine").checked = get(LS.refine, "1") === "1";
    $("set-nref").value = get(LS.nref, "5");
    syncTemp(); syncNref();

    // Voreingestellte Anweisungen
    var host = $("ai-presets");
    PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.innerHTML = '<b></b><i></i>';
      b.querySelector("b").textContent = p[0];
      b.querySelector("i").textContent = p[1];
      b.onclick = function () {
        var t = $("ai-instruction");
        t.value = p[2];
        t.focus();
        t.dispatchEvent(new Event("input"));
        document.querySelectorAll("#ai-presets .chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      };
      host.appendChild(b);
    });

    $("set-key").oninput = function () {
      sessionKey = this.value.trim();
      if ($("set-remember").checked) set(LS.key, sessionKey);
    };
    $("set-remember").onchange = function () {
      set(LS.remember, this.checked ? "1" : "0");
      if (this.checked) set(LS.key, apiKey()); else del(LS.key);
    };
    $("set-clear").onclick = function () {
      sessionKey = ""; del(LS.key); $("set-key").value = "";
      $("set-keystatus").innerHTML = '<div class="notice info">Key entfernt.</div>';
    };
    $("set-test").onclick = function () {
      var k = apiKey(), box = $("set-keystatus");
      if (!k) { box.innerHTML = '<div class="notice crit">Kein Key eingetragen.</div>'; return; }
      box.innerHTML = '<div class="bar"><i></i></div>';
      fetch(API + "/key", { headers: { Authorization: "Bearer " + k } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) {
          var d = j.data || {};
          box.innerHTML = '<div class="notice ok">Key gültig · ' +
            (d.limit == null ? "ohne Limit" : "Limit " + d.limit + " USD") +
            ' · Verbrauch ' + Number(d.usage || 0).toFixed(4) + ' USD</div>';
          loadModels();
        })
        .catch(function () { box.innerHTML = '<div class="notice crit">Key ungültig oder nicht erreichbar.</div>'; });
    };
    $("set-freeonly").onchange = function () { set(LS.free, this.checked ? "1" : "0"); renderModelList(); };
    $("set-reload").onclick = function () { loadModels(); };
    $("model-search").oninput = function () { modelFilter = this.value; renderModelList(); };
    $("set-temp").oninput = syncTemp;
    $("set-temp").onchange = function () { set(LS.temp, this.value); };
    $("set-nref").oninput = syncNref;
    $("set-nref").onchange = function () { set(LS.nref, this.value); };
    $("set-guard").onchange = function () { set(LS.guard, this.checked ? "1" : "0"); };
    $("set-stream").onchange = function () { set(LS.stream, this.checked ? "1" : "0"); };
    $("set-refine").onchange = function () {
      set(LS.refine, this.checked ? "1" : "0");
      renderStages();
    };

    $("ai-run").onclick = run;
    $("ai-stop").onclick = function () { if (controller) controller.abort(); };
    $("ai-apply").onclick = function () {
      if (!lastResult) return;
      window.BTapplyAI(lastResult);
      window.BTcloseSheets();
    };
    $("ai-copy").onclick = function () {
      if (!lastResult) return toast("Noch kein Ergebnis.", true);
      window.BTcopy(window.BTreportToText(lastResult), "KI-Fassung");
    };
    $("ai-settings-link").onclick = function () { window.BTopenSheet("sheet-set"); };
    $("ai-instruction").addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    });
    $("ai-instruction").addEventListener("input", function () {
      $("ai-run").disabled = !this.value.trim();
    });

    window.BTaiOpened = function () {
      var ctx = window.BTcurrent();
      var box = $("ai-context");
      if (!ctx.report) { box.className = "notice crit"; box.textContent = "Kein Befund ausgewählt."; return; }
      box.className = "ai-ctx";
      box.innerHTML = '<span class="tag ' + (ctx.isNormal ? "ok" : "info") + '">' +
        (ctx.isNormal ? "Normalbefund" : "Referenzbefund") + '</span>' +
        '<span class="ai-ctx-path"></span>';
      box.querySelector(".ai-ctx-path").textContent =
        ctx.path.mod + " · " + ctx.path.region + " · " + ctx.path.thema + " · " + ctx.path.frage;
      $("ai-run").disabled = !$("ai-instruction").value.trim();

      // Referenzlage vorab anzeigen
      var slug = window.BTdata.slugOf(ctx.path.mod, ctx.path.region);
      var show = function () {
        var ex = ST.pick(ctx.path, parseInt($("set-nref").value, 10) || 5);
        $("ai-refinfo").textContent = ex.list.length
          ? ex.list.length + " Stilvorbilder verfügbar · " + (ex.n || 0) + " Befunde in dieser Auswahl"
          : "keine Referenzen in dieser Auswahl";
      };
      if (slug && !window.BTdata.shard(slug)) window.BTdata.load(slug, show); else show();
      renderStages();
      progress(0, "bereit");
    };

    loadModels();
  }
  function syncTemp() { $("temp-val").textContent = Number($("set-temp").value).toFixed(2).replace(".", ","); }
  function syncNref() { $("nref-val").textContent = $("set-nref").value; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
