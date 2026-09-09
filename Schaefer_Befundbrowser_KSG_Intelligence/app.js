(function () {
  'use strict';

  const data = window.SCHAEFER_DATA || { meta: {}, reports: [], reference_normals: [] };
  const Core = window.SchaeferCore;
  if (!Core) throw new Error('SchaeferCore fehlt.');
  const reports = data.reports || [];
  const referenceNormals = data.reference_normals || [];

  const state = {
    modality: '', region: '', theme: '', question: '', reportIndex: 0,
    themeQuery: '', questionQuery: '', aiDraft: null,
  };

  const byId = (id) => document.getElementById(id);
  const els = {
    modalityOptions: byId('modality-options'), regionOptions: byId('region-options'),
    themeOptions: byId('theme-options'), questionOptions: byId('question-options'),
    themeSearch: byId('theme-search'), questionSearch: byId('question-search'), resetAll: byId('reset-all'),
    modalitySelection: byId('modality-selection'), regionSelection: byId('region-selection'),
    themeSelection: byId('theme-selection'), questionSelection: byId('question-selection'),
    progressRail: byId('progress-rail'), empty: byId('viewer-empty'), viewer: byId('report-viewer'),
    breadcrumb: byId('report-breadcrumb'), typeBadge: byId('report-type-badge'), title: byId('report-title'),
    meta: byId('report-meta'), clinicalStrip: byId('clinical-strip'), clinical: byId('report-clinical'),
    questionRaw: byId('report-question'), findings: byId('report-findings'), impression: byId('report-impression'),
    methodDetails: byId('method-details'), method: byId('report-method'), study: byId('report-study'),
    parser: byId('report-parser'), sourceRow: byId('report-source-row'), rankLabel: byId('rank-label'),
    rankScore: byId('rank-score'), position: byId('report-position'), prev: byId('prev-report'), next: byId('next-report'),
    copyFindings: byId('copy-findings'), copyImpression: byId('copy-impression'), copyReport: byId('copy-report'),
    provenance: byId('reference-provenance'), referenceEvidence: byId('reference-evidence'),
    referenceNegative: byId('reference-negative-evidence'), referencePhrases: byId('reference-phrase-count'),
    statTotal: byId('stat-total'), statGroups: byId('stat-groups'), statReferences: byId('stat-references'),
    status: byId('app-status'), toast: byId('toast'),
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function renderOptions(container, options, selected, handler, emptyMessage) {
    if (!options.length) {
      container.innerHTML = `<p class="option-empty">${escapeHtml(emptyMessage)}</p>`;
      return;
    }
    container.innerHTML = options.map((option, index) => (
      `<button type="button" class="option-button${option.value === selected ? ' is-selected' : ''}" data-value="${escapeHtml(option.value)}" style="--stagger:${Math.min(index, 14) * 18}ms">`
      + `<span class="option-label">${escapeHtml(option.value)}</span>`
      + `<span class="option-count">${Core.formatCount(option.count)}</span></button>`
    )).join('');
    for (const button of container.querySelectorAll('.option-button')) {
      button.addEventListener('click', () => handler(button.dataset.value));
    }
  }

  function renderModality() {
    const counts = Object.fromEntries((['CT', 'MRT']).map((m) => [m, reports.filter((r) => r.modality === m).length]));
    els.modalityOptions.innerHTML = ['CT', 'MRT'].map((modality) => (
      `<button type="button" class="modality-button${state.modality === modality ? ' is-selected' : ''}" data-value="${modality}">`
      + `<strong>${modality}</strong><span>${Core.formatCount(counts[modality])} Originalbefunde</span></button>`
    )).join('');
    for (const button of els.modalityOptions.querySelectorAll('button')) button.addEventListener('click', () => selectModality(button.dataset.value));
    els.modalitySelection.textContent = state.modality || 'CT oder MRT wählen';
  }

  function renderRegions() {
    const options = Core.getRegions(reports, state.modality);
    renderOptions(els.regionOptions, options, state.region, selectRegion, state.modality ? 'Keine Region vorhanden.' : 'Nach Wahl der Modalität verfügbar.');
    els.regionSelection.textContent = state.region || (state.modality ? `${Core.formatCount(options.length)} Regionen verfügbar` : 'zuerst Modalität wählen');
  }

  function renderThemes() {
    const base = Core.getThemes(reports, state.modality, state.region);
    const options = Core.searchOptions(base, state.themeQuery);
    els.themeSearch.disabled = !state.region;
    renderOptions(els.themeOptions, options, state.theme, selectTheme, state.region ? 'Kein passendes Thema.' : 'Nach Wahl der Region verfügbar.');
    els.themeSelection.textContent = state.theme || (state.region ? `${Core.formatCount(base.length)} Themen verfügbar` : 'zuerst Region wählen');
  }

  function renderQuestions() {
    const base = Core.getQuestions(reports, state.modality, state.region, state.theme);
    const options = Core.searchOptions(base, state.questionQuery);
    els.questionSearch.disabled = !state.theme;
    renderOptions(els.questionOptions, options, state.question, selectQuestion, state.theme ? 'Keine passende Fragestellung.' : 'Nach Wahl des Themas verfügbar.');
    els.questionSelection.textContent = state.question || (state.theme ? `${Core.formatCount(base.length)} Fragestellungen verfügbar` : 'zuerst Thema wählen');
  }

  function setStepStates() {
    const values = [state.modality, state.region, state.theme, state.question];
    let completed = 0;
    document.querySelectorAll('.step').forEach((step, idx) => {
      const isComplete = Boolean(values[idx]);
      const isOpen = !isComplete && values.slice(0, idx).every(Boolean);
      step.classList.toggle('is-complete', isComplete);
      step.classList.toggle('is-open', isOpen);
      if (isComplete) completed += 1;
    });
    const progress = completed === 0 ? 0 : Math.round((completed / 4) * 100);
    document.documentElement.style.setProperty('--progress', `${progress}%`);
    document.documentElement.style.setProperty('--progress-number', progress ? '1' : '0');
  }

  function originalReports() { return Core.filterReports(reports, state); }
  function resultSequence() { return Core.composeResultSequence(reports, referenceNormals, state); }

  function tagMarkup(report) {
    if (report.is_reference) {
      const values = [`Evidenz ${report.evidence_level}`, report.question_family, `${Core.formatCount(report.evidence_count)} Corpusfälle`];
      return values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('');
    }
    const items = [];
    if (report.tags?.laterality) items.push(report.tags.laterality);
    for (const status of (report.tags?.disease_status || [])) items.push(status);
    if (report.tags?.question_family) items.push(report.tags.question_family);
    if (report.duplicate_of) items.push('Dublette');
    items.push(`Quelle ${report.id}`);
    return items.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('');
  }

  function humanParser(value) {
    return ({ explicit:'strukturiertes Schema', legacy_markers:'älteres Markerschema', heuristic:'Altformat · heuristisch getrennt' })[value] || value || '–';
  }

  function restartViewerAnimation() {
    els.viewer.classList.remove('is-entering');
    void els.viewer.offsetWidth;
    els.viewer.classList.add('is-entering');
  }

  function renderReference(report, originals) {
    els.viewer.classList.add('is-reference');
    els.typeBadge.textContent = '★ REFERENZ';
    els.typeBadge.classList.add('is-reference');
    els.title.textContent = 'Schäfer-Stil · Standard-Normalbefund';
    els.meta.innerHTML = tagMarkup(report);
    els.provenance.hidden = false;
    els.clinicalStrip.hidden = true;
    els.methodDetails.hidden = true;
    els.referenceEvidence.textContent = `${Core.formatCount(report.evidence_count)} Fälle · ${report.evidence_level}`;
    els.referenceNegative.textContent = Core.formatCount(report.negative_evidence_count);
    els.referencePhrases.textContent = Core.formatCount(report.source_phrase_count);
    els.findings.textContent = report.findings;
    els.impression.textContent = report.impression;
    els.impression.classList.remove('missing-impression');
    els.copyImpression.disabled = false;
    els.rankLabel.textContent = 'Referenztyp';
    els.rankScore.textContent = 'NORMAL';
    els.position.textContent = `Referenz · danach ${Core.formatCount(originals.length)} Originale`;
  }

  function renderOriginal(report, originalIndex, originals) {
    els.viewer.classList.remove('is-reference');
    els.typeBadge.textContent = 'ORIGINAL';
    els.typeBadge.classList.remove('is-reference');
    els.title.textContent = report.title || `${report.modality} · ${report.region}`;
    els.meta.innerHTML = tagMarkup(report);
    els.provenance.hidden = true;
    els.clinicalStrip.hidden = false;
    els.methodDetails.hidden = false;
    els.clinical.textContent = report.clinical || 'Keine sicher separierbaren klinischen Angaben im Original.';
    els.questionRaw.textContent = report.question_raw || 'Keine separate Fragestellung im Original.';
    els.findings.textContent = report.findings || report.raw || 'Kein sicher separierbarer Befundtext.';
    const hasImpression = Boolean(report.impression);
    els.impression.textContent = hasImpression ? report.impression : 'Keine separate Beurteilung im Originalbefund.';
    els.impression.classList.toggle('missing-impression', !hasImpression);
    els.copyImpression.disabled = !hasImpression;
    els.method.textContent = report.method || 'Keine separate Methodik im Original.';
    els.study.textContent = report.study_description || '–';
    els.parser.textContent = humanParser(report.parse_quality);
    els.sourceRow.textContent = String(report.source_row);
    els.rankLabel.textContent = 'Repräsentativität';
    els.rankScore.textContent = `${report.rank_in_group} / ${report.group_size}`;
    els.position.textContent = `Original ${Core.formatCount(originalIndex)} / ${Core.formatCount(originals.length)}`;
  }

  function reportSourceKey(report) {
    if (!report) return '';
    return report.is_reference ? `reference:${report.modality}|${report.region}|${report.question}` : `original:${report.id}`;
  }

  function activeDraftFor(report) {
    return state.aiDraft && state.aiDraft.sourceKey === reportSourceKey(report) ? state.aiDraft : null;
  }

  function applyActiveDraft(report) {
    const draft = activeDraftFor(report);
    els.viewer.classList.toggle('is-ai-draft', Boolean(draft));
    if (!draft) return;
    els.findings.textContent = draft.findings;
    els.impression.textContent = draft.impression || 'Keine separate Beurteilung.';
    els.impression.classList.toggle('missing-impression', !draft.impression);
    els.copyImpression.disabled = !draft.impression;
    els.typeBadge.textContent = '✦ KI-ENTWURF';
    els.typeBadge.classList.add('is-reference');
    els.meta.insertAdjacentHTML('beforeend', `<span class="tag">${escapeHtml(draft.modelId || 'KI')}</span><span class="tag">${escapeHtml(draft.versionLabel || 'AI')}</span>`);
  }

  function renderReport() {
    const sequence = resultSequence();
    const originals = originalReports();
    if (!sequence.length) {
      els.empty.hidden = false;
      els.viewer.hidden = true;
      return;
    }
    state.reportIndex = Math.max(0, Math.min(state.reportIndex, sequence.length - 1));
    const report = sequence[state.reportIndex];
    els.empty.hidden = true;
    els.viewer.hidden = false;
    els.breadcrumb.innerHTML = [state.modality, state.region, state.theme, state.question].map((value) => `<span class="crumb">${escapeHtml(value)}</span>`).join('');

    if (report.is_reference) renderReference(report, originals);
    else renderOriginal(report, state.reportIndex, originals);
    applyActiveDraft(report);

    els.prev.disabled = state.reportIndex <= 0;
    els.next.disabled = state.reportIndex >= sequence.length - 1;
    restartViewerAnimation();
  }

  function renderAll() {
    renderModality(); renderRegions(); renderThemes(); renderQuestions(); setStepStates(); renderReport();
  }

  function clearDownstream(from) {
    state.aiDraft = null;
    if (from <= 1) state.region = '';
    if (from <= 2) state.theme = '';
    if (from <= 3) state.question = '';
    state.reportIndex = 0;
  }
  function selectModality(value) { state.modality=value;clearDownstream(1);state.themeQuery='';state.questionQuery='';els.themeSearch.value='';els.questionSearch.value='';renderAll(); }
  function selectRegion(value) { state.region=value;clearDownstream(2);state.themeQuery='';state.questionQuery='';els.themeSearch.value='';els.questionSearch.value='';renderAll(); }
  function selectTheme(value) { state.theme=value;clearDownstream(3);state.questionQuery='';els.questionSearch.value='';renderAll(); }
  function selectQuestion(value) {
    state.aiDraft=null;state.question=value;state.reportIndex=0;renderAll();
    if (window.matchMedia('(max-width: 900px)').matches) els.viewer.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function resetAll() { Object.assign(state,{modality:'',region:'',theme:'',question:'',reportIndex:0,themeQuery:'',questionQuery:'',aiDraft:null});els.themeSearch.value='';els.questionSearch.value='';renderAll(); }

  function currentItem() { return resultSequence()[state.reportIndex] || null; }
  function currentPayload() {
    const item=currentItem(); if(!item) return null; const draft=activeDraftFor(item);
    return draft ? {...item, findings:draft.findings, impression:draft.impression, ai_draft:true} : item;
  }
  function combinedReportText(item) {
    if (item.is_reference) return `Befund:\n${item.findings}\n\nBeurteilung:\n${item.impression}`;
    const chunks=[];
    if(item.clinical) chunks.push(`Klinische Angaben:\n${item.clinical}`);
    if(item.question_raw) chunks.push(`Fragestellung:\n${item.question_raw}`);
    chunks.push(`Befund:\n${item.findings || item.raw || ''}`);
    if(item.impression) chunks.push(`Beurteilung:\n${item.impression}`);
    return chunks.join('\n\n');
  }

  async function copyText(text,label) {
    if(!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
    }
    showToast(`${label} kopiert`);
  }
  let toastTimer=0;
  function showToast(message) { window.clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.remove('is-visible');void els.toast.offsetWidth;els.toast.classList.add('is-visible');toastTimer=window.setTimeout(()=>els.toast.classList.remove('is-visible'),1500); }

  els.themeSearch.addEventListener('input',(event)=>{state.themeQuery=event.target.value;renderThemes();});
  els.questionSearch.addEventListener('input',(event)=>{state.questionQuery=event.target.value;renderQuestions();});
  els.resetAll.addEventListener('click',resetAll);
  els.prev.addEventListener('click',()=>{if(state.reportIndex>0){state.aiDraft=null;state.reportIndex-=1;renderReport();}});
  els.next.addEventListener('click',()=>{const max=resultSequence().length-1;if(state.reportIndex<max){state.aiDraft=null;state.reportIndex+=1;renderReport();}});
  els.copyFindings.addEventListener('click',()=>{const r=currentPayload();if(r)copyText(r.findings||r.raw,'Befund');});
  els.copyImpression.addEventListener('click',()=>{const r=currentPayload();if(r?.impression)copyText(r.impression,'Beurteilung');});
  els.copyReport.addEventListener('click',()=>{const r=currentPayload();if(r)copyText(combinedReportText(r),'Gesamtbefund');});
  document.addEventListener('keydown',(event)=>{const active=document.activeElement?.tagName;if(active==='INPUT'||active==='TEXTAREA')return;if(event.key==='ArrowLeft'&&!els.prev.disabled)els.prev.click();if(event.key==='ArrowRight'&&!els.next.disabled)els.next.click();});

  // Deliberately always-active pointer parallax: user explicitly requested full motion.
  let pointerFrame=0;let targetX=0;let targetY=0;
  document.addEventListener('pointermove',(event)=>{
    targetX=(event.clientX/window.innerWidth-.5)*28;targetY=(event.clientY/window.innerHeight-.5)*22;
    if(pointerFrame) return;
    pointerFrame=requestAnimationFrame(()=>{document.documentElement.style.setProperty('--pointer-x',`${targetX.toFixed(2)}px`);document.documentElement.style.setProperty('--pointer-y',`${targetY.toFixed(2)}px`);pointerFrame=0;});
  },{passive:true});

  window.SchaeferAppBridge = Object.freeze({
    getCurrentReportContext() {
      const report=currentItem(); if(!report) return null; const draft=activeDraftFor(report);
      return {
        sourceKey: reportSourceKey(report), sourceType: report.is_reference ? 'reference' : 'original',
        id: report.id || '', modality: state.modality, region: state.region, theme: state.theme, question: state.question,
        clinical: report.clinical || '', questionRaw: report.question_raw || '',
        findings: draft?.findings || report.findings || report.raw || '', impression: draft?.impression || report.impression || '',
        baseFindings: report.findings || report.raw || '', baseImpression: report.impression || '',
        hasDraft: Boolean(draft), draft: draft ? {...draft} : null, title: report.title || els.title.textContent
      };
    },
    applyDraft(draft) {
      const report=currentItem(); if(!report || !draft || draft.sourceKey !== reportSourceKey(report)) return false;
      state.aiDraft={...draft}; renderReport(); return true;
    },
    clearDraft() { state.aiDraft=null; renderReport(); },
    showToast,
  });

  els.statTotal.textContent=Core.formatCount(data.meta.total_reports||reports.length);
  els.statGroups.textContent=Core.formatCount(data.meta.group_count||0);
  els.statReferences.textContent=Core.formatCount(data.meta.reference_normal_count||referenceNormals.length);
  els.status.textContent=`${Core.formatCount(reports.length)} Originalbefunde · ${Core.formatCount(referenceNormals.length)} Normalreferenzen · vollständig lokal`;
  renderAll();
}());
