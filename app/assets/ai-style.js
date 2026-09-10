/* =========================================================================
   Befundatlas - Stilmaschine
   Sammelt echte Referenzbefunde derselben Konstellation, misst daraus ein
   Stilprofil und baut den vollständigen Auftrag an das Sprachmodell.
   Der Korpus liefert ausschließlich Stil - niemals Befundinhalte.
   ========================================================================= */
window.BTStyle = (function () {
  "use strict";

  /* ------------------------------------------------------------- Hilfen */
  function sentences(t) {
    return String(t || "").split(/(?<=[.!?])\s+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 2; });
  }
  function words(t) { return String(t || "").trim().split(/\s+/).filter(Boolean).length; }
  function median(a) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; });
    var m = b.length >> 1;
    return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2);
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }

  /** Ersetzt Zahlen und Datumsangaben durch Auslassungspunkte: aus einem Satz
   *  wird sein Muster, ohne dass ein Messwert in den Auftrag gelangt. */
  function generisch(s) {
    return String(s || "")
      .replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, "…")
      .replace(/\(Serie[^)]*\)/gi, "(Serie …, Bild …)")
      .replace(/\d+(?:[.,]\d+)?/g, "…")
      .replace(/(?:… ){2,}/g, "… ")
      .trim();
  }

  /* ============================================== Referenzen einsammeln */
  /**
   * Vier Stufen, absteigende Passgenauigkeit:
   *  A  identische Auswahl (Modalität, Region, Thema, Fragestellung)
   *  B  gleiche Region und gleiche Fragestellung, anderes Thema
   *  C  gleiche Region und gleiches Thema, andere Fragestellung
   *  D  gleiche Region, beste Befunde
   */
  function pools(ctx) {
    var IDX = window.BTdata.index;
    var reg = IDX.modalitaeten[ctx.mod] && IDX.modalitaeten[ctx.mod][ctx.region];
    if (!reg) return { reg: null, tiers: [] };
    var A = [], B = [], C = [], D = [];
    Object.keys(reg.themen).forEach(function (t) {
      var fr = reg.themen[t].fragen;
      Object.keys(fr).forEach(function (f) {
        var ids = fr[f];
        if (t === ctx.thema && f === ctx.frage) A = A.concat(ids);
        else if (f === ctx.frage) B = B.concat(ids);
        else if (t === ctx.thema) C = C.concat(ids);
        else D = D.concat(ids);
      });
    });
    return { reg: reg, tiers: [
      { tier: "A", label: "identische Auswahl", ids: A },
      { tier: "B", label: "gleiche Region und Fragestellung", ids: B },
      { tier: "C", label: "gleiche Region und Thema", ids: C },
      { tier: "D", label: "gleiche Region", ids: D }
    ] };
  }

  /** Auswahl der Stilvorbilder: Qualität zuerst, dann inhaltliche Streuung. */
  function pick(ctx, max) {
    max = max || 5;
    var p = pools(ctx);
    if (!p.reg) return { list: [], tier: "-", n: 0 };
    var sh = window.BTdata.shard(p.reg.slug);
    if (!sh) return { list: [], tier: "-", n: 0 };

    var out = [], seenText = {}, seenKlinik = {}, usedTier = null, poolSize = 0;

    p.tiers.forEach(function (t) {
      if (out.length >= max) return;
      if (t.tier === "A") poolSize = t.ids.length;
      var cands = t.ids.map(function (id) { return sh.reports[id]; })
                       .filter(function (r) { return r && r.beurteilung && r.befund.length > 120; });
      cands.sort(function (a, b) { return b.q - a.q; });
      // erste Runde: nur unterschiedliche klinische Angaben zulassen
      [true, false].forEach(function (strict) {
        cands.forEach(function (r) {
          if (out.length >= max) return;
          var k = norm(r.befund).slice(0, 80);
          if (seenText[k]) return;
          var kk = norm(r.klinik);
          if (strict && kk && seenKlinik[kk]) return;
          seenText[k] = 1; seenKlinik[kk] = 1;
          out.push(r);
          if (!usedTier) usedTier = t.tier;
          else if (usedTier.indexOf(t.tier) < 0) usedTier += "+" + t.tier;
        });
      });
    });
    return { list: out, tier: usedTier || "-", n: poolSize };
  }

  /* ================================================= Stilprofil messen */
  function profile(ctx) {
    var p = pools(ctx);
    if (!p.reg) return null;
    var sh = window.BTdata.shard(p.reg.slug);
    if (!sh) return null;

    // Grundgesamtheit: exakte Auswahl, bei zu wenigen Fällen um Stufe B erweitert
    var ids = p.tiers[0].ids.slice();
    if (ids.length < 12) ids = ids.concat(p.tiers[1].ids);
    if (ids.length < 12) ids = ids.concat(p.tiers[2].ids);
    ids = ids.slice(0, 120);

    var bw = [], bs = [], sl = [], uw = [], us = [];
    var negCount = {}, methCount = {}, openCount = {}, beurCount = {};

    ids.forEach(function (id) {
      var r = sh.reports[id];
      if (!r) return;
      var sb = sentences(r.befund);
      if (sb.length) {
        bw.push(words(r.befund));
        bs.push(sb.length);
        sb.forEach(function (s) {
          sl.push(words(s));
          // Kurze Negativ-/Normalaussagen sind die stiltragenden Bausteine
          if (words(s) <= 7 && /^(Kein|Keine|Intakt|Intakte|Intakter|Intaktes|Normal|Normale|Normales|Regelrecht|Regelrechte|Unauff)/.test(s)) {
            negCount[s] = (negCount[s] || 0) + 1;
          }
        });
        // Zahlen ausblenden: das Muster ist der Stil, der Messwert waere ein Inhaltsleck
        var op = generisch(sb[0]);
        if (words(op) <= 12) openCount[op] = (openCount[op] || 0) + 1;
      }
      if (r.beurteilung) {
        uw.push(words(r.beurteilung));
        us.push(sentences(r.beurteilung).length);
        var b1 = sentences(r.beurteilung)[0];
        if (b1 && words(b1) <= 10) { b1 = generisch(b1); beurCount[b1] = (beurCount[b1] || 0) + 1; }
      }
      if (r.methodik) methCount[r.methodik] = (methCount[r.methodik] || 0) + 1;
    });

    function top(obj, n) {
      return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n);
    }
    return {
      n: bw.length,
      befundWoerter: median(bw),
      befundSaetze: median(bs),
      satzLaenge: median(sl),
      beurteilungWoerter: median(uw),
      beurteilungSaetze: median(us),
      negative: top(negCount, 10),
      methodik: top(methCount, 1)[0] || (p.reg.methodik || ""),
      eroeffnung: top(openCount, 3),
      beurteilungMuster: top(beurCount, 4)
    };
  }

  /* ====================================== Ordnung nach Fragestellungstyp */
  var ORDNUNG = {
    "Primäres Staging": [
      "Primärtumor mit Lokalisation und Ausdehnung",
      "regionale Lymphknoten",
      "Fernmetastasen in den erfassten Kompartimenten",
      "entscheidende Komplikationen und relevante Nebenbefunde",
      "Beurteilung: Ausdehnung und Stadium zuerst, dann Nodal- und Fernstatus"
    ],
    "Lokales Staging & Ausbreitungsdiagnostik": [
      "exakte Lage und Ausdehnung des Herdes",
      "Beziehung zu den operabilitätsbestimmenden Strukturen, Kapsel-, Faszien- und Organgrenzen",
      "Gefäß-, Gang- und Nervenbeteiligung, soweit beurteilbar",
      "regionale Lymphknoten",
      "Beurteilung: planungsrelevante Anatomie und lokale Stadien-Notation, kein Organinventar"
    ],
    "Restaging & Therapieansprechen": [
      "gültiger Vergleich zuerst",
      "bekannte Zielläsion und Verlauf",
      "Lymphknoten und Verlauf",
      "Fernbefall und neue Herde",
      "Beurteilung: Nettoverlauf zuerst, formale Ansprechbegriffe nur bei belegter Datenlage"
    ],
    "Verlaufskontrolle": [
      "gültiger Vergleich zuerst",
      "die verfolgten Befunde mit direkt angehängter Verlaufsaussage",
      "neu aufgetretene Befunde",
      "unveränderte Nebenbefunde nur, wenn sie entscheidungsrelevant sind",
      "Beurteilung: Verlaufsaussage in einem Satz"
    ],
    "Rezidiv & Nachsorge": [
      "Tumorbett oder bekannter Lokalisationsort",
      "regionale Lymphknoten",
      "Fernbefall im erfassten Bereich",
      "entscheidende Negativaussagen, soweit beurteilbar",
      "Beurteilung: Rezidivfrage direkt beantworten"
    ],
    "Metastasensuche": [
      "Organbefall in der Reihenfolge der Trefferwahrscheinlichkeit",
      "Lymphknotenstatus",
      "Skelettstatus",
      "Beurteilung: Metastasenfrage direkt beantworten"
    ],
    "Therapie- & OP-Planung": [
      "exakte Lokalisation und Ausdehnung",
      "Beziehung zu den für den Eingriff maßgeblichen Strukturen",
      "Zugangs- und resektionsrelevante Anatomie, Varianten",
      "Beurteilung: nur planungsrelevante Aussagen"
    ],
    "Verletzungsfolgen & Trauma": [
      "Hauptverletzung zuerst",
      "genaue Morphologie, Dislokation, Gelenkbeteiligung, soweit beurteilbar",
      "Begleitverletzungen an Knochen und Weichteilen",
      "Komplikationen und entscheidende Negativaussagen",
      "Beurteilung: Verletzungsmuster sehr knapp"
    ],
    "Fraktur & Konsolidierung": [
      "Frakturnachweis und Verlauf der Durchbauung",
      "Stellung, Materiallage, Lockerungszeichen",
      "Begleitverletzungen und Komplikationen",
      "Beurteilung: Konsolidierungsgrad in einem Satz"
    ],
    "Entzündung & Abszess": [
      "Fokus und anatomische Ausdehnung",
      "drainierbare Verhalte, Phlegmone, Fistel, Knochen- oder Gelenkbeteiligung",
      "Komplikationen und Ausbreitungswege",
      "Beurteilung: aktiver Fokus und Komplikationsstatus"
    ],
    "Dignität unklarer Befund": [
      "Herdbeschreibung mit Größe, Signal- beziehungsweise Dichteverhalten und Kontrastmittelkinetik",
      "Kriterien, die für oder gegen Malignität sprechen",
      "Umgebungsreaktion und Lymphknoten",
      "Beurteilung: Dignitätsaussage mit erhaltener Differenzialdiagnose-Hierarchie"
    ],
    "Ursache der Beschwerden": [
      "die Struktur, die die Frage direkt beantwortet",
      "begleitendes Reaktionsmuster in Knochenmark und Weichteilen",
      "relevante Nebenstrukturen, kein vollständiges Inventar",
      "Beurteilung: Hauptbefund, dann wichtige Begleitbefunde"
    ],
    "Vorsorgeuntersuchung": [
      "Organe in fester Reihenfolge, jeweils knapp",
      "kontrollbedürftige Befunde ausdrücklich benennen",
      "Beurteilung: eine Zeile"
    ],
    "Allgemeine Befundabklärung": [
      "die Struktur, die die Frage direkt beantwortet",
      "relevante Begleitbefunde",
      "Beurteilung: knappe Antwort auf die Fragestellung"
    ]
  };

  /* ============================ Zusätzliche Bindungen aus der Vorlage */
  /**
   * Aus der Vorlage abgeleitete Bindungen. Sie dürfen die Änderungsanweisung nie
   * aushebeln: verlangt die Anweisung genau das, was die Vorlage ausschließt,
   * entfällt die Bindung und wird durch die passende Gegenvorgabe ersetzt.
   */
  function bindings(rep, ctx, instruction) {
    var ins = String(instruction || "").toLowerCase();
    var willVerlauf = /verlauf|vergleich|voruntersuch|vorbefund|restaging|nachsorge|kontrolle|progredien|regredien|konstant/.test(ins);
    var willErst    = /erstuntersuchung|ohne vergleich|voruntersuchung entfernen|keine voraufnahme/.test(ins);
    var willKM      = /kontrastmittel|\bkm\b|post km|perfusion|kontrastiert/.test(ins) && !/ohne kontrastmittel|nativ/.test(ins);
    var willNativ   = /nativ|ohne kontrastmittel/.test(ins);

    var out = [];
    var alles = (rep.befund || "") + " " + (rep.beurteilung || "");
    var hatVergleich = /Es liegt die (CT|MRT) vom/.test(rep.befund || "");
    var ohneVoraufnahme = /Keine Voraufnahmen/.test(rep.befund || "");
    var nativ = !!rep.methodik && !/post KM|Kontrastmittelgest|CTA|MRA|mit KM/.test(rep.methodik);

    if (/\[Datum\]/.test(alles) || willVerlauf)
      out.push("Ein Vergleichsdatum wird nicht erfunden: es bleibt der Platzhalter [Datum].");

    if (willVerlauf && !willErst) {
      out.push("Der Vergleichssatz „Es liegt die " + ctx.mod + " vom [Datum] zum Vergleich vor.“ " +
               "steht als erster Satz des Befundes; Verlaufsworte gehören direkt an die verfolgten Befunde.");
    } else if (ohneVoraufnahme && !willVerlauf) {
      out.push("Es liegt keine Voruntersuchung vor. Keine Verlaufsaussage, kein Vergleichssatz.");
    } else if (hatVergleich && !willErst) {
      out.push("Der Vergleichssatz bleibt der erste Satz des Befundes.");
    }
    if (willErst)
      out.push("Der Befund ist eine Erstuntersuchung: Vergleichssatz und alle Verlaufsaussagen entfallen.");

    if (nativ && !willKM)
      out.push("Die Untersuchung ist nativ. Keine Aussagen zu Kontrastmittelaufnahme oder Perfusion.");
    if (willNativ)
      out.push("Die Methodikzeile wird auf eine native Untersuchung umgestellt.");

    if (ctx.mod === "CT")
      out.push("CT-Terminologie: Dichte, Kontrastierung, Osteolysen - keine Signal- oder Sequenzbegriffe.");
    else
      out.push("MRT-Terminologie: Signalgebung, Diffusion, Kontrastmittelaufnahme - keine Dichtewerte.");
    return out;
  }

  /* ============================================== Auftrag zusammenbauen */
  function buildUser(ctx, instruction, ex, prof) {
    var L = [];
    L.push("### 1  AUSWAHL");
    L.push("Modalität: " + ctx.mod);
    L.push("Untersuchungsregion: " + ctx.region);
    L.push("Thema aus der klinischen Angabe: " + ctx.thema);
    L.push("Fragestellung: " + ctx.frage);
    L.push("Die Vorlage ist ein " + (ctx.isNormal ? "Normalbefund" : "Referenzbefund") + ".");
    L.push("");

    if (prof && prof.n >= 3) {
      L.push("### 2  GEMESSENES STILPROFIL DIESER KONSTELLATION");
      L.push("Erhoben an " + prof.n + " Befunden derselben Auswahl:");
      L.push("- Befund: Median " + prof.befundWoerter + " Wörter in " + prof.befundSaetze +
             " Sätzen, mittlere Satzlänge " + prof.satzLaenge + " Wörter.");
      if (prof.beurteilungWoerter)
        L.push("- Beurteilung: Median " + prof.beurteilungWoerter + " Wörter in " +
               prof.beurteilungSaetze + " Sätzen. Deutlich knapper als der Befund.");
      if (prof.methodik) L.push("- Übliche Methodikzeile: " + prof.methodik);
      if (prof.eroeffnung.length)
        L.push("- Übliche Eröffnung des Befundes: " + prof.eroeffnung.map(q).join(" | "));
      if (prof.negative.length)
        L.push("- Stiltragende Kurzaussagen dieser Region: " + prof.negative.join(" ")); 
      if (prof.beurteilungMuster.length)
        L.push("- Übliche erste Beurteilungszeile: " + prof.beurteilungMuster.map(q).join(" | "));
      L.push("Halte diese Dichte ein. Weiche nur ab, wo der Inhalt es zwingend verlangt.");
      L.push("");
    }

    var ord = ORDNUNG[ctx.frage];
    if (ord) {
      L.push("### 3  ORDNUNG FÜR DEN PHÄNOTYP „" + ctx.frage + "“");
      ord.forEach(function (o, i) { L.push((i + 1) + ". " + o); });
      L.push("Fülle keine Position mit einem erfundenen Normalbefund, nur weil sie in der Liste steht.");
      L.push("");
    }

    if (ex && ex.length) {
      L.push("### 4  ECHTE REFERENZBEFUNDE - AUSSCHLIESSLICH STILVORBILD");
      ex.forEach(function (r, i) {
        L.push("[R" + (i + 1) + "]");
        if (r.klinik) L.push("Klin. Angaben: " + r.klinik);
        if (r.frage) L.push("Fragestellung: " + r.frage);
        if (r.methodik) L.push("Methodik: " + r.methodik);
        L.push("Befund: " + r.befund);
        if (r.beurteilung) L.push("Beurteilung: " + r.beurteilung);
        L.push("");
      });
      L.push("Diese Referenzen zeigen Wortwahl, Satzbau, Satzlänge, Reihenfolge und Verdichtung.");
      L.push("Aus ihnen darf kein einziger Befund, kein Maß, keine Seitenangabe, kein Datum,");
      L.push("keine Serien- oder Bildnummer und keine Empfehlung übernommen werden.");
      L.push("");
    }

    L.push("### 5  ZU BEARBEITENDER BEFUND");
    L.push(window.BTreportToText(ctx.report));
    L.push("");

    L.push("### 6  ÄNDERUNGSANWEISUNG");
    L.push(instruction.trim());
    var b = bindings(ctx.report, ctx, instruction);
    if (b.length) {
      L.push("");
      L.push("Zusätzlich bindend:");
      b.forEach(function (x) { L.push("- " + x); });
    }
    L.push("");
    L.push("Gib jetzt den vollständigen geänderten Befund im vorgegebenen Feldformat aus.");
    return L.join("\n");
  }
  function q(s) { return "„" + s + "“"; }

  /* ================================ Auftrag für den Stilangleich-Durchgang */
  function buildRepair(ctx, draft, ex, prof) {
    var L = [];
    L.push("### AUFGABE  STILANGLEICH");
    L.push("Der folgende Befund ist inhaltlich fertig. Ändere ausschließlich die Form.");
    L.push("Kein medizinischer Inhalt darf hinzukommen, wegfallen oder sich verschieben:");
    L.push("Seitenangaben, Lokalisationen, Zahlen, Maße, Vergleichsangaben, Sicherheitsgrade,");
    L.push("Stadien und Empfehlungen bleiben exakt erhalten.");
    L.push("");
    L.push("Zu korrigieren sind:");
    L.push("- zu lange Sätze mit mehreren eigenständigen Aussagen: trennen");
    L.push("- verbotene Wendungen und Weichmacher: ersetzen");
    L.push("- Reihenfolge, die der Phänotyp-Ordnung widerspricht: umstellen");
    L.push("- eine Beurteilung, die den Befund wiederholt: verdichten");
    L.push("- abweichende Schreibweisen bei Maßen, ADC und Bildverweisen: angleichen");
    if (prof && prof.n >= 3) {
      L.push("");
      L.push("Zielwerte dieser Konstellation: Befund etwa " + prof.befundWoerter + " Wörter in " +
             prof.befundSaetze + " Sätzen, mittlere Satzlänge " + prof.satzLaenge + " Wörter" +
             (prof.beurteilungWoerter ? ", Beurteilung etwa " + prof.beurteilungWoerter + " Wörter" : "") + ".");
    }
    if (ex && ex.length) {
      L.push("");
      L.push("### STILVORBILDER");
      ex.slice(0, 3).forEach(function (r, i) {
        L.push("[R" + (i + 1) + "] Befund: " + r.befund);
        if (r.beurteilung) L.push("        Beurteilung: " + r.beurteilung);
      });
    }
    L.push("");
    L.push("### ZU ÜBERARBEITENDER BEFUND");
    L.push(window.BTreportToText(draft));
    L.push("");
    L.push("Gib den überarbeiteten Befund im vorgegebenen Feldformat aus. Sonst nichts.");
    return L.join("\n");
  }

  return {
    pick: pick, profile: profile, buildUser: buildUser, buildRepair: buildRepair,
    ordnung: ORDNUNG, sentences: sentences, words: words, median: median
  };
})();
