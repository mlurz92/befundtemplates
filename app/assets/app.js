/* =========================================================================
   Befundatlas - Navigation, Nachladen der Regionspakete, Befundanzeige
   Klassisches Script ohne Modulsystem: läuft auch direkt von der Festplatte.
   ========================================================================= */
(function () {
  "use strict";

  var IDX = window.__BT_INDEX__;
  var SHARDS = {};
  var pending = {};

  /* ------------------------------------------------- Regionspaket laden */
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

  /* --------------------------------------------------------- Hilfsmittel */
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
      setTimeout(function () { t.remove(); }, 340);
    }, 2800);
  }
  window.BTtoast = toast;

  function copy(text, what) {
    var done = function () { toast((what || "Befund") + " kopiert."); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
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
  window.BTcopy = copy;

  /* -------------------------------------------------------------- Zustand */
  var S = {
    mod: null, region: null, thema: null, frage: null,
    tab: "normal", refIndex: 0, aiReport: null, filter: "", showList: true
  };
  var manualOpen = null;

  var STEPS = [
    { key: "mod",    label: "Modalität",     hint: "Untersuchungsverfahren" },
    { key: "region", label: "Region",        hint: "Untersuchungsregion" },
    { key: "thema",  label: "Thema",         hint: "aus den klinischen Angaben" },
    { key: "frage",  label: "Fragestellung", hint: "Auftrag an die Bildgebung" }
  ];

  function openStepIndex() {
    if (manualOpen === -1) return -1;
    if (manualOpen != null) return manualOpen;
    for (var i = 0; i < STEPS.length; i++) if (!S[STEPS[i].key]) return i;
    return STEPS.length - 1;
  }

  function regions() { return S.mod ? IDX.modalitaeten[S.mod] : {}; }
  function regionNode() { return S.region ? regions()[S.region] : null; }
  function themen() { var r = regionNode(); return r ? r.themen : {}; }
  function themaNode() { var t = themen(); return S.thema ? t[S.thema] : null; }
  function fragen() { var t = themaNode(); return t ? t.fragen : {}; }
  function currentIds() { var f = fragen(); return (S.frage && f[S.frage]) || []; }
  function stepValue(i) { return [S.mod, S.region, S.thema, S.frage][i]; }

  /* ================================================================ Krümel */
  function renderCrumbs() {
    var c = $("crumbs");
    c.innerHTML = "";
    var vals = [S.mod, S.region, S.thema, S.frage];
    var any = false;
    STEPS.forEach(function (st, i) {
      if (!vals[i]) return;
      any = true;
      var b = el("button", "crumb");
      b.type = "button";
      b.style.animationDelay = i * 45 + "ms";
      b.innerHTML = '<i>' + (i + 1) + '</i><b></b>';
      b.querySelector("b").textContent = vals[i];
      b.title = st.label + ": " + vals[i] + " — zum Ändern anklicken";
      b.onclick = function () { resetFrom(i); manualOpen = i; render(); };
      c.appendChild(b);
    });
    if (any) {
      var r = el("button", "crumb reset");
      r.type = "button";
      r.title = "Auswahl zurücksetzen";
      r.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      r.onclick = function () { resetFrom(0); manualOpen = 0; render(); };
      c.appendChild(r);
    } else {
      var h = el("span", "crumb-hint", "Die Auswahl beginnt mit der Modalität.");
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
    autoAdvance();
    if (S.frage) {
      S.tab = "normal";
      if (window.matchMedia("(max-width:1080px)").matches)
        $("main").setAttribute("data-mobile", "doc");
    }
    render();
  }

  function autoAdvance() {
    for (var guard = 0; guard < 4; guard++) {
      if (!S.mod) return;
      if (!S.region) { var rk = Object.keys(regions()); if (rk.length === 1) { S.region = rk[0]; continue; } return; }
      if (!S.thema)  { var tk = Object.keys(themen());  if (tk.length === 1) { S.thema  = tk[0]; continue; } return; }
      if (!S.frage)  { var fk = Object.keys(fragen());  if (fk.length === 1) { S.frage  = fk[0]; continue; } return; }
      return;
    }
  }

  /* ================================================================ Stufen */
  var MOD_ICON = {
    CT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/></svg>',
    MRT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M8.5 6v12M15.5 6v12"/><circle cx="12" cy="12" r="1.8"/></svg>'
  };

  function renderSteps() {
    var host = $("steps");
    host.innerHTML = "";
    var open = openStepIndex();

    STEPS.forEach(function (st, i) {
      var enabled = i === 0 || !!stepValue(i - 1);
      var isOpen = i === open && enabled;
      var wrap = el("div", "step" + (isOpen ? (i === 0 ? " is-open" : " is-open grow") : "") +
                             (stepValue(i) ? " is-done" : ""));
      if (!enabled) wrap.setAttribute("aria-disabled", "true");

      var head = el("button", "step-head");
      head.type = "button";
      head.setAttribute("aria-expanded", String(isOpen));
      head.innerHTML =
        '<span class="step-num">' +
          (stepValue(i)
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
            : (i + 1)) + '</span>' +
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
      if (isOpen) buildStepBody(i, body);
      wrap.appendChild(body);
      host.appendChild(wrap);
    });
  }

  function buildStepBody(i, body) {
    if (i === 0) {
      var grid = el("div", "mod-grid");
      ["CT", "MRT"].forEach(function (m, n) {
        if (!IDX.modalitaeten[m]) return;
        var regs = IDX.modalitaeten[m], count = 0, rn = 0;
        for (var k in regs) { count += regs[k].n; rn++; }
        var b = el("button", "mod-card");
        b.type = "button";
        b.setAttribute("aria-selected", String(S.mod === m));
        b.style.animationDelay = n * 70 + "ms";
        b.innerHTML =
          '<span class="mod-ico">' + MOD_ICON[m] + '</span>' +
          '<span class="mod-name">' + m + '</span>' +
          '<span class="mod-note">' + rn + " Regionen · " + count.toLocaleString("de-DE") + " Befunde</span>" +
          '<span class="mod-glow"></span>';
        b.onclick = function () { choose(0, m); };
        grid.appendChild(b);
      });
      body.appendChild(grid);
      body._pick = function (n) { var b = grid.querySelectorAll(".mod-card")[n]; if (b) b.click(); };
      return;
    }

    var items = [];
    if (i === 1) {
      var regs = regions();
      Object.keys(regs).forEach(function (r) {
        items.push({ value: r, note: regs[r].gruppe, count: regs[r].n, group: regs[r].gruppe });
      });
      items.sort(function (a, b) { return a.group.localeCompare(b.group, "de") || b.count - a.count; });
    } else if (i === 2) {
      var th = themen();
      Object.keys(th).forEach(function (t) { items.push({ value: t, count: th[t].n }); });
      items.sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value, "de"); });
    } else {
      var fr = fragen();
      Object.keys(fr).forEach(function (f) { items.push({ value: f, count: fr[f].length }); });
      items.sort(function (a, b) { return b.count - a.count || a.value.localeCompare(b.value, "de"); });
    }

    var q = "";
    var listWrap = el("div", "opts scroll");
    var maxCount = items.reduce(function (m, x) { return Math.max(m, x.count); }, 1);

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
        b.style.animationDelay = Math.min(n, 16) * 20 + "ms";
        b.innerHTML =
          '<span class="opt-key">' + (n < 9 && !qq ? String(n + 1) : "·") + '</span>' +
          '<span class="opt-main"><span class="opt-title"></span>' +
            (it.note ? '<span class="opt-note"></span>' : "") +
            '<span class="opt-meter"><i style="transform:scaleX(' +
              Math.max(0.04, it.count / maxCount).toFixed(3) + ')"></i></span>' +
          '</span>' +
          '<span class="opt-count">' + it.count.toLocaleString("de-DE") + '</span>';
        b.querySelector(".opt-title").textContent = it.value;
        if (it.note) b.querySelector(".opt-note").textContent = it.note;
        b.onclick = function () { choose(i, it.value); };
        listWrap.appendChild(b);
      });
    }

    if (items.length > 9) {
      var f = el("div", "filter");
      f.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Filtern …">';
      var inp = f.querySelector("input");
      inp.setAttribute("aria-label", STEPS[i].label + " filtern");
      inp.oninput = function () { q = inp.value; paint(); };
      body.appendChild(f);
      setTimeout(function () { if (window.innerWidth > 1080) inp.focus(); }, 140);
    }
    body.appendChild(listWrap);
    paint();
    body._pick = function (n) { var b = listWrap.querySelectorAll(".opt")[n]; if (b) b.click(); };
  }

  /* ============================================================ Befunddoc */
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
    if (!q || q.trim().length < 2) return t;
    try {
      var rx = new RegExp("(" + q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      return t.replace(rx, '<mark class="hit">$1</mark>');
    } catch (e) { return t; }
  }
  function markPlaceholders(html) {
    return html.replace(/\[Datum\]/g, '<span class="ph" title="Vor Verwendung ersetzen">[Datum]</span>');
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
    return {
      report: currentReport(),
      path: { mod: S.mod, region: S.region, thema: S.thema, frage: S.frage },
      isNormal: S.tab === "normal" && !S.aiReport
    };
  };
  window.BTdata = {
    index: IDX,
    shard: function (slug) { return SHARDS[slug]; },
    load: loadShard,
    slugOf: function (mod, region) {
      var m = IDX.modalitaeten[mod];
      return m && m[region] ? m[region].slug : null;
    }
  };
  window.BTapplyAI = function (rep) {
    S.aiReport = rep;
    renderDoc();
    toast("KI-Fassung übernommen.");
  };

  function field(dt, dd, cls, q) {
    var d = el("dl", "field " + (cls || ""));
    var a = el("dt");
    a.appendChild(el("span", null, dt));
    var b = el("dd");
    b.innerHTML = markPlaceholders(highlight(dd, q));
    if ((cls || "").indexOf("block") >= 0) {
      var cb = el("button", "copy-mini");
      cb.type = "button";
      cb.title = dt + " kopieren";
      cb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg><span>kopieren</span>';
      cb.onclick = function (e) { e.stopPropagation(); copy(dd, dt); flash(cb); };
      a.appendChild(cb);
    }
    d.appendChild(a); d.appendChild(b);
    return d;
  }
  function flash(btn) {
    btn.classList.add("done");
    setTimeout(function () { btn.classList.remove("done"); }, 1300);
  }

  function renderDoc() {
    var wrap = $("doc-wrap"), head = $("viewer-head");

    if (!S.frage) {
      head.hidden = true;
      if (!wrap.querySelector("#placeholder")) wrap.innerHTML = PLACEHOLDER_HTML;
      buildPlaceholder();
      return;
    }
    head.hidden = false;

    var r = regionNode();
    if (!SHARDS[r.slug]) {
      wrap.innerHTML = skeleton();
      loadShard(r.slug, function () { render(); });
      return;
    }

    var list = refReports();
    $("ref-count").textContent = list.length.toLocaleString("de-DE");
    $("btn-list").hidden = S.tab !== "ref";
    $("btn-list").setAttribute("aria-pressed", String(S.showList));
    positionPill();

    var body = $("viewer-body");
    body.classList.toggle("with-list", S.tab === "ref" && S.showList);
    $("reflist").hidden = !(S.tab === "ref" && S.showList);
    if (S.tab === "ref" && S.showList) renderRefList(list);

    var rep = currentReport();
    wrap.innerHTML = "";
    if (!rep) {
      wrap.innerHTML = '<div class="placeholder"><div class="placeholder-inner">' +
        '<h3>Kein Treffer</h3><p>Für diesen Filter liegt in der aktuellen Auswahl kein Referenzbefund vor.</p></div></div>';
      return;
    }

    var isNormal = !S.aiReport && S.tab === "normal";
    var doc = el("article", "doc");
    doc.style.animation = "docIn var(--dur-3) var(--spring) both";

    var top = el("div", "doc-top");
    var title = el("div", "doc-title");
    title.appendChild(el("div", "doc-kicker", S.mod + " · " + S.region));
    var h = el("h2"); h.textContent = rep.titel || (S.mod + " " + S.region); title.appendChild(h);
    var badges = el("div", "doc-badges");
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
    var nw = (rep.befund || "").split(/\s+/).filter(Boolean).length;
    foot.appendChild(el("span", null, nw + " Wörter im Befund"));
    if (rep.studie) foot.appendChild(el("span", null, "Studienbeschreibung: " + rep.studie));
    if (isNormal) foot.appendChild(el("span", null, "Komponierter Normalbefund · [Datum] vor Verwendung ersetzen"));
    doc.appendChild(foot);
    wrap.appendChild(doc);

    if (S.tab === "ref" && list.length > 1) {
      var nav = el("div", "docnav");
      var prev = el("button", "icon-btn");
      prev.type = "button"; prev.disabled = S.refIndex <= 0;
      prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg><span class="btn-label">Vorheriger</span>';
      prev.onclick = function () { S.refIndex--; S.aiReport = null; renderDoc(); };
      var pos = el("span", "docnav-pos", (S.refIndex + 1) + " / " + list.length);
      var next = el("button", "icon-btn");
      next.type = "button"; next.disabled = S.refIndex >= list.length - 1;
      next.innerHTML = '<span class="btn-label">Nächster</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>';
      next.onclick = function () { S.refIndex++; S.aiReport = null; renderDoc(); };
      nav.appendChild(prev); nav.appendChild(pos); nav.appendChild(next);
      wrap.appendChild(nav);
    }
  }

  function skeleton() {
    var lines = "";
    [92, 78, 86, 64, 88, 70].forEach(function (w, i) {
      lines += '<div class="sk-line" style="width:' + w + '%;animation-delay:' + i * 70 + 'ms"></div>';
    });
    return '<div class="doc sk"><div class="sk-line sk-title" style="width:46%"></div>' +
           '<div class="sk-chips"><i></i><i></i><i></i></div>' + lines + "</div>";
  }

  function renderRefList(list) {
    var host = $("reflist-items");
    host.innerHTML = "";
    list.forEach(function (rep, n) {
      var b = el("button", "refitem");
      b.type = "button";
      b.setAttribute("aria-selected", String(n === S.refIndex && !S.aiReport));
      b.style.animationDelay = Math.min(n, 18) * 14 + "ms";
      b.innerHTML = '<span class="no"></span><span class="tx"><span class="t1"></span><span class="t2"></span></span>';
      b.querySelector(".no").textContent = n + 1;
      b.querySelector(".t1").textContent = rep.klinik || rep.titel || "Ohne klinische Angabe";
      b.querySelector(".t2").textContent = rep.frage || (rep.befund || "").slice(0, 60);
      b.onclick = function () { S.refIndex = n; S.aiReport = null; renderDoc(); };
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
     [m.regionen, "Regionen"], [m.pfade, "Auswahlpfade"]]
      .forEach(function (p, i) {
        var s = el("div", "stat");
        s.style.animationDelay = 120 + i * 80 + "ms";
        var b = el("b", null, "0"), t = el("span", null, p[1]);
        s.appendChild(b); s.appendChild(t); host.appendChild(s);
        countTo(b, p[0], 1000 + i * 130);
      });
  }
  function countTo(node, target, ms) {
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
    if (window.matchMedia("(max-width:1080px)").matches) {
      var lab = $("btn-mobile").querySelector(".btn-label");
      lab.textContent = $("main").getAttribute("data-mobile") === "nav" ? "Befund" : "Auswahl";
    }
  }

  /* =============================================== Befehls- und Suchpalette */
  var palItems = [], palIndex = 0, palTimer = null, palSeq = 0;

  function openPalette(prefill) {
    $("palette").classList.add("open");
    $("palette").setAttribute("aria-hidden", "false");
    var q = $("palette-q");
    q.value = prefill || "";
    setTimeout(function () { q.focus(); q.select(); }, 60);
    paintPalette(q.value);
  }
  function closePalette() {
    $("palette").classList.remove("open");
    $("palette").setAttribute("aria-hidden", "true");
  }

  function commands() {
    return [
      { kind: "Befehl", label: "KI-Anpassung öffnen", hint: "aktuellen Befund verändern",
        run: function () { $("btn-ai").click(); } },
      { kind: "Befehl", label: "Einstellungen öffnen", hint: "API-Key, Modell, Ablauf",
        run: function () { openSheet("sheet-set"); } },
      { kind: "Befehl", label: "Hell und dunkel umschalten", hint: "Farbschema",
        run: function () { $("btn-theme").click(); } },
      { kind: "Befehl", label: "Befund kopieren", hint: "vollständiger Text",
        run: function () { $("btn-copy").click(); } },
      { kind: "Befehl", label: "Drucken", hint: "oder als PDF sichern",
        run: function () { window.print(); } },
      { kind: "Befehl", label: "Auswahl zurücksetzen", hint: "von vorn beginnen",
        run: function () { resetFrom(0); manualOpen = 0; render(); } }
    ];
  }

  function navTargets() {
    var out = [];
    Object.keys(IDX.modalitaeten).forEach(function (m) {
      var regs = IDX.modalitaeten[m];
      Object.keys(regs).forEach(function (r) {
        out.push({ kind: m, label: r, hint: regs[r].gruppe + " · " + regs[r].n.toLocaleString("de-DE") + " Befunde",
                   run: function () { S.mod = m; S.region = r; S.thema = null; S.frage = null;
                                      manualOpen = null; autoAdvance(); render();
                                      $("main").setAttribute("data-mobile", "nav"); } });
        Object.keys(regs[r].themen).forEach(function (t) {
          out.push({ kind: m + " · " + r, label: t, hint: regs[r].themen[t].n.toLocaleString("de-DE") + " Befunde",
                     run: function () { S.mod = m; S.region = r; S.thema = t; S.frage = null;
                                        manualOpen = null; autoAdvance(); render();
                                        $("main").setAttribute("data-mobile",
                                          S.frage ? "doc" : "nav"); } });
        });
      });
    });
    return out;
  }
  var NAV = null;

  function paintPalette(q) {
    var out = $("palette-out");
    q = (q || "").trim();
    var qq = fold(q);
    if (!NAV) NAV = navTargets();

    palItems = [];
    if (!q) {
      palItems = commands().concat(NAV.slice(0, 0));
      $("palette-mode").textContent = "Sprungziele und Befehle · ab 3 Zeichen zusätzlich Volltext";
    } else {
      commands().forEach(function (c) { if (fold(c.label).indexOf(qq) >= 0) palItems.push(c); });
      NAV.forEach(function (n) {
        if (palItems.length > 40) return;
        if (fold(n.label).indexOf(qq) >= 0 || fold(n.kind).indexOf(qq) >= 0) palItems.push(n);
      });
    }
    palIndex = 0;
    drawPalette();
    if (q.length >= 3) fullText(q);
  }

  function drawPalette() {
    var out = $("palette-out");
    out.innerHTML = "";
    if (!palItems.length) {
      out.innerHTML = '<div class="empty-hint">Keine Treffer.</div>';
      return;
    }
    var lastKind = null;
    palItems.forEach(function (it, i) {
      if (it.kind !== lastKind) {
        lastKind = it.kind;
        out.appendChild(el("div", "pal-group", it.kind));
      }
      var b = el("button", "pal-item");
      b.type = "button";
      b.setAttribute("aria-selected", String(i === palIndex));
      b.innerHTML = '<span class="pal-l"></span><span class="pal-h"></span>' +
        (it.snippet ? '<span class="pal-s">' + it.snippet + "</span>" : "");
      b.querySelector(".pal-l").textContent = it.label;
      b.querySelector(".pal-h").textContent = it.hint || "";
      b.onclick = function () { closePalette(); it.run(); };
      b.onmouseenter = function () { palIndex = i; markPalette(); };
      out.appendChild(b);
    });
    markPalette();
  }
  function markPalette() {
    var nodes = $("palette-out").querySelectorAll(".pal-item");
    nodes.forEach(function (n, i) {
      n.setAttribute("aria-selected", String(i === palIndex));
      if (i === palIndex) n.scrollIntoView({ block: "nearest" });
    });
  }

  function fullText(q) {
    var seq = ++palSeq;
    clearTimeout(palTimer);
    palTimer = setTimeout(function () {
      $("palette-mode").innerHTML = '<span class="dotpulse"></span> Volltext wird durchsucht …';
      var slugs = [], meta = {};
      Object.keys(IDX.modalitaeten).forEach(function (m) {
        var regs = IDX.modalitaeten[m];
        Object.keys(regs).forEach(function (r) {
          slugs.push(regs[r].slug);
          meta[regs[r].slug] = { mod: m, region: r };
        });
      });
      var loaded = 0, needle = fold(q), hits = [];
      slugs.forEach(function (sl) {
        loadShard(sl, function (sh) {
          if (seq !== palSeq) return;
          if (hits.length < 30) {
            var ids = Object.keys(sh.reports);
            for (var i = 0; i < ids.length && hits.length < 30; i++) {
              var rep = sh.reports[ids[i]];
              var hay = fold(rep.befund + " " + rep.beurteilung + " " + rep.klinik + " " + rep.frage);
              var p = hay.indexOf(needle);
              if (p >= 0) hits.push({ slug: sl, id: ids[i], rep: rep, meta: meta[sl] });
            }
          }
          if (++loaded === slugs.length && seq === palSeq) merge(hits);
        });
      });

      function merge(hits) {
        $("palette-mode").textContent = hits.length
          ? hits.length + (hits.length >= 30 ? "+" : "") + " Volltextfundstellen"
          : "keine Volltextfundstelle";
        hits.forEach(function (h) {
          var src = h.rep.befund + " " + h.rep.beurteilung;
          var raw = fold(src).indexOf(needle);
          var snip = src.slice(Math.max(0, raw - 60), raw + 110);
          palItems.push({
            kind: "Volltext",
            label: h.rep.klinik || h.rep.titel || "Befund",
            hint: h.meta.mod + " · " + h.meta.region,
            snippet: "…" + highlight(snip, q) + "…",
            run: function () { jumpTo(h); }
          });
        });
        drawPalette();
      }
    }, 220);
  }

  function jumpTo(h) {
    var regs = IDX.modalitaeten[h.meta.mod][h.meta.region];
    var found = null;
    Object.keys(regs.themen).some(function (t) {
      return Object.keys(regs.themen[t].fragen).some(function (f) {
        var i = regs.themen[t].fragen[f].indexOf(h.id);
        if (i >= 0) { found = { t: t, f: f, i: i }; return true; }
        return false;
      });
    });
    if (!found) return toast("Zuordnung nicht gefunden.", true);
    S.mod = h.meta.mod; S.region = h.meta.region; S.thema = found.t; S.frage = found.f;
    S.tab = "ref"; S.refIndex = found.i; S.filter = ""; S.aiReport = null;
    manualOpen = null;
    $("main").setAttribute("data-mobile", "doc");
    render();
  }

  /* ============================================================ Seitenpanel */
  function openSheet(id) {
    closeSheets();
    var s = $(id);
    s.classList.add("open");
    s.setAttribute("aria-hidden", "false");
    $("scrim").classList.add("open");
    var f = s.querySelector("textarea,input,button:not([data-close])");
    if (f) setTimeout(function () { f.focus(); }, 220);
  }
  function closeSheets() {
    ["sheet-ai", "sheet-set"].forEach(function (id) {
      $(id).classList.remove("open");
      $(id).setAttribute("aria-hidden", "true");
    });
    $("scrim").classList.remove("open");
  }
  window.BTopenSheet = openSheet;
  window.BTcloseSheets = closeSheets;

  /* ================================================================ Bindung */
  function bind() {
    $("seg-normal").onclick = function () { S.tab = "normal"; S.aiReport = null; renderDoc(); };
    $("seg-ref").onclick = function () { S.tab = "ref"; S.aiReport = null; renderDoc(); };
    $("btn-list").onclick = function () { S.showList = !S.showList; renderDoc(); };
    $("reffilter").oninput = function () { S.filter = this.value; S.refIndex = 0; S.aiReport = null; renderDoc(); };

    $("btn-copy").onclick = function () {
      var r = currentReport();
      if (!r) return toast("Kein Befund ausgewählt.", true);
      copy(reportToText(r), "Befund");
      flash($("btn-copy"));
    };
    $("btn-print").onclick = function () { window.print(); };

    $("btn-theme").onclick = function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "dark" ? "#0C0E12" : "#E3000B");
      try { localStorage.setItem("bt.theme", next); } catch (e) {}
      positionPill();
    };

    $("btn-palette").onclick = function () { openPalette(); };
    $("btn-settings").onclick = function () { openSheet("sheet-set"); };
    $("btn-ai").onclick = function () {
      if (!currentReport()) return toast("Zuerst einen Befund auswählen.", true);
      openSheet("sheet-ai");
      if (window.BTaiOpened) window.BTaiOpened();
    };
    $("brand").onclick = function (e) {
      e.preventDefault();
      resetFrom(0); manualOpen = 0;
      $("main").setAttribute("data-mobile", "nav");
      render();
    };
    $("btn-mobile").onclick = function () {
      var m = $("main");
      m.setAttribute("data-mobile", m.getAttribute("data-mobile") === "nav" ? "doc" : "nav");
      render();
    };

    $("scrim").onclick = closeSheets;
    document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = closeSheets; });
    $("palette").onclick = function (e) { if (e.target === $("palette")) closePalette(); };

    var pq = $("palette-q");
    var t = null;
    pq.oninput = function () {
      clearTimeout(t);
      var v = pq.value;
      t = setTimeout(function () { paintPalette(v); }, 90);
    };
    pq.onkeydown = function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); palIndex = Math.min(palIndex + 1, palItems.length - 1); markPalette(); }
      if (e.key === "ArrowUp") { e.preventDefault(); palIndex = Math.max(palIndex - 1, 0); markPalette(); }
      if (e.key === "Enter") {
        e.preventDefault();
        var it = palItems[palIndex];
        if (it) { closePalette(); it.run(); }
      }
    };

    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        $("palette").classList.contains("open") ? closePalette() : openPalette();
        return;
      }
      if (e.key === "Escape") {
        if ($("palette").classList.contains("open")) closePalette();
        else closeSheets();
        return;
      }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); openPalette(); return; }
      if (e.key >= "1" && e.key <= "9") {
        var body = document.querySelector(".step.is-open .step-body");
        if (body && body._pick) { e.preventDefault(); body._pick(+e.key - 1); }
        return;
      }
      if (e.key === "Backspace") {
        for (var k = 3; k >= 0; k--) if (stepValue(k)) {
          e.preventDefault(); resetFrom(k); manualOpen = k; render(); return;
        }
      }
      if (S.tab === "ref" && !S.aiReport) {
        if (e.key === "ArrowRight") { S.refIndex++; renderDoc(); }
        if (e.key === "ArrowLeft" && S.refIndex > 0) { S.refIndex--; renderDoc(); }
      }
    });

    window.addEventListener("resize", function () { if (!$("viewer-head").hidden) positionPill(); });

    // Zeigergesteuerter Glanz auf Glasflächen
    document.addEventListener("pointermove", function (e) {
      var t = e.target.closest ? e.target.closest(".mod-card,.mcard,.stat,.icon-btn.primary") : null;
      if (!t) return;
      var r = t.getBoundingClientRect();
      t.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      t.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });

    // Aufruf über die WebApp-Verknüpfungen
    if (location.hash === "#ki") setTimeout(function () { $("btn-ai").click(); }, 300);
    if (location.hash === "#suche") setTimeout(function () { openPalette(); }, 300);
  }

  /* ================================================================== Start */
  try {
    var th = localStorage.getItem("bt.theme");
    if (th) document.documentElement.setAttribute("data-theme", th);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}

  bind();
  render();
})();
