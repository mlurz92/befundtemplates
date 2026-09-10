/* =========================================================================
   Befundatlas - Navigation, Shard-Laden, Befundanzeige
   Klassisches Script ohne Modulsystem: laeuft auch direkt von der Festplatte.
   ========================================================================= */
(function () {
  "use strict";

  var IDX = window.__BT_INDEX__;
  var SHARDS = {};           // slug -> { reports, normals }
  var pending = {};          // slug -> [callback]

  /* ------------------------------------------------- Shard-Nachladen */
  window.__BT_SHARD__ = function (slug, reports, normals) {
    SHARDS[slug] = { reports: reports, normals: normals };
    (pending[slug] || []).forEach(function (cb) { cb(SHARDS[slug]); });
    delete pending[slug];
  };

  function loadShard(slug, cb) {
    if (SHARDS[slug]) return cb(SHARDS[slug]);
    if (pending[slug]) return pending[slug].push(cb);
    pending[slug] = [cb];
    var s = document.createElement("script");
    s.src = "data/reports/" + slug + ".js";
    s.onerror = function () {
      delete pending[slug];
      toast("Datenpaket „" + slug + "“ konnte nicht geladen werden.", true);
    };
    document.head.appendChild(s);
  }

  /* --------------------------------------------------------- Helfer */
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fold(s) {
    return String(s || "").toLowerCase()
      .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
  }
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>';

  function toast(msg, isErr) {
    var t = el("div", "toast" + (isErr ? " err" : ""));
    t.innerHTML = (isErr ? ICON_ERR : ICON_OK) + "<span></span>";
    t.lastChild.textContent = msg;
    $("toasts").appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }
  window.BTtoast = toast;

  function copy(text, what) {
    var done = function () { toast((what || "Befund") + " kopiert."); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = el("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Kopieren nicht möglich.", true); }
      ta.remove();
    }
  }

  /* ------------------------------------------------------- Zustand */
  var S = {
    mod: null, region: null, thema: null, frage: null,
    tab: "normal",          // "normal" | "ref"
    refIndex: 0,
    aiReport: null,         // vom Modell erzeugter Befund
    filter: "",
    showList: false
  };

  var STEPS = [
    { key: "mod",    label: "Modalität",   hint: "Untersuchungsverfahren" },
    { key: "region", label: "Region",      hint: "Untersuchungsregion" },
    { key: "thema",  label: "Thema",       hint: "aus den klinischen Angaben" },
    { key: "frage",  label: "Fragestellung", hint: "Auftrag an die Bildgebung" }
  ];

  function openStepIndex() {
    if (manualOpen === -1) return -1;
    if (manualOpen != null) return manualOpen;
    for (var i = 0; i < STEPS.length; i++) if (!S[STEPS[i].key]) return i;
    return STEPS.length - 1;   // vollstaendig gewaehlt: letzte Stufe bleibt offen
  }
  var manualOpen = null;

  /* ------------------------------------------------ Datenzugriffe */
  function regions() { return S.mod ? IDX.modalitaeten[S.mod] : {}; }
  function regionNode() { return S.region ? regions()[S.region] : null; }
  function themen() { var r = regionNode(); return r ? r.themen : {}; }
  function themaNode() { var t = themen(); return S.thema ? t[S.thema] : null; }
  function fragen() { var t = themaNode(); return t ? t.fragen : {}; }
  function currentIds() { var f = fragen(); return (S.frage && f[S.frage]) || []; }

  /* ======================================================= Rendering */

  function renderCrumbs() {
    var c = $("crumbs");
    c.innerHTML = "";
    var vals = [S.mod, S.region, S.thema, S.frage];
    var any = false;
    STEPS.forEach(function (st, i) {
      if (!vals[i]) return;
      any = true;
      var b = el("button", "crumb done");
      b.type = "button";
      b.innerHTML = '<i>' + (i + 1) + '</i><b></b>';
      b.querySelector("b").textContent = vals[i];
      b.title = st.label + ": " + vals[i] + " — zum Ändern anklicken";
      b.onclick = function () { resetFrom(i); manualOpen = i; render(); };
      c.appendChild(b);
    });
    if (!any) {
      var h = el("span", "opt-note", "Auswahl beginnt mit der Modalität.");
      h.style.padding = "2px 4px";
      c.appendChild(h);
    }
  }

  function resetFrom(i) {
    for (var k = i; k < STEPS.length; k++) S[STEPS[k].key] = null;
    S.aiReport = null; S.refIndex = 0; S.filter = "";
    if (i <= 3) S.tab = "normal";
  }

  function choose(stepIdx, value) {
    resetFrom(stepIdx);
    S[STEPS[stepIdx].key] = value;
    manualOpen = null;
    // Einzige verbleibende Option automatisch übernehmen
    autoAdvance();
    if (S.frage) {
      S.tab = "normal";
      var m = $("main");
      if (window.matchMedia("(max-width:1080px)").matches) m.setAttribute("data-mobile", "doc");
    }
    render();
  }

  function autoAdvance() {
    var guard = 0;
    while (guard++ < 4) {
      if (!S.mod) return;
      if (!S.region) {
        var rk = Object.keys(regions());
        if (rk.length === 1) { S.region = rk[0]; continue; }
        return;
      }
      if (!S.thema) {
        var tk = Object.keys(themen());
        if (tk.length === 1) { S.thema = tk[0]; continue; }
        return;
      }
      if (!S.frage) {
        var fk = Object.keys(fragen());
        if (fk.length === 1) { S.frage = fk[0]; continue; }
        return;
      }
      return;
    }
  }

  function stepValue(i) {
    return [S.mod, S.region, S.thema, S.frage][i];
  }

  function renderSteps() {
    var host = $("steps");
    host.innerHTML = "";
    var open = openStepIndex();

    STEPS.forEach(function (st, i) {
      var enabled = i === 0 || !!stepValue(i - 1);
      var wrap = el("div", "step" + (i === open && enabled ? (i === 0 ? " is-open" : " is-open grow") : "") + (stepValue(i) ? " is-done" : ""));
      if (!enabled) wrap.setAttribute("aria-disabled", "true");

      var head = el("button", "step-head");
      head.type = "button";
      head.setAttribute("aria-expanded", String(i === open && enabled));
      head.innerHTML =
        '<span class="step-num">' + (stepValue(i) ? "✓" : (i + 1)) + '</span>' +
        '<span class="step-titles">' +
          '<span class="step-label">' + esc(st.label) + '</span>' +
          '<span class="step-value ' + (stepValue(i) ? "" : "muted") + '"></span>' +
        '</span>' +
        '<svg class="step-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>';
      head.querySelector(".step-value").textContent = stepValue(i) || st.hint;
      head.onclick = function () {
        if (!enabled) return;
        manualOpen = (i === open) ? -1 : i;
        render();
      };
      wrap.appendChild(head);

      var body = el("div", "step-body");
      if (i === open && enabled) buildStepBody(i, body);
      wrap.appendChild(body);
      host.appendChild(wrap);
    });
  }

  var MOD_ICON = {
    CT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/></svg>',
    MRT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M8.5 6v12M15.5 6v12"/><circle cx="12" cy="12" r="1.8"/></svg>'
  };

  function buildStepBody(i, body) {
    if (i === 0) {
      var grid = el("div", "mod-grid");
      ["CT", "MRT"].forEach(function (m, n) {
        if (!IDX.modalitaeten[m]) return;
        var regs = IDX.modalitaeten[m];
        var count = 0, rn = 0;
        for (var k in regs) { count += regs[k].n; rn++; }
        var b = el("button", "mod-card");
        b.type = "button";
        b.setAttribute("aria-selected", String(S.mod === m));
        b.style.animation = "rise var(--dur-3) var(--ease-out) " + (n * 60) + "ms both";
        b.innerHTML = MOD_ICON[m] +
          '<span class="mod-name">' + m + '</span>' +
          '<span class="mod-note">' + rn + " Regionen · " + count.toLocaleString("de-DE") + " Befunde</span>";
        b.onclick = function () { choose(0, m); };
        grid.appendChild(b);
      });
      body.appendChild(grid);
      return;
    }

    var items = [];
    if (i === 1) {
      var regs = regions();
      Object.keys(regs).forEach(function (r) {
        items.push({ value: r, note: regs[r].gruppe, count: regs[r].n, group: regs[r].gruppe });
      });
      items.sort(function (a, b) {
        return a.group.localeCompare(b.group, "de") || b.count - a.count;
      });
    } else if (i === 2) {
      var th = themen();
      Object.keys(th).forEach(function (t) { items.push({ value: t, count: th[t].n }); });
      items.sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value, "de"); });
    } else {
      var fr = fragen();
      Object.keys(fr).forEach(function (f) { items.push({ value: f, count: fr[f].length }); });
      items.sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value, "de"); });
    }

    var needsFilter = items.length > 9;
    var q = "";
    var listWrap = el("div", "opts scroll");

    function paint() {
      listWrap.innerHTML = "";
      var qq = fold(q);
      var shown = items.filter(function (it) { return !qq || fold(it.value).indexOf(qq) >= 0; });
      if (!shown.length) {
        listWrap.appendChild(el("div", "empty-hint", "Kein Eintrag passt zum Filter."));
        return;
      }
      var lastGroup = null;
      shown.forEach(function (it, n) {
        if (i === 1 && it.group !== lastGroup) {
          lastGroup = it.group;
          listWrap.appendChild(el("div", "group-label", it.group));
        }
        var b = el("button", "opt");
        b.type = "button";
        b.setAttribute("aria-selected", String(stepValue(i) === it.value));
        b.style.animationDelay = Math.min(n, 14) * 22 + "ms";
        var keyHint = n < 9 && !qq ? String(n + 1) : "·";
        b.innerHTML =
          '<span class="opt-key">' + keyHint + '</span>' +
          '<span class="opt-main"><span class="opt-title"></span>' +
          (it.note ? '<span class="opt-note"></span>' : "") + '</span>' +
          '<span class="opt-count">' + it.count.toLocaleString("de-DE") + '</span>';
        b.querySelector(".opt-title").textContent = it.value;
        if (it.note) b.querySelector(".opt-note").textContent = it.note;
        b.onclick = function () { choose(i, it.value); };
        listWrap.appendChild(b);
      });
    }

    if (needsFilter) {
      var f = el("div", "filter");
      f.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Filtern …">';
      var inp = f.querySelector("input");
      inp.setAttribute("aria-label", STEPS[i].label + " filtern");
      inp.oninput = function () { q = inp.value; paint(); };
      body.appendChild(f);
      setTimeout(function () { if (window.innerWidth > 1080) inp.focus(); }, 120);
    }
    body.appendChild(listWrap);
    paint();

    // Zifferntasten 1-9 waehlen die ersten Eintraege
    body.dataset.hotkeys = "1";
    body._pick = function (n) {
      var b = listWrap.querySelectorAll(".opt")[n];
      if (b) b.click();
    };
  }

  /* ------------------------------------------------------- Befunddoc */
  function normalReport() {
    var r = regionNode(); if (!r) return null;
    var sh = SHARDS[r.slug]; if (!sh) return null;
    return sh.normals[S.thema + "||" + S.frage] || null;
  }

  function refReports() {
    var r = regionNode(); if (!r) return [];
    var sh = SHARDS[r.slug]; if (!sh) return [];
    var ids = currentIds(), out = [];
    for (var i = 0; i < ids.length; i++) {
      var rep = sh.reports[ids[i]];
      if (rep) { rep = Object.create(rep); rep.id = ids[i]; out.push(rep); }
    }
    if (S.filter) {
      var q = fold(S.filter);
      out = out.filter(function (x) {
        return fold(x.befund + " " + x.beurteilung + " " + x.klinik + " " + x.frage).indexOf(q) >= 0;
      });
    }
    return out;
  }

  function highlight(text, q) {
    var t = esc(text);
    if (!q) return t;
    var needle = q.trim();
    if (needle.length < 2) return t;
    try {
      var rx = new RegExp("(" + needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      return t.replace(rx, '<mark class="hit">$1</mark>');
    } catch (e) { return t; }
  }

  function markPlaceholders(html) {
    return html.replace(/\[Datum\]/g, '<span class="ph">[Datum]</span>');
  }

  function reportToText(rep) {
    var L = [];
    if (rep.titel) L.push("Titel: " + rep.titel);
    if (rep.klinik) L.push("Klin. Angaben: " + rep.klinik);
    if (rep.frage) L.push("Fragestellung: " + rep.frage);
    if (rep.methodik) L.push("Methodik: " + rep.methodik);
    if (rep.befund) L.push("Befund: " + rep.befund);
    if (rep.beurteilung) L.push("Beurteilung: " + rep.beurteilung);
    return L.join("\n\n");
  }
  window.BTreportToText = reportToText;

  function currentReport() {
    if (S.aiReport) return S.aiReport;
    if (S.tab === "normal") return normalReport();
    var list = refReports();
    return list[Math.min(S.refIndex, list.length - 1)] || null;
  }
  window.BTcurrent = function () {
    return { report: currentReport(), path: { mod: S.mod, region: S.region, thema: S.thema, frage: S.frage },
             isNormal: S.tab === "normal" && !S.aiReport };
  };
  window.BTapplyAI = function (rep) {
    S.aiReport = rep;
    renderDoc();
    toast("KI-Fassung übernommen.");
  };

  function field(dt, dd, cls, q) {
    var d = el("dl", "field " + (cls || ""));
    var a = el("dt");
    a.textContent = dt;
    var b = el("dd");
    b.innerHTML = markPlaceholders(highlight(dd, q));
    if ((cls || "").indexOf("block") >= 0) {
      var cb = el("button", "copy-mini", "kopieren");
      cb.type = "button";
      cb.onclick = function (e) { e.stopPropagation(); copy(dd, dt); };
      a.appendChild(cb);
    }
    d.appendChild(a); d.appendChild(b);
    return d;
  }

  function renderDoc() {
    var wrap = $("doc-wrap");
    var head = $("viewer-head");

    if (!S.frage) {
      head.hidden = true;
      if (!wrap.querySelector("#placeholder")) wrap.innerHTML = PLACEHOLDER_HTML;
      buildPlaceholder();
      return;
    }
    head.hidden = false;

    var r = regionNode();
    if (!SHARDS[r.slug]) {
      wrap.innerHTML = '<div class="placeholder"><div class="placeholder-inner">' +
        '<div class="bar" style="width:180px"><i></i></div>' +
        '<p>Referenzbefunde werden geladen …</p></div></div>';
      loadShard(r.slug, function () { render(); });
      return;
    }

    var list = refReports();
    $("ref-count").textContent = list.length.toLocaleString("de-DE");
    $("btn-list").hidden = S.tab !== "ref";
    positionPill();

    var body = $("viewer-body");
    body.classList.toggle("with-list", S.tab === "ref");
    body.classList.toggle("show-list", S.showList);
    $("reflist").hidden = S.tab !== "ref";
    if (S.tab === "ref") renderRefList(list);

    var rep = currentReport();
    wrap.innerHTML = "";
    if (!rep) {
      wrap.innerHTML = '<div class="placeholder"><div class="placeholder-inner">' +
        '<h3>Kein Treffer</h3><p>Für diesen Filter liegt in der aktuellen Auswahl kein Referenzbefund vor.</p></div></div>';
      return;
    }

    var isNormal = !S.aiReport && S.tab === "normal";
    var doc = el("article", "doc");

    var top = el("div", "doc-top");
    var title = el("div", "doc-title");
    title.appendChild(el("div", "doc-kicker", S.mod + " · " + S.region));
    var h = el("h2"); h.textContent = rep.titel || (S.mod + " " + S.region); title.appendChild(h);
    var badges = el("div", "doc-badges");
    badges.style.marginTop = "var(--s-8)";
    if (S.aiReport) badges.appendChild(el("span", "tag ai", "KI-angepasst"));
    else if (isNormal) badges.appendChild(el("span", "tag ok", "Normalbefund"));
    else badges.appendChild(el("span", "tag info", "Referenzbefund " + (S.refIndex + 1) + " / " + list.length));
    badges.appendChild(el("span", "tag", S.thema));
    badges.appendChild(el("span", "tag", S.frage));
    title.appendChild(badges);
    top.appendChild(title);
    doc.appendChild(top);

    var q = S.tab === "ref" ? S.filter : "";
    if (rep.klinik) doc.appendChild(field("Klin. Angaben", rep.klinik, "", q));
    if (rep.frage) doc.appendChild(field("Fragestellung", rep.frage, "", q));
    if (rep.methodik) doc.appendChild(field("Methodik", rep.methodik, ""));
    if (rep.befund) doc.appendChild(field("Befund", rep.befund, "block", q));
    if (rep.beurteilung) doc.appendChild(field("Beurteilung", rep.beurteilung, "block beurteilung", q));

    var foot = el("div", "doc-foot");
    foot.appendChild(el("span", null, (rep.befund || "").split(/\s+/).length + " Wörter im Befund"));
    if (rep.studie) foot.appendChild(el("span", null, "Studienbeschreibung: " + rep.studie));
    if (isNormal) foot.appendChild(el("span", null, "Komponierter Normalbefund für diese Konstellation · [Datum] vor Verwendung ersetzen"));
    doc.appendChild(foot);

    wrap.appendChild(doc);

    if (S.tab === "ref" && list.length > 1) {
      var nav = el("div", "row");
      nav.style.cssText = "max-width:860px;margin:var(--s-12) auto 0;justify-content:center";
      var prev = el("button", "icon-btn", "◀ Vorheriger");
      prev.type = "button"; prev.disabled = S.refIndex <= 0;
      prev.onclick = function () { S.refIndex--; S.aiReport = null; renderDoc(); };
      var next = el("button", "icon-btn", "Nächster ▶");
      next.type = "button"; next.disabled = S.refIndex >= list.length - 1;
      next.onclick = function () { S.refIndex++; S.aiReport = null; renderDoc(); };
      nav.appendChild(prev); nav.appendChild(next);
      wrap.appendChild(nav);
    }
  }

  function renderRefList(list) {
    var host = $("reflist-items");
    host.innerHTML = "";
    list.forEach(function (rep, n) {
      var b = el("button", "refitem");
      b.type = "button";
      b.setAttribute("aria-selected", String(n === S.refIndex && !S.aiReport));
      b.style.animationDelay = Math.min(n, 18) * 16 + "ms";
      b.innerHTML = '<span class="no"></span><span class="tx"><span class="t1"></span><span class="t2"></span></span>';
      b.querySelector(".no").textContent = n + 1;
      b.querySelector(".t1").textContent = rep.klinik || rep.titel || "Ohne klinische Angabe";
      b.querySelector(".t2").textContent = rep.frage || (rep.befund || "").slice(0, 60);
      b.onclick = function () { S.refIndex = n; S.aiReport = null; S.showList = false; renderDoc(); };
      host.appendChild(b);
    });
    if (!list.length) host.appendChild(el("div", "empty-hint", "Kein Treffer für den Filter."));
  }

  function positionPill() {
    var pill = $("seg-pill");
    var active = S.tab === "normal" ? $("seg-normal") : $("seg-ref");
    $("seg-normal").setAttribute("aria-selected", String(S.tab === "normal"));
    $("seg-ref").setAttribute("aria-selected", String(S.tab === "ref"));
    pill.style.width = active.offsetWidth + "px";
    pill.style.transform = "translateX(" + active.offsetLeft + "px)";
  }

  var PLACEHOLDER_HTML = document.getElementById("placeholder").outerHTML;

  function buildPlaceholder() {
    var host = $("stats");
    if (!host || host.dataset.done) return;
    host.dataset.done = "1";
    var m = IDX.meta;
    [[m.referenzbefunde, "Referenzbefunde"], [m.normalbefunde, "Normalbefunde"],
     [m.regionen, "Regionen"], [Object.keys(IDX.modalitaeten).length, "Modalitäten"]]
      .forEach(function (p, i) {
        var s = el("div", "stat");
        var b = el("b", null, "0"); var t = el("span", null, p[1]);
        s.appendChild(b); s.appendChild(t); host.appendChild(s);
        countTo(b, p[0], 900 + i * 120);
      });
  }

  function countTo(node, target, ms) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = target.toLocaleString("de-DE"); return;
    }
    var t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, (t - t0) / ms);
      k = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(target * k).toLocaleString("de-DE");
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function render() {
    renderCrumbs();
    renderSteps();
    renderDoc();
    var m = $("main");
    if (window.matchMedia("(max-width:1080px)").matches) {
      $("btn-mobile").querySelector(".btn-label").textContent =
        m.getAttribute("data-mobile") === "nav" ? "Befund" : "Auswahl";
    }
  }

  /* ============================================================ Suche */
  function runSearch(q) {
    var host = $("search-results");
    host.innerHTML = "";
    q = (q || "").trim();
    if (q.length < 3) {
      host.appendChild(el("div", "empty-hint", "Mindestens drei Zeichen eingeben."));
      return;
    }
    var slugs = [], meta = {};
    Object.keys(IDX.modalitaeten).forEach(function (m) {
      var regs = IDX.modalitaeten[m];
      Object.keys(regs).forEach(function (r) {
        slugs.push(regs[r].slug);
        meta[regs[r].slug] = { mod: m, region: r };
      });
    });
    var loaded = 0, needle = fold(q), hits = [];
    host.innerHTML = '<div class="bar"><i></i></div>';

    slugs.forEach(function (sl) {
      loadShard(sl, function (sh) {
        if (hits.length < 40) {
          var ids = Object.keys(sh.reports);
          for (var i = 0; i < ids.length && hits.length < 40; i++) {
            var rep = sh.reports[ids[i]];
            var hay = fold(rep.befund + " " + rep.beurteilung + " " + rep.klinik + " " + rep.frage);
            var p = hay.indexOf(needle);
            if (p >= 0) hits.push({ slug: sl, id: ids[i], rep: rep, pos: p, meta: meta[sl] });
          }
        }
        if (++loaded === slugs.length) paint();
      });
    });

    function paint() {
      host.innerHTML = "";
      if (!hits.length) {
        host.appendChild(el("div", "empty-hint", "Keine Fundstelle für „" + q + "“."));
        return;
      }
      host.appendChild(el("div", "hint", hits.length + (hits.length >= 40 ? "+" : "") + " Fundstellen"));
      hits.forEach(function (h) {
        var b = el("button", "sr");
        b.type = "button";
        var src = h.rep.befund + " " + h.rep.beurteilung;
        var raw = fold(src).indexOf(needle);
        var snip = src.slice(Math.max(0, raw - 70), raw + 130);
        b.innerHTML = '<span class="p"></span><span class="s">…' + highlight(snip, q) + '…</span>';
        b.querySelector(".p").textContent = h.meta.mod + " · " + h.meta.region;
        b.onclick = function () { jumpTo(h); };
        host.appendChild(b);
      });
    }
  }

  function jumpTo(h) {
    var regs = IDX.modalitaeten[h.meta.mod][h.meta.region];
    var found = null;
    Object.keys(regs.themen).some(function (t) {
      return Object.keys(regs.themen[t].fragen).some(function (f) {
        if (regs.themen[t].fragen[f].indexOf(h.id) >= 0) { found = { t: t, f: f, i: regs.themen[t].fragen[f].indexOf(h.id) }; return true; }
        return false;
      });
    });
    if (!found) return toast("Zuordnung nicht gefunden.", true);
    S.mod = h.meta.mod; S.region = h.meta.region; S.thema = found.t; S.frage = found.f;
    S.tab = "ref"; S.refIndex = found.i; S.filter = ""; S.aiReport = null;
    manualOpen = null;
    closeSheets();
    $("main").setAttribute("data-mobile", "doc");
    render();
  }

  /* ======================================================= Seitenpanel */
  function openSheet(id) {
    closeSheets();
    var s = $(id);
    s.classList.add("open");
    s.setAttribute("aria-hidden", "false");
    $("scrim").classList.add("open");
    var f = s.querySelector("input,select,textarea,button");
    if (f) setTimeout(function () { f.focus(); }, 200);
  }
  function closeSheets() {
    ["sheet-ai", "sheet-set", "sheet-search"].forEach(function (id) {
      $(id).classList.remove("open");
      $(id).setAttribute("aria-hidden", "true");
    });
    $("scrim").classList.remove("open");
  }
  window.BTopenSheet = openSheet;
  window.BTcloseSheets = closeSheets;

  /* ============================================================ Bindung */
  function bind() {
    $("seg-normal").onclick = function () { S.tab = "normal"; S.aiReport = null; renderDoc(); };
    $("seg-ref").onclick = function () { S.tab = "ref"; S.aiReport = null; renderDoc(); };
    $("btn-list").onclick = function () { S.showList = !S.showList; renderDoc(); };
    $("reffilter").oninput = function () { S.filter = this.value; S.refIndex = 0; S.aiReport = null; renderDoc(); };

    $("btn-copy").onclick = function () {
      var r = currentReport();
      if (!r) return toast("Kein Befund ausgewählt.", true);
      copy(reportToText(r), "Befund");
    };
    $("btn-print").onclick = function () { window.print(); };

    $("btn-theme").onclick = function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("bt.theme", next); } catch (e) {}
      positionPill();
    };

    $("btn-search").onclick = function () { openSheet("sheet-search"); };
    $("btn-settings").onclick = function () { openSheet("sheet-set"); };
    $("btn-ai").onclick = function () {
      if (!currentReport()) return toast("Zuerst einen Befund auswählen.", true);
      openSheet("sheet-ai");
      if (window.BTaiOpened) window.BTaiOpened();
    };

    $("btn-mobile").onclick = function () {
      var m = $("main");
      m.setAttribute("data-mobile", m.getAttribute("data-mobile") === "nav" ? "doc" : "nav");
      render();
    };

    $("scrim").onclick = closeSheets;
    document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = closeSheets; });

    var sq = $("search-q");
    var timer = null;
    sq.oninput = function () {
      clearTimeout(timer);
      var v = sq.value;
      timer = setTimeout(function () { runSearch(v); }, 220);
    };

    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "Escape") { closeSheets(); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); openSheet("sheet-search"); return; }
      if (e.key >= "1" && e.key <= "9") {
        var body = document.querySelector(".step.is-open .step-body");
        if (body && body._pick) { e.preventDefault(); body._pick(+e.key - 1); }
        return;
      }
      if (e.key === "Backspace") {
        var i = -1;
        for (var k = 3; k >= 0; k--) if (stepValue(k)) { i = k; break; }
        if (i >= 0) { e.preventDefault(); resetFrom(i); manualOpen = i; render(); }
      }
      if (S.tab === "ref") {
        if (e.key === "ArrowRight") { S.refIndex++; S.aiReport = null; renderDoc(); }
        if (e.key === "ArrowLeft" && S.refIndex > 0) { S.refIndex--; S.aiReport = null; renderDoc(); }
      }
    });

    window.addEventListener("resize", function () { if (!$("viewer-head").hidden) positionPill(); });
  }

  /* ================================================================ Start */
  try {
    var th = localStorage.getItem("bt.theme");
    if (th) document.documentElement.setAttribute("data-theme", th);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}

  bind();
  render();
})();
