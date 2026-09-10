/* =========================================================================
   Befundatlas - KI-Anpassung über die OpenRouter-API
   - Modelle werden live geladen (GET /api/v1/models), :free wird bevorzugt
   - Chat Completions mit SSE-Streaming, Reasoning-Ausgabe wird unterdrückt
   - Der Systemprompt bindet den Referenzstil; die Stilprüfung korrigiert
     die im Korpus verbotenen Wendungen nach der Generierung
   ========================================================================= */
(function () {
  "use strict";

  var API = "https://openrouter.ai/api/v1";
  var $ = function (id) { return document.getElementById(id); };
  var toast = window.BTtoast;

  /* --------------------------------------------------------- Einstellungen */
  var LS = {
    key: "bt.or.key", model: "bt.or.model", remember: "bt.or.remember",
    temp: "bt.or.temp", guard: "bt.or.guard", stream: "bt.or.stream", free: "bt.or.freeonly"
  };
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var sessionKey = "";
  function apiKey() { return sessionKey || get(LS.key, ""); }

  /* ------------------------------------------------------------ Stilregeln */
  var SYSTEM = [
    "Du bist Redaktionsassistenz für radiologische Befundtexte und arbeitest ausschließlich",
    "im Stil des vorgegebenen Referenzkorpus (deutschsprachige CT- und MRT-Befunde).",
    "",
    "AUFGABE",
    "Du erhältst einen bestehenden Befund und eine Änderungsanweisung. Gib den vollständigen,",
    "geänderten Befund zurück - nicht nur den geänderten Teil, keine Erklärung, kein Kommentar.",
    "",
    "AUSGABEFORMAT (exakt diese Feldmarken, jedes Feld in einer eigenen Zeile, Reihenfolge fest):",
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
    "STIL - verbindlich",
    "1. Telegraphischer Nominalstil, kurze Sätze. Median Befundsatz etwa 6 Wörter, 90. Perzentil 17.",
    "   Pro Satz genau eine eigenständige diagnostische Aussage.",
    "2. Die diagnostisch entscheidende Aussage steht früh, nicht hinter einem Organinventar.",
    "3. Ein gültiger Vergleich steht früh: 'Es liegt die CT/MRT vom … zum Vergleich vor.'",
    "   Verlaufsworte: konstant, unverändert, regredient, progredient.",
    "4. Maße direkt beim Befund, mit Komma: 1,3 cm - niemals 1.3 cm. ADC als 'x 10-3 mm²/s',",
    "   nicht hochgestellt. Bildverweise nur als '(Serie X, Bild Y)'.",
    "5. Negationslogik strikt trennen: 'Kein Nachweis …' = die Struktur/der Befund ist nicht",
    "   direkt darstellbar; 'Keine Hinweise auf …' = keine Zeichen für den genannten Prozess.",
    "6. Komposita nutzen: metastasensuspekt, kontrastmittelaffin, diffusionsgestört.",
    "   Im Fließtext 'Herd' statt 'Läsion'.",
    "7. Beurteilung ist deutlich komprimierter als der Befund (Median 6-8 Wörter je Satz).",
    "   Erster Satz beantwortet die Fragestellung. Staging-Notation direkt: 'mrT3a N2a MRF-', 'PI-RADS 5'.",
    "8. Methodik: CT 'Kontrastmittelgestützte Spiral-CT von …, 2D-Rekonstruktionen, MIP.'",
    "   (MIP nur Thorax/Lunge), nativ 'Spiral-CT des …'. MRT beginnt mit '3 Tesla, …';",
    "   '1,5 Tesla' nur mit Limitationssatz. Niemals '3 T Tesla'.",
    "",
    "ABSOLUTE VERBOTE",
    "- 'Es zeigt sich' / 'Es zeigen sich'",
    "- 'Im Bereich des' / 'Im Bereich der'",
    "- 'Kein Anhalt für' (stattdessen 'Keine Hinweise auf' oder 'Kein Nachweis')",
    "- 'DD:' als Abkürzung (ausschreiben: 'Differenzialdiagnostisch …')",
    "- 'Zusammenfassend' in der Beurteilung",
    "- Aufzählungszeichen, Nummerierungen, Markdown, Überschriften, Fettung",
    "- Höflichkeitsfloskeln, Meta-Kommentare, Hinweise auf die eigene Rolle",
    "",
    "INHALTLICHE TREUE",
    "- Übernimm alle Angaben der Vorlage unverändert, soweit die Anweisung sie nicht betrifft:",
    "  Seitenangabe, Lokalisation, Segment/Etage, Zahlen, Maße, Vergleichsdatum, Sicherheitsgrad.",
    "- Erfinde keine Messwerte, keine Voruntersuchung, keine Serien-/Bildnummern, keine Empfehlung.",
    "- Platzhalter wie [Datum] bleiben Platzhalter, sofern die Anweisung keinen Wert nennt.",
    "- Ergänzt die Anweisung einen pathologischen Befund, entferne die dadurch falsch gewordenen",
    "  Negativaussagen und passe die Beurteilung an.",
    "- Sprache: Deutsch."
  ].join("\n");

  var PRESETS = [
    ["Pathologisch machen", "Wandle den Normalbefund in einen typischen pathologischen Befund für diese Fragestellung um. Wähle einen realistischen, für die klinische Angabe passenden Hauptbefund und passe die Beurteilung an."],
    ["Verlaufskontrolle", "Formuliere den Befund als Verlaufskontrolle zu einer Voruntersuchung um: Vergleichssatz an den Anfang, Verlaufsaussagen an die verfolgten Befunde, Beurteilung als Verlaufsaussage. Vergleichsdatum als [Datum] belassen."],
    ["Staging ergänzen", "Ergänze eine vollständige lokale und systemische Ausbreitungsbeurteilung und schließe die Beurteilung mit der passenden Stadien-Notation ab."],
    ["Beurteilung schärfen", "Kürze und schärfe ausschließlich die Beurteilung: erster Satz beantwortet die Fragestellung, danach nur entscheidende Ausdehnung, Verlauf und Komplikation. Der Befund bleibt unverändert."],
    ["Straffen", "Straffe den Befund: unnötige Normalaufzählungen entfernen, lange Sätze in eigenständige Kurzsätze trennen, Aussagegehalt vollständig erhalten."],
    ["Ausführlicher", "Ergänze die für diese Region und Fragestellung fachlich üblichen, entscheidungsrelevanten Negativbefunde in korpustypischer Reihenfolge."],
    ["Nativ statt KM", "Formuliere die Untersuchung als native Untersuchung ohne Kontrastmittel um: Methodik, kontrastmittelabhängige Aussagen und Beurteilung entsprechend anpassen."],
    ["Postoperativ", "Formuliere den Befund als postoperative Kontrolle um: Operationsfolgen, Materiallage und typische Nachbefunde ergänzen, Beurteilung anpassen."]
  ];

  /* -------------------------------------------------------------- Modelle */
  var FALLBACK = [
    { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)" },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B A4B (free)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA: Nemotron 3 Ultra (free)" }
  ];
  // Vorzugsreihenfolge fuer die Erstauswahl. Modelle, die ihren Denkschritt in die
  // Antwort schreiben, liefern hier unbrauchbare Feldstrukturen und stehen hinten.
  var PREFER = [/gemma-4/i, /nemotron-3-ultra/i, /llama-3\.[3-9]/i, /qwen.*instruct/i, /mistral/i, /gemma/i];
  var models = [];

  function isFree(m) {
    if (/:free$/.test(m.id)) return true;
    var p = m.pricing || {};
    return parseFloat(p.prompt || "1") === 0 && parseFloat(p.completion || "1") === 0;
  }

  function loadModels(force) {
    var info = $("set-modelinfo");
    info.textContent = "lade …";
    var headers = {};
    var k = apiKey();
    if (k) headers.Authorization = "Bearer " + k;
    fetch(API + "/models", { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        models = (j.data || []).map(function (m) {
          return { id: m.id, name: m.name || m.id, free: isFree(m), ctx: m.context_length || 0 };
        });
        info.textContent = models.filter(function (m) { return m.free; }).length +
          " kostenfreie von " + models.length + " Modellen";
        fillModelSelects();
      })
      .catch(function (e) {
        models = FALLBACK.map(function (m) { return { id: m.id, name: m.name, free: true, ctx: 0 }; });
        info.textContent = "Liste nicht erreichbar - Standardauswahl aktiv";
        fillModelSelects();
      });
  }

  function fillModelSelects() {
    var freeOnly = $("set-freeonly").checked;
    var chosen = get(LS.model, "");
    var list = models.filter(function (m) { return !freeOnly || m.free; });
    list.sort(function (a, b) { return (b.free - a.free) || a.name.localeCompare(b.name, "de"); });
    if (!list.length) list = models.slice(0, 40);
    if (chosen && !list.some(function (m) { return m.id === chosen; })) {
      var hit = models.filter(function (m) { return m.id === chosen; })[0];
      if (hit) list.unshift(hit);
    }
    if (!chosen) {
      for (var pi = 0; pi < PREFER.length && !chosen; pi++) {
        for (var li = 0; li < list.length; li++) {
          if (PREFER[pi].test(list[li].id)) { chosen = list[li].id; break; }
        }
      }
    }
    [$("set-model"), $("ai-model-quick")].forEach(function (sel) {
      sel.innerHTML = "";
      list.forEach(function (m) {
        var o = document.createElement("option");
        o.value = m.id;
        o.textContent = m.name + (m.free ? "" : "  ·  kostenpflichtig");
        sel.appendChild(o);
      });
      if (chosen) sel.value = chosen;
      if (!sel.value && list[0]) sel.value = list[0].id;
    });
    set(LS.model, $("set-model").value || "");
  }

  /* ------------------------------------------------------- Nachbearbeitung */
  var FIXES = [
    [/(^|[.!?]\s+)Es zeigen sich\s+/g, "$1"],
    [/(^|[.!?]\s+)Es zeigt sich\s+/g, "$1"],
    [/(^|[.!?]\s+)Im Bereich (?:des|der|von)\s+/g, "$1"],
    [/\bKein Anhalt f(ü|u)r\b/g, "Keine Hinweise auf"],
    [/\bKeine Anhaltspunkte f(ü|u)r\b/g, "Keine Hinweise auf"],
    [/\bDD:\s*/g, "Differenzialdiagnostisch "],
    [/\bZusammenfassend\b\s*/g, ""],
    [/\b3\s*T\s+Tesla\b/g, "3 Tesla"],
    [/(\d)\.(\d)\s*(cm|mm|ml|l\b)/g, "$1,$2 $3"],
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
    [/\bL(ä|a)sion\b/, "„Läsion“ (Korpus bevorzugt „Herd“)"],
    [/\d\.\d\s*(cm|mm)/, "Dezimalpunkt statt Komma"]
  ];

  function styleGuard(rep) {
    var found = [];
    ["befund", "beurteilung", "methodik"].forEach(function (f) {
      if (!rep[f]) return;
      FIXES.forEach(function (p) { rep[f] = rep[f].replace(p[0], p[1]); });
      rep[f] = rep[f].replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
      // Satzanfang nach Entfernung einer Floskel wieder gross schreiben
      rep[f] = rep[f].replace(/(^|[.!?]\s+)([a-zäöü])/g, function (_, a, b) { return a + b.toUpperCase(); });
      WARN.forEach(function (w) { if (w[0].test(rep[f])) found.push(w[1]); });
    });
    return found;
  }

  /* ----------------------------------------------------------- Parser */
  // Manche Modelle haengen ihren Denk- oder Pruefschritt an die Antwort an.
  // Diese Marken kommen in einem deutschen Befundtext nicht vor.
  var META = /(<\/?think>|<\/?reasoning>|\bLet me\b|\bLet's\b|\bI should\b|\bI need to\b|\bWe (?:should|need|are|can|used|changed|kept|removed)\b|\bThe (?:instruction|user|original|answer)\b|\bCheck (?:for|that|measurement)\b|\bNow (?:ensure|check|final)\b|\bEnsure\b|\bNote:|\bOkay,|\bWait,|\bFinal answer\b|\bGood\.\s|\bThat's (?:allowed|fine|ok)\b|\bprohibited phrases\b|\bHinweis an mich\b|\bSelbstprüfung\b|\bPrüfschritt\b)/i;

  // Zweite Sicherung: ein Satz mit mehreren englischen Funktionswoertern gehoert
  // nicht zu einem deutschen Befund und markiert den Beginn eines Selbstkommentars.
  var EN = /\b(the|we|they|should|could|would|maybe|must|need|needs|answer|question|sentence|words|unchanged|adjust|compressed|instruction|allowed|correct|remove[d]?|keep|kept|check)\b/gi;

  function cutEnglish(text) {
    var parts = text.split(/(?<=[.!?])\s+/);
    var acc = 0;
    for (var i = 0; i < parts.length; i++) {
      var hits = parts[i].match(EN);
      if (hits && hits.length >= 2) return text.slice(0, acc).trim();
      acc += parts[i].length + 1;
    }
    return text;
  }

  function stripMeta(text) {
    text = String(text || "");
    // vollstaendige Reasoning-Bloecke entfernen
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
      if (!key) return;
      var end = i + 1 < hits.length ? hits[i + 1].s : text.length;
      out[key] = stripMeta(text.slice(h.e, end)).replace(/\s+/g, " ").trim();
    });
    ["titel", "klinik", "frage", "methodik", "befund", "beurteilung"].forEach(function (k) {
      if (out[k] == null) out[k] = fallback[k] || "";
    });
    return out;
  }

  /* --------------------------------------------------------- Generierung */
  var controller = null, lastResult = null;

  function buildUserMessage(ctx, instruction) {
    var p = ctx.path;
    return [
      "KONTEXT DER AUSWAHL",
      "Modalität: " + p.mod,
      "Untersuchungsregion: " + p.region,
      "Thema (aus klinischer Angabe): " + p.thema,
      "Fragestellung: " + p.frage,
      "Vorlage ist ein " + (ctx.isNormal ? "Normalbefund" : "Referenzbefund") + ".",
      "",
      "BESTEHENDER BEFUND",
      window.BTreportToText(ctx.report),
      "",
      "ÄNDERUNGSANWEISUNG",
      instruction.trim(),
      "",
      "Gib jetzt den vollständigen geänderten Befund im vorgegebenen Feldformat aus."
    ].join("\n");
  }

  function run() {
    var ctx = window.BTcurrent();
    if (!ctx.report) return toast("Kein Befund ausgewählt.", true);
    var key = apiKey();
    if (!key) {
      toast("Zuerst einen API-Key hinterlegen.", true);
      window.BTopenSheet("sheet-set");
      return;
    }
    var instruction = $("ai-instruction").value.trim();
    if (!instruction) return toast("Bitte eine Anweisung angeben.", true);

    var model = $("ai-model-quick").value || $("set-model").value;
    var stream = $("set-stream").checked;
    var temp = parseFloat($("set-temp").value);

    var out = $("ai-out");
    out.textContent = "";
    $("ai-bar").hidden = false;
    $("ai-run").disabled = true;
    $("ai-apply").disabled = true;
    $("ai-stop").hidden = false;
    lastResult = null;

    controller = new AbortController();
    var body = {
      model: model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildUserMessage(ctx, instruction) }
      ],
      temperature: isNaN(temp) ? 0.25 : temp,
      max_tokens: 2200,
      stream: !!stream,
      reasoning: { exclude: true }
    };

    fetch(API + "/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin && location.origin !== "null" ? location.origin : "https://befundatlas.local",
        "X-Title": "Befundatlas"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try { msg = JSON.parse(t).error.message; } catch (e) {}
          throw new Error("OpenRouter " + res.status + ": " + msg);
        });
      }
      return stream ? readStream(res, out) : res.json().then(function (j) {
        var c = j.choices && j.choices[0] && j.choices[0].message;
        var txt = (c && (c.content || c.reasoning)) || "";
        out.textContent = txt;
        return txt;
      });
    }).then(function (txt) {
      finish(txt, ctx);
    }).catch(function (e) {
      if (e.name === "AbortError") { toast("Abgebrochen."); }
      else { out.textContent = String(e.message || e); toast("Fehler bei der Anfrage.", true); }
      reset();
    });
  }

  function readStream(res, out) {
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "", full = "";
    var caret = document.createElement("span");
    caret.className = "caret";
    var txtNode = document.createTextNode("");
    out.appendChild(txtNode); out.appendChild(caret);

    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) { caret.remove(); return full; }
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(function (line) {
          line = line.trim();
          if (!line || line.charAt(0) === ":") return;       // SSE-Kommentar (Keep-Alive)
          if (line.indexOf("data:") !== 0) return;
          var payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            var j = JSON.parse(payload);
            var d = j.choices && j.choices[0] && j.choices[0].delta;
            if (d && d.content) {
              full += d.content;
              txtNode.nodeValue = full;
              out.scrollTop = out.scrollHeight;
            }
          } catch (e) { /* unvollständiges Fragment - naechster Chunk vervollstaendigt */ }
        });
        return pump();
      });
    })();
  }

  function finish(txt, ctx) {
    reset();
    if (!txt || !txt.trim()) { toast("Leere Antwort erhalten.", true); return; }
    var rep = parseReport(txt, ctx.report);
    var warn = $("set-guard").checked ? styleGuard(rep) : [];
    var broken = !rep.befund || rep.befund.length < 40 ||
                 (rep.beurteilung || "").length > 600 ||
                 /["„][^"“]{0,80}["“]\s*(none|correct|good)/i.test(rep.beurteilung || "");
    lastResult = rep;
    $("ai-apply").disabled = false;

    var old = document.getElementById("ai-guard");
    if (old) old.remove();
    var n = document.createElement("div");
    n.id = "ai-guard";
    if (broken) {
      n.className = "notice crit";
      n.textContent = "Die Antwort folgt dem Feldformat nicht sauber - dieses Modell hängt vermutlich " +
        "seinen Denkschritt an. Bitte ein anderes Modell wählen oder die Anfrage wiederholen.";
    } else if (warn.length) {
      n.className = "notice warn";
      n.textContent = "Stilprüfung: " + warn.filter(uniq).join(", ") + " — bitte vor Übernahme prüfen.";
    } else {
      n.className = "notice ok";
      n.textContent = "Stilprüfung ohne Beanstandung.";
    }
    $("ai-out").parentNode.appendChild(n);
    toast("Befund generiert.");
  }
  function uniq(v, i, a) { return a.indexOf(v) === i; }

  function reset() {
    $("ai-bar").hidden = true;
    $("ai-run").disabled = false;
    $("ai-stop").hidden = true;
    controller = null;
  }

  /* ------------------------------------------------------------- Bindung */
  function init() {
    // Presets
    var host = $("ai-presets");
    PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = p[0];
      b.onclick = function () {
        var t = $("ai-instruction");
        t.value = t.value.trim() ? t.value.trim() + " " + p[1] : p[1];
        t.focus();
      };
      host.appendChild(b);
    });

    // Einstellungen wiederherstellen
    $("set-remember").checked = get(LS.remember, "0") === "1";
    if ($("set-remember").checked) $("set-key").value = get(LS.key, "");
    $("set-temp").value = get(LS.temp, "0.25");
    $("set-guard").checked = get(LS.guard, "1") === "1";
    $("set-stream").checked = get(LS.stream, "1") === "1";
    $("set-freeonly").checked = get(LS.free, "1") === "1";

    $("set-key").oninput = function () {
      sessionKey = this.value.trim();
      if ($("set-remember").checked) set(LS.key, sessionKey); 
    };
    $("set-remember").onchange = function () {
      set(LS.remember, this.checked ? "1" : "0");
      if (this.checked) set(LS.key, apiKey());
      else del(LS.key);
    };
    $("set-clear").onclick = function () {
      sessionKey = ""; del(LS.key); $("set-key").value = "";
      $("set-keystatus").innerHTML = '<div class="notice info">Key entfernt.</div>';
    };
    $("set-test").onclick = function () {
      var k = apiKey();
      var box = $("set-keystatus");
      if (!k) { box.innerHTML = '<div class="notice crit">Kein Key eingetragen.</div>'; return; }
      box.innerHTML = '<div class="bar"><i></i></div>';
      fetch(API + "/key", { headers: { Authorization: "Bearer " + k } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) {
          var d = j.data || {};
          var limit = d.limit == null ? "ohne Limit" : ("Limit " + d.limit + " USD");
          box.innerHTML = '<div class="notice ok">Key gültig · ' + limit +
            ' · Verbrauch ' + (d.usage || 0).toFixed(4) + ' USD</div>';
          loadModels(true);
        })
        .catch(function () { box.innerHTML = '<div class="notice crit">Key ungültig oder nicht erreichbar.</div>'; });
    };
    $("set-freeonly").onchange = function () { set(LS.free, this.checked ? "1" : "0"); fillModelSelects(); };
    $("set-reload").onclick = function () { loadModels(true); };
    $("set-model").onchange = function () { set(LS.model, this.value); $("ai-model-quick").value = this.value; };
    $("ai-model-quick").onchange = function () { set(LS.model, this.value); $("set-model").value = this.value; };
    $("set-temp").onchange = function () { set(LS.temp, this.value); };
    $("set-guard").onchange = function () { set(LS.guard, this.checked ? "1" : "0"); };
    $("set-stream").onchange = function () { set(LS.stream, this.checked ? "1" : "0"); };

    $("ai-run").onclick = run;
    $("ai-stop").onclick = function () { if (controller) controller.abort(); };
    $("ai-apply").onclick = function () {
      if (!lastResult) return;
      window.BTapplyAI(lastResult);
      window.BTcloseSheets();
    };
    $("ai-instruction").addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    });

    window.BTaiOpened = function () {
      var ctx = window.BTcurrent();
      var box = $("ai-context");
      if (!ctx.report) { box.className = "notice crit"; box.textContent = "Kein Befund ausgewählt."; return; }
      box.className = "notice info";
      box.textContent = "Vorlage: " + (ctx.isNormal ? "Normalbefund" : "Referenzbefund") + " · " +
        ctx.path.mod + " · " + ctx.path.region + " · " + ctx.path.thema + " · " + ctx.path.frage;
    };

    loadModels();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
