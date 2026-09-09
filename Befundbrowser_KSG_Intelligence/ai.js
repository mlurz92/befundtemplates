(function(){
  'use strict';
  const AI=window.BefundAI, Bridge=window.BefundAppBridge;
  if(!AI||!Bridge) return;
  const MODELS_URL='https://openrouter.ai/api/v1/models';
  const CHAT_URL='https://openrouter.ai/api/v1/chat/completions';
  const RESPONSES_URL='https://openrouter.ai/api/v1/responses';
  const CONFIG_KEY='befundbrowser-ai-config-v4', SESSION_KEY='befundbrowser-openrouter-key-session', LOCAL_KEY='befundbrowser-openrouter-key-local';
  // Schluessel der Vorversionen, damit gespeicherte Einstellungen und API-Keys
  // die Umbenennung der Anwendung ueberleben.
  const LEGACY_KEYS={[CONFIG_KEY]:'schaefer-ai-config-v4',[SESSION_KEY]:'schaefer-openrouter-key-session',[LOCAL_KEY]:'schaefer-openrouter-key-local'};
  const $=id=>document.getElementById(id);
  const el={settingsOpen:$('settings-open'),settings:$('settings-modal'),settingsClose:$('settings-close'),key:$('api-key-input'),keyToggle:$('api-key-toggle'),keyClear:$('api-key-clear'),remember:$('remember-key'),test:$('connection-test'),status:$('connection-status'),modelSearch:$('model-search'),freeList:$('model-free-list'),paidList:$('model-paid-list'),tooltip:$('model-tooltip'),deny:$('deny-data-collection'),zdr:$('require-zdr'),save:$('save-settings'),selected:$('selected-model-card'),count:$('model-count'),filters:$('model-filters'),edit:$('ai-edit-report'),workshop:$('ai-workshop'),workshopClose:$('ai-workshop-close'),workshopModel:$('ai-workshop-model'),privacy:$('ai-privacy-warning'),context:$('ai-context-strip'),sourceF:$('ai-source-findings'),sourceI:$('ai-source-impression'),instruction:$('ai-instruction'),run:$('ai-run'),processing:$('ai-processing'),stageLabel:$('ai-stage-label'),stageDetail:$('ai-stage-detail'),elapsed:$('ai-elapsed'),processingLog:$('ai-processing-log'),processingMeta:$('ai-processing-meta'),styleReport:$('ai-style-report'),resultZone:$('ai-result-zone'),resultF:$('ai-result-findings'),resultI:$('ai-result-impression'),summary:$('ai-result-summary'),warnings:$('ai-warning-list'),diffF:$('ai-diff-findings'),diffI:$('ai-diff-impression'),timeline:$('ai-version-timeline'),undo:$('ai-undo'),redo:$('ai-redo'),reset:$('ai-reset'),apply:$('ai-apply'),copy:$('ai-copy-report'),rerun:$('ai-rerun')};
  const state={settings:null,models:[],rawModels:[],filters:{free:false,structured:false,reasoning:false,tools:false,zdr:false},query:'',store:null,context:null,parentVersion:null,processingTimers:[],responsesTransportFailed:false,zdrSet:null};
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  const memoryStorage=new Map();
  function storageRef(name){try{return window[name]||null;}catch(_){return null;}}
  function storageSlot(name,key){return `${name}:${key}`;}
  function storageGet(name,key){
    try{const store=storageRef(name);const value=store?.getItem(key);if(value!==null&&value!==undefined)return value;}catch(_){}
    const cached=memoryStorage.get(storageSlot(name,key));if(cached)return cached;
    // Einmalige Migration von den Schluesselnamen vor der Umbenennung der Anwendung.
    const legacy=LEGACY_KEYS[key];
    if(legacy){try{const store=storageRef(name);const value=store?.getItem(legacy);if(value!==null&&value!==undefined){storageSet(name,key,value);storageRemove(name,legacy);return value;}}catch(_){}}
    return '';
  }
  function storageSet(name,key,value){let persisted=false;try{const store=storageRef(name);if(store){store.setItem(key,value);persisted=true;}}catch(_){}if(!persisted)memoryStorage.set(storageSlot(name,key),String(value));}
  function storageRemove(name,key){try{storageRef(name)?.removeItem(key);}catch(_){}memoryStorage.delete(storageSlot(name,key));}
  function readConfig(){let c={};try{c=JSON.parse(storageGet('localStorage',CONFIG_KEY)||'{}')}catch(_){}const remembered=Boolean(c.rememberKey);const key=remembered?storageGet('localStorage',LOCAL_KEY):storageGet('sessionStorage',SESSION_KEY);return AI.normalizeSettings({...c,apiKey:key});}
  function persistSettings(s){const clean={...s,apiKey:''};storageSet('localStorage',CONFIG_KEY,JSON.stringify(clean));if(s.rememberKey){storageSet('localStorage',LOCAL_KEY,s.apiKey);storageRemove('sessionStorage',SESSION_KEY);}else{storageSet('sessionStorage',SESSION_KEY,s.apiKey);storageRemove('localStorage',LOCAL_KEY);}}
  function formSettings(){return AI.normalizeSettings({...state.settings,apiKey:el.key.value.trim(),rememberKey:el.remember.checked,denyDataCollection:el.deny.checked,requireZdr:el.zdr.checked});}
  // Nur Header verwenden, die OpenRouter im CORS-Preflight zulaesst
  // (Access-Control-Allow-Headers). Eigene X-OpenRouter-*-Header ausserhalb
  // dieser Liste lassen den Preflight scheitern; der Aufruf endet dann als
  // "Failed to fetch", ohne dass die API ueberhaupt erreicht wird.
  const APP_TITLE='Befundbrowser KSG Intelligence 5.0.1';
  function appReferer(){try{const origin=window.location?.origin;if(origin&&/^https?:$/.test(window.location.protocol))return origin;}catch(_){}return 'https://localhost/';}
  function headers(key){return {'Authorization':`Bearer ${key}`,'Content-Type':'application/json','HTTP-Referer':appReferer(),'X-Title':APP_TITLE};}
  async function request(url,options={}){const key=(options.key||state.settings.apiKey||'').trim();if(!key)throw new Error('OpenRouter API-Key fehlt.');const res=await fetch(url,{...options,headers:{...headers(key),...(options.headers||{})}});let data=null;try{data=await res.json();}catch(_){data={};}if(!res.ok){const err=new Error(data?.error?.message||`OpenRouter HTTP ${res.status}`);err.status=res.status;err.openRouter=data?.error||null;throw err;}return data;}
  const client={async listModels(key){return request(MODELS_URL,{method:'GET',key});},async listZdrModels(key){return request(`${MODELS_URL}?zdr=true`,{method:'GET',key});},async chat(body,key){return request(CHAT_URL,{method:'POST',key,body:JSON.stringify(body)});},async responses(body,key){return request(RESPONSES_URL,{method:'POST',key,body:JSON.stringify(body)});}};
  function setStatus(text,kind=''){el.status.textContent=text;el.status.className=`connection-status${kind?` is-${kind}`:''}`;}
  function selectedModel(){return state.models.find(m=>m.id===state.settings.modelId)||AI.normalizeModel({id:state.settings.modelId,name:state.settings.modelId,pricing:{},supported_parameters:[],architecture:{input_modalities:['text'],output_modalities:['text']}});}
  function renderSelected(){const m=selectedModel();el.selected.innerHTML=`<span>Aktuelles Modell ${m.free?'<b class="model-badge free">FREE</b>':''}</span><strong>${esc(m.name)}</strong><small class="model-slug">${esc(m.id)}</small>`;}
  function modelBadges(m){const b=[];if(m.free)b.push('<span class="model-badge free">FREE</span>');if(m.supportsStructured)b.push('<span class="model-badge">Structured</span>');if(m.supportsReasoning)b.push('<span class="model-badge">Reasoning</span>');if(m.supportsTools)b.push('<span class="model-badge">Tools</span>');if(m.harnessOnly)b.push('<span class="model-badge harness">Harness</span>');if(m.zdr)b.push('<span class="model-badge">ZDR</span>');return b.join('');}
  function card(m){return `<button type="button" class="model-card${m.free?' is-free':''}${m.id===state.settings.modelId?' is-selected':''}" data-model-id="${esc(m.id)}"><div class="model-card-top"><strong>${esc(m.name)}</strong>${m.free?'<span class="model-badge free">FREE</span>':''}${m.harnessOnly?'<span class="model-badge harness">HARNESS</span>':''}</div><span class="model-slug">${esc(m.id)}</span><div class="model-badges">${modelBadges(m)}</div></button>`;}
  function renderCatalog(){const filtered=AI.sortModels(AI.filterModels(state.models,state.query,state.filters),state.settings.modelId);const frees=filtered.filter(m=>m.free),paid=filtered.filter(m=>!m.free);el.freeList.innerHTML=frees.length?frees.map(card).join(''):'<p class="model-placeholder">Keine passenden kostenlosen Modelle.</p>';el.paidList.innerHTML=paid.length?paid.map(card).join(''):'<p class="model-placeholder">Keine weiteren passenden Modelle.</p>';el.count.textContent=`${filtered.length} / ${state.models.length}`;for(const btn of document.querySelectorAll('.model-card')){const m=state.models.find(x=>x.id===btn.dataset.modelId);btn.addEventListener('click',()=>{state.settings.modelId=btn.dataset.modelId;renderSelected();renderCatalog();});btn.addEventListener('mouseenter',()=>showTooltip(btn,m));btn.addEventListener('mouseleave',hideTooltip);btn.addEventListener('focus',()=>showTooltip(btn,m));btn.addEventListener('blur',hideTooltip);}renderSelected();}
  function fmtTokens(n){if(!n)return '–';return new Intl.NumberFormat('de-DE',{notation:n>=1000000?'compact':'standard',maximumFractionDigits:1}).format(n);}
  function yes(v){return v?'✓ Ja':'— Nein';}
  function showTooltip(anchor,m){if(!m)return;anchor.setAttribute('aria-describedby','model-tooltip');el.tooltip.innerHTML=`<h5>${esc(m.name)} ${m.free?'<span class="model-badge free">FREE</span>':''}</h5><code>${esc(m.id)}</code><div class="tooltip-grid"><div class="tooltip-metric"><span>Kontext</span><strong>${fmtTokens(m.contextLength)}</strong></div><div class="tooltip-metric"><span>Max. Output</span><strong>${fmtTokens(m.maxCompletionTokens)}</strong></div><div class="tooltip-metric"><span>Input / 1M</span><strong>${AI.formatPricePerMillion(m.inputPrice)}</strong></div><div class="tooltip-metric"><span>Output / 1M</span><strong>${AI.formatPricePerMillion(m.outputPrice)}</strong></div><div class="tooltip-metric"><span>Structured</span><strong>${yes(m.supportsStructured)}</strong></div><div class="tooltip-metric"><span>Tools</span><strong>${yes(m.supportsTools)}</strong></div><div class="tooltip-metric"><span>Reasoning</span><strong>${yes(m.supportsReasoning)}</strong></div><div class="tooltip-metric"><span>ZDR-Endpunkt</span><strong>${yes(m.zdr)}</strong></div><div class="tooltip-metric"><span>Moderation</span><strong>${yes(m.moderated)}</strong></div><div class="tooltip-metric"><span>Ausführung</span><strong>${m.harnessOnly?'Agentic Harness':'Standard'}</strong></div><div class="tooltip-metric"><span>Input</span><strong>${esc(m.inputModalities.join(', ')||'–')}</strong></div><div class="tooltip-metric"><span>Output</span><strong>${esc(m.outputModalities.join(', ')||'–')}</strong></div></div><p class="tooltip-description">${esc(m.description||'Keine Modellbeschreibung verfügbar.')}</p>`;el.tooltip.hidden=false;requestAnimationFrame(()=>{const r=anchor.getBoundingClientRect(),t=el.tooltip.getBoundingClientRect();let left=r.right+10,top=r.top;if(left+t.width>innerWidth-8)left=r.left-t.width-10;if(left<8)left=8;if(top+t.height>innerHeight-8)top=innerHeight-t.height-8;if(top<8)top=8;el.tooltip.style.left=`${left}px`;el.tooltip.style.top=`${top}px`;});}
  function hideTooltip(){el.tooltip.hidden=true;for(const node of document.querySelectorAll('.model-card[aria-describedby="model-tooltip"]'))node.removeAttribute('aria-describedby');}
  async function loadModels(key){setStatus('Modelle werden geladen …');const all=await client.listModels(key);let zdr=[];try{zdr=await client.listZdrModels(key);}catch(_){}const zdrSet=new Set((zdr.data||[]).map(x=>x.id));state.zdrSet=zdrSet;state.rawModels=all.data||[];const gated=gatedIds();state.models=state.rawModels.map(m=>AI.normalizeModel(m,zdrSet,gated));renderCatalog();setStatus(`Verbunden · ${state.models.length} Modelle geladen`,'ok');return state.models;}
  function openSettings(){state.settings=readConfig();el.key.value=state.settings.apiKey;el.remember.checked=state.settings.rememberKey;el.deny.checked=state.settings.denyDataCollection;el.zdr.checked=state.settings.requireZdr;renderSelected();if(!el.settings.open)el.settings.showModal();if(state.settings.apiKey&&!state.models.length)loadModels(state.settings.apiKey).catch(e=>setStatus(e.message,'error'));}
  function saveSettings(){state.settings=formSettings();persistSettings(state.settings);renderSelected();Bridge.showToast('KI-Einstellungen gespeichert');if(el.settings.open)el.settings.close();}
  function clearApiKey(){storageRemove('sessionStorage',SESSION_KEY);storageRemove('localStorage',LOCAL_KEY);const clean=AI.normalizeSettings({...state.settings,apiKey:'',rememberKey:false});state.settings=clean;persistSettings(clean);el.key.value='';el.remember.checked=false;setStatus('API-Key aus Browser-Speicher entfernt.');Bridge.showToast('OpenRouter API-Key entfernt');}
  async function testConnection(){const candidate=formSettings();try{state.settings=candidate;await loadModels(candidate.apiKey);const exists=state.models.some(m=>m.id===candidate.modelId);setStatus(exists?'Verbunden · ausgewähltes Modell verfügbar':'Verbunden · ausgewähltes Modell derzeit nicht im Katalog',exists?'ok':'error');}catch(e){setStatus(e.message,'error');}}
  function toolCall(data,name){const calls=data?.choices?.[0]?.message?.tool_calls||[];return calls.find(c=>c?.function?.name===name)||calls[0]||null;}
  function mergeUsage(...items){const out={prompt_tokens:0,completion_tokens:0,total_tokens:0,cost:0};let any=false;for(const u of items){if(!u)continue;any=true;const p=Number(u.prompt_tokens??u.input_tokens),c=Number(u.completion_tokens??u.output_tokens),t=Number(u.total_tokens),cost=Number(u.cost);if(Number.isFinite(p))out.prompt_tokens+=p;if(Number.isFinite(c))out.completion_tokens+=c;if(Number.isFinite(t))out.total_tokens+=t;else if(Number.isFinite(p)||Number.isFinite(c))out.total_tokens+=(Number.isFinite(p)?p:0)+(Number.isFinite(c)?c:0);if(Number.isFinite(cost))out.cost+=cost;}return any?out:null;}
  // --- Fortschrittskanal ------------------------------------------------
  // Die Anzeige zeigt echte Schritte statt einer Timer-Attrappe. Jeder
  // Pipeline-Abschnitt meldet Beginn und Ende mit Dauer.
  const progress = {
    handler: null,
    start: 0,
    emit(event) { if (this.handler) this.handler({ ...event, elapsed: Date.now() - this.start }); },
    begin(handler) { this.handler = handler; this.start = Date.now(); },
    end() { this.handler = null; }
  };
  function stage(key, label, detail) { progress.emit({ type: 'stage', key, label, detail }); }
  function stageDone(key, label, detail) { progress.emit({ type: 'done', key, label, detail }); }
  function stageMeta(meta) { progress.emit({ type: 'meta', meta }); }

  function isHarnessError(e){return AI.isHarnessGateError(e)||/agentic harness/i.test(String(e?.message||''));}
  // Von OpenRouter gesperrte Harness-Modelle merken, damit spaetere Laeufe nicht
  // erneut in denselben Fehler laufen.
  const GATED_KEY='befundbrowser-openrouter-gated-models';
  // Freigaben koennen sich aendern: gelernte Sperren verfallen nach 7 Tagen, damit
  // ein spaeter freigegebenes Modell nicht dauerhaft ausgeschlossen bleibt.
  const GATED_TTL_MS=7*24*60*60*1000;
  function gatedRecords(){
    let raw;try{raw=JSON.parse(storageGet('localStorage',GATED_KEY)||'{}');}catch(_){return {};}
    if(Array.isArray(raw))raw=Object.fromEntries(raw.map(id=>[String(id),Date.now()]));
    if(!raw||typeof raw!=='object')return {};
    const now=Date.now();const out={};
    for(const [id,ts] of Object.entries(raw)){const t=Number(ts);if(Number.isFinite(t)&&now-t<GATED_TTL_MS)out[id]=t;}
    return out;
  }
  function gatedIds(){return new Set(Object.keys(gatedRecords()));}
  function rememberGated(id){if(!id)return;const rec=gatedRecords();rec[String(id)]=Date.now();storageSet('localStorage',GATED_KEY,JSON.stringify(rec));}
  function isGated(model){return AI.isHarnessGatedModel(model,gatedIds());}
  function fallbackFor(model){
    const excluded=[String(model?.id||''),...gatedIds()];
    const fromCatalog=AI.pickFallbackModel(state.models,excluded);
    if(fromCatalog)return fromCatalog;
    // Katalog noch nicht geladen: kuratiertes Ausweichmodell synthetisch erzeugen.
    // Dabei werden bewusst KEINE Faehigkeiten behauptet. Ein synthetisches Modell
    // mit response_format oder tools fuehrt sonst zu HTTP 404 "No endpoints found
    // that can handle the requested parameters", sobald der echte Endpunkt das
    // Format nicht unterstuetzt. Ohne Zusatzparameter ist der Aufruf universell
    // gueltig; die Parserkaskade kommt mit reiner Textantwort zurecht.
    const id=AI.FALLBACK_MODEL_IDS.find(x=>!excluded.includes(x));
    return id?AI.normalizeModel({id,name:id,pricing:{prompt:'0',completion:'0'},supported_parameters:[],architecture:{input_modalities:['text'],output_modalities:['text']}}):null;
  }
  function gateWarning(blocked,replacement){return {type:'model_harness_gated',label:'Modell nur fuer registrierte Agentic-Harness-Apps',detail:`OpenRouter gibt ${blocked} ausschliesslich fuer auf openrouter.ai/apps registrierte Agentic-Harness-Clients frei. Die Anfrage wurde automatisch mit dem gleichwertigen freien Modell ${replacement} ausgefuehrt.`,instructionBacked:false,severity:'warning'};}
  async function runResponsesHarnessEdit(ctx,instruction,model,settings,source){
    const sessionId=`befundbrowser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    const reviewBody=AI.buildResponsesHarnessRequest(ctx,instruction,model,settings,'review',sessionId);
    stage('review',`Modellaufruf 1 von 2 · Entwurf`,`${model.id} · OpenResponses-Harness`);
    const reviewData=await client.responses(reviewBody,settings.apiKey);
    stageDone('review','Entwurf erhalten');
    const reviewCalls=AI.responseFunctionCalls(reviewData);
    const reviewCall=reviewCalls.find(c=>c.name==='review_radiology_edit')||reviewCalls[0]||null;
    const reviewParsed=AI.extractAIResult(reviewData,'review_radiology_edit');
    const reviewCompleted=AI.completeAIResult(reviewParsed,source);
    if(!reviewCall){
      if(reviewCompleted.complete&&!reviewCompleted.needsRepair)return {parsed:reviewCompleted.result,data:reviewData,usage:mergeUsage(reviewData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'responses',steps:1};
      const submitOnly=AI.buildResponsesHarnessRequest(ctx,`${instruction}

Gib jetzt zwingend die vollständige Fassung über submit_radiology_edit aus.`,model,settings,'submit',sessionId);
      const submitOnlyData=await client.responses(submitOnly,settings.apiKey);
      return {parsed:AI.extractAIResult(submitOnlyData,'submit_radiology_edit'),data:submitOnlyData,usage:mergeUsage(reviewData.usage,submitOnlyData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'responses',steps:2};
    }
    stage('guard','Lokaler Consistency Guard',`${AI.splitSentences(reviewCompleted.result.findings).length} Befundsätze werden geprüft`);
    const localReview=AI.analyzeConsistency(source,reviewCompleted.result,instruction);
    stageDone('guard',`Guard abgeschlossen`,`${localReview.length} Hinweis(e)`);
    stage('submit','Modellaufruf 2 von 2 · Endfassung',`${model.id}`);
    const followup=AI.buildResponsesHarnessFollowup(reviewBody,reviewData,{review_complete:true,warnings:[...reviewCompleted.warnings,...localReview].map(w=>({type:w.type,label:w.label,detail:w.detail,instruction_backed:Boolean(w.instructionBacked)})),instruction:'Korrigiere nur unbeabsichtigte Konflikte. Benutzergewollte Änderungen erhalten. Reiche anschließend die vollständige Fassung über submit_radiology_edit ein.'});
    const submitData=await client.responses(followup,settings.apiKey);
    stageDone('submit','Endfassung erhalten');
    const parsed=AI.extractAIResult(submitData,'submit_radiology_edit');
    return {parsed,data:submitData,usage:mergeUsage(reviewData.usage,submitData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'responses',steps:2};
  }
  async function runChatHarnessEdit(ctx,instruction,model,settings,source){
    const reviewBody=AI.buildHarnessRequest(ctx,instruction,model,settings,'review');
    stage('review','Modellaufruf 1 von 2 · Entwurf',`${model.id} · Chat-Tool-Harness`);
    const reviewData=await client.chat(reviewBody,settings.apiKey);
    stageDone('review','Entwurf erhalten');
    const reviewCall=toolCall(reviewData,'review_radiology_edit');
    const reviewParsed=AI.extractAIResult(reviewData,'review_radiology_edit');
    const reviewCompleted=AI.completeAIResult(reviewParsed,source);
    if(!reviewCall){
      if(reviewCompleted.complete&&!reviewCompleted.needsRepair)return {parsed:reviewCompleted.result,data:reviewData,usage:mergeUsage(reviewData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'chat-tools',steps:1};
      const submitOnly=AI.buildHarnessRequest(ctx,`${instruction}

Gib jetzt zwingend die vollständige Fassung über submit_radiology_edit aus.`,model,settings,'submit');
      const submitOnlyData=await client.chat(submitOnly,settings.apiKey);
      return {parsed:AI.extractAIResult(submitOnlyData,'submit_radiology_edit'),data:submitOnlyData,usage:mergeUsage(reviewData.usage,submitOnlyData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'chat-tools',steps:2};
    }
    stage('guard','Lokaler Consistency Guard',`${AI.splitSentences(reviewCompleted.result.findings).length} Befundsätze werden geprüft`);
    const localReview=AI.analyzeConsistency(source,reviewCompleted.result,instruction);
    stageDone('guard','Guard abgeschlossen',`${localReview.length} Hinweis(e)`);
    stage('submit','Modellaufruf 2 von 2 · Endfassung',`${model.id}`);
    const followup=AI.buildHarnessFollowup(reviewBody,reviewCall,{review_complete:true,warnings:[...reviewCompleted.warnings,...localReview].map(w=>({type:w.type,label:w.label,detail:w.detail,instruction_backed:Boolean(w.instructionBacked)})),instruction:'Korrigiere nur unbeabsichtigte Konflikte. Benutzergewollte Änderungen erhalten. Reiche anschließend die vollständige Fassung über submit_radiology_edit ein.'});
    const submitData=await client.chat(followup,settings.apiKey);
    stageDone('submit','Endfassung erhalten');
    return {parsed:AI.extractAIResult(submitData,'submit_radiology_edit'),data:submitData,usage:mergeUsage(reviewData.usage,submitData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'chat-tools',steps:2};
  }
  async function runHarnessEdit(ctx,instruction,model,settings,source){
    if(AI.shouldPreferChatHarness(window.location?.protocol,state.responsesTransportFailed)){
      return runChatHarnessEdit(ctx,instruction,model,settings,source);
    }
    try{return await runResponsesHarnessEdit(ctx,instruction,model,settings,source);}catch(error){
      if(!AI.shouldFallbackHarnessTransport(error))throw error;
      state.responsesTransportFailed=true;
      try{return await runChatHarnessEdit(ctx,instruction,model,settings,source);}catch(chatError){
        const combined=new Error(`Agentic-Harness-Ausführung fehlgeschlagen. Responses: ${error.message} · Chat-Tool-Harness: ${chatError.message}`);
        combined.responsesError=error;combined.chatHarnessError=chatError;throw combined;
      }
    }
  }
  async function runDirectEdit(ctx,instruction,model,settings){
    stage('request','Modellaufruf · Transformation',
      `${model.id} · ${model.supportsStructured?'JSON-Schema':model.supportsTools?'Tool Calling':'Textformat'}`);
    if(model.supportsTools&&!model.supportsStructured){
      const body=AI.buildHarnessRequest(ctx,instruction,model,settings,'submit');
      const data=await client.chat(body,settings.apiKey);
      stageDone('request','Antwort erhalten');
      return {parsed:AI.extractAIResult(data,'submit_radiology_edit'),data,usage:data.usage||null,parserWarnings:[],harness:false,steps:1};
    }
    const body=AI.buildEditRequest(ctx,instruction,model,settings);
    const data=await client.chat(body,settings.apiKey);
    stageDone('request','Antwort erhalten');
    return {parsed:AI.extractAIResult(data),data,usage:data.usage||null,parserWarnings:[],harness:false,steps:1};
  }
  async function repairAIResult(ctx,instruction,model,settings,source,previous){
    const repairInstruction=`${instruction}\n\nFORMATREPARATUR: Die vorige Modellantwort konnte nicht zuverlässig in Befund und Beurteilung zerlegt werden. Erzeuge dieselbe beabsichtigte medizinische Änderung erneut. Gib zwingend den vollständigen Befund UND die vollständige Beurteilung aus; keine Erläuterung außerhalb der vorgesehenen Struktur.`;
    let attempt;
    if(model.harnessOnly){
      const harnessAttempt=previous?.harnessTransport==='chat-tools'
        ? await runChatHarnessEdit(ctx,repairInstruction,model,settings,source)
        : await runHarnessEdit(ctx,repairInstruction,model,settings,source);
      const completed=AI.completeAIResult(harnessAttempt.parsed,source);
      return {...harnessAttempt,parsed:completed.result,parserWarnings:[...(harnessAttempt.parserWarnings||[]),...completed.warnings],repaired:true,previous};
    }else if(model.supportsTools){
      const body=AI.buildHarnessRequest(ctx,repairInstruction,model,settings,'submit');const data=await client.chat(body,settings.apiKey);attempt={parsed:AI.extractAIResult(data,'submit_radiology_edit'),data,usage:data.usage||null};
    }else{
      const body=AI.buildEditRequest(ctx,repairInstruction,model,settings);const data=await client.chat(body,settings.apiKey);attempt={parsed:AI.extractAIResult(data),data,usage:data.usage||null};
    }
    const completed=AI.completeAIResult(attempt.parsed,source);return {...attempt,parsed:completed.result,parserWarnings:completed.warnings,repaired:true,previous};
  }
  async function runWithModel(ctx,instruction,model,settings,source){
    try{return model.harnessOnly?await runHarnessEdit(ctx,instruction,model,settings,source):await runDirectEdit(ctx,instruction,model,settings);}
    catch(e){
      // Eine echte Harness-Sperre nach oben reichen (dort erfolgt der Modellwechsel);
      // nur sonstige harness-bezogene Meldungen rechtfertigen einen Tool-Loop-Versuch.
      if(AI.isHarnessGateError(e))throw e;
      if(!model.harnessOnly&&isHarnessError(e))return runHarnessEdit(ctx,instruction,{...model,harnessOnly:true},settings,source);
      throw e;
    }
  }
  async function executeAIEdit(ctx,instruction,model,settings,source,options={}){
    let result,activeModel=model;const substitutions=[];
    // Ohne Katalog sind die Faehigkeiten des Modells unbekannt und ein Ausweichen
    // muesste raten. Einmaliges Nachladen ist billiger als ein Fehlversuch.
    if(!state.models.length){
      stage('catalog','Modellkatalog wird geladen','Fähigkeiten des Modells bestimmen');
      try{await loadModels(settings.apiKey);stageDone('catalog',`${state.models.length} Modelle geladen`);}
      catch(_){stageDone('catalog','Katalog nicht verfügbar','Aufruf ohne Zusatzparameter');}
      const refreshed=state.models.find(m=>m.id===activeModel.id);
      if(refreshed)activeModel=refreshed;
    }
    // Bekannt gesperrte Harness-Modelle direkt ersetzen, statt erst den
    // Providerfehler zu provozieren.
    if(isGated(activeModel)){
      const alt=fallbackFor(activeModel);
      if(alt){substitutions.push(gateWarning(activeModel.id,alt.id));activeModel=alt;}
    }
    // Bis zu drei Modelle durchlaufen: auch ein Ausweichmodell kann gesperrt sein.
    for(let attempt=0;;attempt++){
      try{result=await runWithModel(ctx,instruction,activeModel,settings,source);break;}
      catch(e){
        const gate=AI.isHarnessGateError(e);
        const unroutable=AI.isNotRoutableError(e);
        if((!gate&&!unroutable)||attempt>=2)throw e;
        // Nur die echte Harness-Sperre wird dauerhaft gemerkt. Ein Routingfehler
        // kann an der Datenschutzeinstellung oder an der Anbieterlast liegen und
        // darf das Modell nicht fuer sieben Tage aussperren.
        if(gate)rememberGated(activeModel.id);
        // Katalog neu bewerten, damit die Sperre sofort als Badge sichtbar wird.
        const learned=gatedIds();state.models=state.rawModels.map(m=>AI.normalizeModel(m,state.zdrSet,learned));
        try{renderCatalog();renderWorkshopModel();}catch(_){}
        const alt=fallbackFor(activeModel);
        if(!alt)throw new Error(gate
          ? `${activeModel.id} ist von OpenRouter nur für registrierte Agentic-Harness-Apps freigegeben und es steht kein freies Ausweichmodell zur Verfügung. Bitte im Modellkatalog ein anderes Modell wählen.`
          : `${activeModel.id} ist unter den aktuellen Einstellungen nicht erreichbar (${e.message}). Prüfen Sie die Datenschutzschalter in den KI-Einstellungen oder wählen Sie ein anderes Modell.`);
        substitutions.push(gate?gateWarning(activeModel.id,alt.id):{
          type:'model_not_routable',label:'Modell nicht erreichbar',
          detail:`OpenRouter konnte ${activeModel.id} nicht bedienen (${e.message.slice(0,110)}). Ausgeführt mit ${alt.id}.`,
          severity:'warning',instructionBacked:false
        });
        activeModel=alt;
      }
    }
    result.model=activeModel;result.substitutions=substitutions;
    result.parserWarnings=[...substitutions,...(result.parserWarnings||[])];
    let completed=AI.completeAIResult(result.parsed,source);result.parsed=completed.result;result.parserWarnings=[...(result.parserWarnings||[]),...completed.warnings];
    if(!completed.complete||completed.needsRepair){
      try{const repaired=await repairAIResult(ctx,instruction,activeModel,settings,source,result);const repairedCompleted=AI.completeAIResult(repaired.parsed,source);repaired.parsed=repairedCompleted.result;repaired.parserWarnings=[...(repaired.parserWarnings||[]),...repairedCompleted.warnings];result={...repaired,model:activeModel,substitutions,parserWarnings:[...substitutions,...(repaired.parserWarnings||[])]};completed=repairedCompleted;}catch(repairError){
        // Keep the safely preserved source sections from the first pass rather
        // than replacing a parser problem with a hard failure.
        if(!completed.complete)throw repairError;
        result.parserWarnings.push({type:'parser_repair_failed',label:'Format-Reparatur nicht möglich',detail:`Die ursprüngliche Modellantwort war nicht sicher strukturierbar. Die unveränderten Ausgangssektionen wurden bewahrt. Ursache: ${repairError.message}`,instructionBacked:false,severity:'high'});
      }
    }
    // Hat das Modell auch nach dem Reparaturpass kein verwertbares Format
    // geliefert, wird die Ausgangsvorlage bewahrt - der Benutzer haette dann aber
    // kein Ergebnis. Kostenlose Endpunkte versagen hier messbar haeufig
    // (README, Abschnitt 10), deshalb wird einmal das naechste Modell der
    // Ausweichkette versucht, bevor aufgegeben wird.
    const formatFailed=(res)=>(res.parserWarnings||[]).some(w=>w.type==='parser_unstructured_response');
    if(formatFailed(result)&&!options.noModelSwitch){
      const alternative=fallbackFor(activeModel);
      if(alternative){
        stage('switch','Modellwechsel nach Formatfehler',`${activeModel.id} → ${alternative.id}`);
        try{
          const retry=await executeAIEdit(ctx,instruction,alternative,settings,source,{noModelSwitch:true});
          if(!formatFailed(retry)){
            stageDone('switch','Zweites Modell erfolgreich',alternative.id);
            retry.substitutions=[...substitutions,{
              type:'model_format_switch',label:'Modell wegen Formatfehler gewechselt',
              detail:`${activeModel.id} hielt das Ausgabeformat auch nach dem Reparaturpass nicht ein. Ausgeführt mit ${alternative.id}.`,
              severity:'warning',instructionBacked:false
            },...(retry.substitutions||[])];
            // Der rekursive Lauf hat seine eigenen Hinweise bereits eingetragen;
            // ohne Entdopplung erschiene jede Meldung zweimal in der Warnliste.
            const seen=new Set();
            retry.parserWarnings=[...retry.substitutions,...(retry.parserWarnings||[])]
              .filter(w=>{const k=`${w.type}|${w.detail}`;if(seen.has(k))return false;seen.add(k);return true;});
            return retry;
          }
          stageDone('switch','Auch zweites Modell ohne verwertbares Format',alternative.id);
        }catch(switchError){
          stageDone('switch','Modellwechsel gescheitert',switchError.message.slice(0,80));
        }
      }
    }
    if(!result.parsed.findings||!result.parsed.impression)throw new Error('Das Modell lieferte auch nach automatischer Format-Reparatur keine medizinisch nutzbare Fassung. Die Ausgangsvorlage wurde nicht verändert.');

    // --- Stilpass ---------------------------------------------------------
    // Typografie wird immer deterministisch normalisiert. Verletzt die Fassung
    // die Korpus-Stilanker, folgt genau ein Korrekturpass; er wird nur
    // uebernommen, wenn er den medizinischen Inhalt nachweislich nicht bewegt.
    result.parsed.findings=AI.normalizeTypography(result.parsed.findings);
    result.parsed.impression=AI.normalizeTypography(result.parsed.impression);
    stage('style','Stilprüfung','Korpusanker: Satzlängen, Verdichtung, Negationslogik');
    let styleReport=AI.analyzeStyle(result.parsed.findings,result.parsed.impression);
    result.styleBefore=styleReport;
    if(styleReport.findings.length){
      stageDone('style',`${styleReport.findings.length} Stilabweichung(en)`,'Korrekturpass wird ausgeführt');
      stage('stylefix','Stilkorrektur',`${activeModel.id}`);
      try{
        const body=AI.buildStyleRepairRequest(result.parsed,styleReport,activeModel,settings);
        const data=await client.chat(body,settings.apiKey);
        const fixed=AI.completeAIResult(AI.extractAIResult(data),result.parsed).result;
        const candidate={findings:AI.normalizeTypography(fixed.findings),impression:AI.normalizeTypography(fixed.impression)};
        const safety=AI.styleRepairIsSafe(result.parsed,candidate);
        const after=AI.analyzeStyle(candidate.findings,candidate.impression);
        if(safety.safe&&candidate.findings&&candidate.impression&&after.findings.length<styleReport.findings.length){
          result.parsed={...result.parsed,...candidate};
          styleReport=after;
          result.styleRepaired=true;
          result.usage=mergeUsage(result.usage,data.usage);
          stageDone('stylefix','Stil korrigiert',`${styleReport.findings.length} verbleibende Abweichung(en)`);
        }else{
          // Der Korrekturpass hat den Inhalt bewegt oder nichts verbessert:
          // die inhaltlich gesicherte Fassung bleibt bestehen.
          result.styleRepairRejected=safety.safe?'ohne Verbesserung':'inhaltliche Abweichung';
          stageDone('stylefix','Korrekturpass verworfen',result.styleRepairRejected);
        }
      }catch(styleError){
        result.styleRepairRejected=styleError.message;
        stageDone('stylefix','Korrekturpass nicht möglich',styleError.message.slice(0,80));
      }
    }else{
      stageDone('style','Stil entspricht den Korpusankern');
    }
    result.style=styleReport;
    result.parserWarnings=[...(result.parserWarnings||[]),...styleReport.findings.map(item=>({
      type:`style_${item.type}`,label:item.label,detail:item.detail,
      severity:item.severity==='high'?'high':'warning',instructionBacked:false
    }))];
    stageMeta({model:activeModel.id,steps:result.steps||1,usage:result.usage||null,
      style:styleReport.metrics,repaired:Boolean(result.styleRepaired)});
    return result;
  }
  // Strg+Enter startet den Auftrag direkt aus dem Anweisungsfeld.
  function bindInstructionShortcut(){
    el.instruction.addEventListener('keydown',(event)=>{
      if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!el.run.disabled){event.preventDefault();runAI();}
    });
  }

  function openWorkshop(){const ctx=Bridge.getCurrentReportContext();if(!ctx){Bridge.showToast('Zuerst einen Befund auswählen');return;}state.settings=readConfig();if(!state.settings.apiKey){openSettings();setStatus('API-Key erforderlich, bevor die KI-Werkstatt genutzt werden kann.','error');return;}state.context=ctx;state.store=AI.createVersionStore({findings:ctx.findings,impression:ctx.impression,sourceKey:ctx.sourceKey});state.parentVersion=null;el.sourceF.textContent=ctx.findings;el.sourceI.textContent=ctx.impression||'Keine separate Beurteilung.';el.context.innerHTML=[ctx.modality,ctx.region,ctx.theme,ctx.question].map(x=>`<span>${esc(x)}</span>`).join('');el.instruction.value='';el.resultZone.hidden=true;renderWorkshopModel();if(!el.workshop.open)el.workshop.showModal();}
  // Die beiden Datenschutzschalter schließen Anbieter aus, die auf übermittelten
  // Daten trainieren. Kostenlose Endpunkte gehören überwiegend dazu; mit
  // aktiviertem Schalter antwortet OpenRouter dort mit HTTP 404. Das ist eine
  // gewollte Einstellung, aber der Zusammenhang muss sichtbar sein.
  function freeModelPolicyConflict(model){
    const s=state.settings||{};
    if(!model?.free)return '';
    if(s.requireZdr)return 'Zero-Data-Retention ist aktiv. Kostenlose Endpunkte erfüllen das in der Regel nicht und antworten dann mit „No endpoints found“.';
    if(s.denyDataCollection)return 'Der Ausschluss datensammelnder Anbieter ist aktiv. Kostenlose Endpunkte trainieren überwiegend auf den übermittelten Daten und fallen damit aus dem Routing.';
    return '';
  }

  function renderWorkshopModel(){const m=selectedModel();el.workshopModel.textContent=`OpenRouter · ${m.name} · ${m.id}${AI.isHarnessGatedModel(m,gatedIds())?' · GESPERRT (Harness-only) · Ausweichmodell aktiv':''}`;const gated=AI.isHarnessGatedModel(m,gatedIds());const alt=gated?fallbackFor(m):null;const policyConflict=freeModelPolicyConflict(m);el.privacy.innerHTML=policyConflict?`<strong>Einstellung schließt kostenlose Endpunkte aus</strong><span>${esc(policyConflict)} Entweder den Schalter in den KI-Einstellungen lösen oder ein kostenpflichtiges Modell wählen.</span>`:gated?`<strong>Modell bei OpenRouter gesperrt · automatisches Ausweichmodell</strong><span>OpenRouter gibt <code>${esc(m.id)}</code> ausschließlich für auf openrouter.ai/apps registrierte Agentic-Harness-Clients frei. Diese Web-App kann den Endpunkt nicht aufrufen; Anfragen werden automatisch mit dem gleichwertigen freien Modell <code>${esc(alt?.id||'–')}</code> im mehrstufigen Tool-Harness (Review → lokaler Guard → Submit) ausgeführt. Freie Endpunkte protokollieren Prompts und Outputs laut Anbieterhinweis; keine vertraulichen oder personenbezogenen Patientendaten senden.</span>`:'<strong>Datenschutz prüfen</strong><span>Provider-/Modellrichtlinien können variieren. Nur für die gewählte Datenklasse freigegebene Endpunkte verwenden.</span>';}
  function currentEdited(){const v=state.store.current();return {...v,findings:el.resultZone.hidden?v.findings:el.resultF.value,impression:el.resultZone.hidden?v.impression:el.resultI.value};}
  function diffInto(node,a,b){node.replaceChildren();for(const part of AI.buildSemanticDiff(a,b)){const span=document.createElement('span');span.textContent=part.text;if(part.type==='add')span.className='diff-add';if(part.type==='remove')span.className='diff-remove';node.appendChild(span);}}
  // Zeigt die gemessenen Stilkennzahlen der aktuellen Fassung gegen die
  // Korpusanker; so ist nachvollziehbar, worauf die Stilprüfung reagiert hat.
  function renderStyleReport(version){
    const metrics=version?.style;
    if(!metrics){el.styleReport.innerHTML='';el.styleReport.hidden=true;return;}
    el.styleReport.hidden=false;
    const limits=AI.STYLE_LIMITS;
    const ratio=Math.round((metrics.ratio||0)*100);
    const chips=[
      ['Befundsätze',metrics.findingsSentences,true],
      ['längster Befundsatz',`${metrics.findingsMax} W.`,metrics.findingsMax<=limits.findingsHard],
      ['längster Beurteilungssatz',`${metrics.impressionMax} W.`,metrics.impressionMax<=limits.impressionHard],
      ['Verdichtung',`${ratio} %`,metrics.findingsWords<40||metrics.ratio<=limits.impressionRatio]
    ];
    let html=chips.map(([label,value,ok])=>
      `<span class="style-chip${ok?' is-ok':''}"><b>${esc(String(value))}</b>${esc(label)}</span>`).join('');
    if(version.styleRepaired)html+='<span class="style-chip is-fixed">Stilkorrekturpass ausgeführt</span>';
    el.styleReport.innerHTML=html;
  }

  function renderWarnings(warnings){el.warnings.innerHTML=(warnings||[]).map(w=>`<div class="ai-warning ${esc(w.severity||'')}"><span class="warning-mark">${w.severity==='high'?'⚠':'◇'}</span><div><strong>${esc(w.label)}</strong><small>${esc(w.detail)}</small></div><span class="${w.instructionBacked?'instruction-backed':''}">${w.instructionBacked?'in Anweisung':'prüfen'}</span></div>`).join('')||'<div class="ai-warning"><span class="warning-mark">✓</span><div><strong>Keine heuristischen Konflikte erkannt</strong><small>Ärztliche Endkontrolle bleibt erforderlich.</small></div><span class="instruction-backed">lokal geprüft</span></div>';}
  function renderVersion(){const snap=state.store.snapshot(),v=snap.versions[snap.index],parent=snap.index>0?snap.versions[snap.index-1]:snap.versions[0];el.resultZone.hidden=false;el.resultF.value=v.findings||'';el.resultI.value=v.impression||'';el.summary.textContent=v.summary||v.label||'Aktuelle Fassung';renderStyleReport(v);renderWarnings(v.warnings||[]);diffInto(el.diffF,parent.findings||'',v.findings||'');diffInto(el.diffI,parent.impression||'',v.impression||'');el.timeline.innerHTML=snap.versions.map((x,i)=>`<button type="button" data-version="${i}" class="${i===snap.index?'is-current':''}">${esc(x.label||`V${i}`)}</button>`).join('');for(const b of el.timeline.querySelectorAll('button'))b.addEventListener('click',()=>{state.store.goTo(Number(b.dataset.version));renderVersion();});el.undo.disabled=!state.store.canUndo();el.redo.disabled=!state.store.canRedo();}
  function fmtSeconds(ms){return `${(ms/1000).toFixed(1).replace('.',',')} s`;}
  const numberFormat=new Intl.NumberFormat('de-DE');
  function fmtCount(value){return numberFormat.format(Number(value)||0);}

  function setProcessing(on){
    state.processingTimers.forEach(clearInterval);
    state.processingTimers=[];
    el.processing.hidden=!on;
    if(!on)return;
    el.processingLog.innerHTML='';
    el.processingMeta.innerHTML='';
    el.stageLabel.textContent='Anfrage wird vorbereitet';
    el.stageDetail.textContent='Modell und Transport werden gewählt';
    el.elapsed.textContent='0,0 s';
    const started=Date.now();
    // Laufzeit tickt sichtbar mit, damit ein haengender Aufruf erkennbar ist.
    state.processingTimers.push(setInterval(()=>{el.elapsed.textContent=fmtSeconds(Date.now()-started);},100));
  }

  function renderProgress(event){
    if(event.type==='meta'){
      const meta=event.meta||{};
      const parts=[];
      if(meta.model)parts.push(`<span><b>Modell</b>${esc(meta.model)}</span>`);
      if(meta.steps)parts.push(`<span><b>Modellaufrufe</b>${meta.steps}</span>`);
      if(meta.usage?.total_tokens)parts.push(`<span><b>Tokens</b>${fmtCount(meta.usage.total_tokens)}</span>`);
      if(meta.style)parts.push(`<span><b>Befundsätze</b>${meta.style.findingsSentences}</span>`,
        `<span><b>Verdichtung</b>${Math.round((meta.style.ratio||0)*100)} %</span>`);
      el.processingMeta.innerHTML=parts.join('');
      return;
    }
    if(event.type==='stage'){
      el.stageLabel.textContent=event.label;
      el.stageDetail.textContent=event.detail||'';
      const item=document.createElement('li');
      item.className='is-active';
      item.dataset.key=event.key;
      item.innerHTML=`<span class="log-mark"></span><span class="log-text">${esc(event.label)}</span><span class="log-time"></span>`;
      el.processingLog.appendChild(item);
      el.processingLog.scrollTop=el.processingLog.scrollHeight;
      return;
    }
    if(event.type==='done'){
      const items=[...el.processingLog.querySelectorAll(`li[data-key="${CSS.escape(event.key)}"]`)];
      const item=items[items.length-1];
      if(item){
        item.classList.remove('is-active');
        item.classList.add('is-done');
        item.querySelector('.log-text').textContent=event.label;
        item.querySelector('.log-time').textContent=fmtSeconds(event.elapsed);
      }
      if(event.detail)el.stageDetail.textContent=event.detail;
    }
  }

  async function runAI(){const instruction=el.instruction.value.trim();if(!instruction){Bridge.showToast('Änderungsanweisung fehlt');return;}state.settings=readConfig();if(!state.settings.apiKey){openSettings();return;}const source=currentEdited();const model=selectedModel();const ctx={...state.context,findings:source.findings,impression:source.impression};el.run.disabled=true;setProcessing(true);progress.begin(renderProgress);try{const execution=await executeAIEdit(ctx,instruction,model,state.settings,source);const parsed=execution.parsed;const warnings=[...(execution.parserWarnings||[]),...AI.analyzeConsistency(source,parsed,instruction)];state.parentVersion=source;state.store.add({findings:parsed.findings,impression:parsed.impression,summary:parsed.summary||(execution.harness?'Agentische KI-Transformation':'KI-Transformation'),style:execution.style?.metrics||null,styleRepaired:Boolean(execution.styleRepaired),preserved:parsed.preserved,conflicts:parsed.conflicts,warnings,instruction,modelId:execution.model?.id||model.id,usage:execution.usage||null,sourceKey:state.context.sourceKey,harness:Boolean(execution.harness),steps:execution.steps||1,repaired:Boolean(execution.repaired)});renderVersion();el.instruction.value='';if(execution.substitutions?.length){
      // Ein Modellwechsel kann zwei Ursachen haben; die Meldung darf sie nicht vermengen.
      const gated=execution.substitutions.some(x=>x.type==='model_harness_gated');
      const switched=execution.substitutions.some(x=>x.type==='model_format_switch');
      const used=execution.model?.id||model.id;
      if(gated&&switched)Bridge.showToast(`${model.id} ist gesperrt, das Ausweichmodell hielt das Format nicht ein \u2013 ausgeführt mit ${used}`);
      else if(gated)Bridge.showToast(`${model.id} ist bei OpenRouter gesperrt \u2013 ausgeführt mit ${used}`);
      else if(switched)Bridge.showToast(`${model.id} hielt das Ausgabeformat nicht ein \u2013 ausgeführt mit ${used}`);
    }}catch(e){Bridge.showToast(`KI-Fehler: ${e.message}`);renderWarnings([{type:'api_error',label:'OpenRouter-Anfrage fehlgeschlagen',detail:e.message,severity:'high',instructionBacked:false}]);el.resultZone.hidden=false;}finally{progress.end();setProcessing(false);el.run.disabled=false;}}
  async function copyWorkshop(){const v=currentEdited();const text=`Befund:\n${v.findings}\n\nBeurteilung:\n${v.impression}`;try{await navigator.clipboard.writeText(text);}catch(_){const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();}Bridge.showToast('KI-Befund kopiert');}
  function applyWorkshop(){const v=currentEdited();const ok=Bridge.applyDraft({sourceKey:state.context.sourceKey,findings:v.findings,impression:v.impression,modelId:selectedModel().id,versionLabel:state.store.current().label||'AI'});if(ok){Bridge.showToast('KI-Entwurf in Befundviewer übernommen');el.workshop.close();}else Bridge.showToast('Ausgangsbefund ist nicht mehr aktiv');}

  state.settings=readConfig();renderSelected();
  el.settingsOpen?.addEventListener('click',openSettings);el.settingsClose?.addEventListener('click',()=>el.settings.close());el.keyToggle?.addEventListener('click',()=>{const show=el.key.type==='password';el.key.type=show?'text':'password';el.keyToggle.textContent=show?'Verbergen':'Anzeigen';});el.keyClear?.addEventListener('click',clearApiKey);el.test?.addEventListener('click',testConnection);el.save?.addEventListener('click',saveSettings);el.modelSearch?.addEventListener('input',e=>{state.query=e.target.value;renderCatalog();});el.filters?.addEventListener('click',e=>{const b=e.target.closest('[data-model-filter]');if(!b)return;const k=b.dataset.modelFilter;if(k==='all'){for(const key of Object.keys(state.filters))state.filters[key]=false;for(const x of el.filters.querySelectorAll('[data-model-filter]'))x.classList.toggle('is-active',x.dataset.modelFilter==='all');}else{state.filters[k]=!state.filters[k];b.classList.toggle('is-active',state.filters[k]);const any=Object.values(state.filters).some(Boolean);el.filters.querySelector('[data-model-filter="all"]')?.classList.toggle('is-active',!any);}renderCatalog();});
  el.edit?.addEventListener('click',openWorkshop);el.workshopClose?.addEventListener('click',()=>el.workshop.close());el.run?.addEventListener('click',runAI);bindInstructionShortcut();document.querySelectorAll('.quick-action').forEach(b=>b.addEventListener('click',()=>{el.instruction.value=b.dataset.prompt;el.instruction.focus();}));el.undo?.addEventListener('click',()=>{state.store.undo();renderVersion();});el.redo?.addEventListener('click',()=>{state.store.redo();renderVersion();});el.reset?.addEventListener('click',()=>{state.store.reset();renderVersion();});el.rerun?.addEventListener('click',()=>{el.instruction.focus();});el.copy?.addEventListener('click',copyWorkshop);el.apply?.addEventListener('click',applyWorkshop);
  window.BefundAIWorkshop=Object.freeze({client,openSettings,openWorkshop,loadModels:()=>loadModels(state.settings.apiKey),getState:()=>({settings:{...state.settings,apiKey:state.settings.apiKey?'***':''},models:state.models.length})});
}());
