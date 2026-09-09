(function(){
  'use strict';
  const AI=window.SchaeferAI, Bridge=window.SchaeferAppBridge;
  if(!AI||!Bridge) return;
  const MODELS_URL='https://openrouter.ai/api/v1/models';
  const CHAT_URL='https://openrouter.ai/api/v1/chat/completions';
  const RESPONSES_URL='https://openrouter.ai/api/v1/responses';
  const CONFIG_KEY='schaefer-ai-config-v4', SESSION_KEY='schaefer-openrouter-key-session', LOCAL_KEY='schaefer-openrouter-key-local';
  const $=id=>document.getElementById(id);
  const el={settingsOpen:$('settings-open'),settings:$('settings-modal'),settingsClose:$('settings-close'),key:$('api-key-input'),keyToggle:$('api-key-toggle'),keyClear:$('api-key-clear'),remember:$('remember-key'),test:$('connection-test'),status:$('connection-status'),modelSearch:$('model-search'),freeList:$('model-free-list'),paidList:$('model-paid-list'),tooltip:$('model-tooltip'),deny:$('deny-data-collection'),zdr:$('require-zdr'),save:$('save-settings'),selected:$('selected-model-card'),count:$('model-count'),filters:$('model-filters'),edit:$('ai-edit-report'),workshop:$('ai-workshop'),workshopClose:$('ai-workshop-close'),workshopModel:$('ai-workshop-model'),privacy:$('ai-privacy-warning'),context:$('ai-context-strip'),sourceF:$('ai-source-findings'),sourceI:$('ai-source-impression'),instruction:$('ai-instruction'),run:$('ai-run'),processing:$('ai-processing'),resultZone:$('ai-result-zone'),resultF:$('ai-result-findings'),resultI:$('ai-result-impression'),summary:$('ai-result-summary'),warnings:$('ai-warning-list'),diffF:$('ai-diff-findings'),diffI:$('ai-diff-impression'),timeline:$('ai-version-timeline'),undo:$('ai-undo'),redo:$('ai-redo'),reset:$('ai-reset'),apply:$('ai-apply'),copy:$('ai-copy-report'),rerun:$('ai-rerun')};
  const state={settings:null,models:[],rawModels:[],filters:{free:false,structured:false,reasoning:false,tools:false,zdr:false},query:'',store:null,context:null,parentVersion:null,processingTimers:[],responsesTransportFailed:false};
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  const memoryStorage=new Map();
  function storageRef(name){try{return window[name]||null;}catch(_){return null;}}
  function storageSlot(name,key){return `${name}:${key}`;}
  function storageGet(name,key){try{const store=storageRef(name);const value=store?.getItem(key);if(value!==null&&value!==undefined)return value;}catch(_){}return memoryStorage.get(storageSlot(name,key))||'';}
  function storageSet(name,key,value){let persisted=false;try{const store=storageRef(name);if(store){store.setItem(key,value);persisted=true;}}catch(_){}if(!persisted)memoryStorage.set(storageSlot(name,key),String(value));}
  function storageRemove(name,key){try{storageRef(name)?.removeItem(key);}catch(_){}memoryStorage.delete(storageSlot(name,key));}
  function readConfig(){let c={};try{c=JSON.parse(storageGet('localStorage',CONFIG_KEY)||'{}')}catch(_){}const remembered=Boolean(c.rememberKey);const key=remembered?storageGet('localStorage',LOCAL_KEY):storageGet('sessionStorage',SESSION_KEY);return AI.normalizeSettings({...c,apiKey:key});}
  function persistSettings(s){const clean={...s,apiKey:''};storageSet('localStorage',CONFIG_KEY,JSON.stringify(clean));if(s.rememberKey){storageSet('localStorage',LOCAL_KEY,s.apiKey);storageRemove('sessionStorage',SESSION_KEY);}else{storageSet('sessionStorage',SESSION_KEY,s.apiKey);storageRemove('localStorage',LOCAL_KEY);}}
  function formSettings(){return AI.normalizeSettings({...state.settings,apiKey:el.key.value.trim(),rememberKey:el.remember.checked,denyDataCollection:el.deny.checked,requireZdr:el.zdr.checked});}
  // Nur Header verwenden, die OpenRouter im CORS-Preflight zulaesst
  // (Access-Control-Allow-Headers). Eigene X-OpenRouter-*-Header ausserhalb
  // dieser Liste lassen den Preflight scheitern; der Aufruf endet dann als
  // "Failed to fetch", ohne dass die API ueberhaupt erreicht wird.
  const APP_TITLE='Schaefer Befundbrowser Intelligence 4.1.2';
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
  async function loadModels(key){setStatus('Modelle werden geladen …');const all=await client.listModels(key);let zdr=[];try{zdr=await client.listZdrModels(key);}catch(_){}const zdrSet=new Set((zdr.data||[]).map(x=>x.id));state.rawModels=all.data||[];state.models=state.rawModels.map(m=>AI.normalizeModel(m,zdrSet));renderCatalog();setStatus(`Verbunden · ${state.models.length} Modelle geladen`,'ok');return state.models;}
  function openSettings(){state.settings=readConfig();el.key.value=state.settings.apiKey;el.remember.checked=state.settings.rememberKey;el.deny.checked=state.settings.denyDataCollection;el.zdr.checked=state.settings.requireZdr;renderSelected();if(!el.settings.open)el.settings.showModal();if(state.settings.apiKey&&!state.models.length)loadModels(state.settings.apiKey).catch(e=>setStatus(e.message,'error'));}
  function saveSettings(){state.settings=formSettings();persistSettings(state.settings);renderSelected();Bridge.showToast('KI-Einstellungen gespeichert');if(el.settings.open)el.settings.close();}
  function clearApiKey(){storageRemove('sessionStorage',SESSION_KEY);storageRemove('localStorage',LOCAL_KEY);const clean=AI.normalizeSettings({...state.settings,apiKey:'',rememberKey:false});state.settings=clean;persistSettings(clean);el.key.value='';el.remember.checked=false;setStatus('API-Key aus Browser-Speicher entfernt.');Bridge.showToast('OpenRouter API-Key entfernt');}
  async function testConnection(){const candidate=formSettings();try{state.settings=candidate;await loadModels(candidate.apiKey);const exists=state.models.some(m=>m.id===candidate.modelId);setStatus(exists?'Verbunden · ausgewähltes Modell verfügbar':'Verbunden · ausgewähltes Modell derzeit nicht im Katalog',exists?'ok':'error');}catch(e){setStatus(e.message,'error');}}
  function toolCall(data,name){const calls=data?.choices?.[0]?.message?.tool_calls||[];return calls.find(c=>c?.function?.name===name)||calls[0]||null;}
  function mergeUsage(...items){const out={prompt_tokens:0,completion_tokens:0,total_tokens:0,cost:0};let any=false;for(const u of items){if(!u)continue;any=true;const p=Number(u.prompt_tokens??u.input_tokens),c=Number(u.completion_tokens??u.output_tokens),t=Number(u.total_tokens),cost=Number(u.cost);if(Number.isFinite(p))out.prompt_tokens+=p;if(Number.isFinite(c))out.completion_tokens+=c;if(Number.isFinite(t))out.total_tokens+=t;else if(Number.isFinite(p)||Number.isFinite(c))out.total_tokens+=(Number.isFinite(p)?p:0)+(Number.isFinite(c)?c:0);if(Number.isFinite(cost))out.cost+=cost;}return any?out:null;}
  function isHarnessError(e){return AI.isHarnessGateError(e)||/agentic harness/i.test(String(e?.message||''));}
  // Von OpenRouter gesperrte Harness-Modelle merken, damit spaetere Laeufe nicht
  // erneut in denselben Fehler laufen.
  const GATED_KEY='schaefer-openrouter-gated-models';
  function gatedIds(){try{const raw=JSON.parse(storageGet('localStorage',GATED_KEY)||'[]');return new Set(Array.isArray(raw)?raw.map(String):[]);}catch(_){return new Set();}}
  function rememberGated(id){if(!id)return;const set=gatedIds();if(set.has(id))return;set.add(id);storageSet('localStorage',GATED_KEY,JSON.stringify([...set]));}
  function isGated(model){return AI.isHarnessGatedModel(model)||gatedIds().has(String(model?.id||''));}
  function fallbackFor(model){
    const excluded=[String(model?.id||''),...gatedIds()];
    const fromCatalog=AI.pickFallbackModel(state.models,excluded);
    if(fromCatalog)return fromCatalog;
    // Katalog noch nicht geladen: kuratiertes Ausweichmodell synthetisch erzeugen.
    const id=AI.FALLBACK_MODEL_IDS.find(x=>!excluded.includes(x));
    return id?AI.normalizeModel({id,name:id,pricing:{prompt:'0',completion:'0'},supported_parameters:['response_format','tools','tool_choice'],architecture:{input_modalities:['text'],output_modalities:['text']}}):null;
  }
  function gateWarning(blocked,replacement){return {type:'model_harness_gated',label:'Modell nur fuer registrierte Agentic-Harness-Apps',detail:`OpenRouter gibt ${blocked} ausschliesslich fuer auf openrouter.ai/apps registrierte Agentic-Harness-Clients frei. Die Anfrage wurde automatisch mit dem gleichwertigen freien Modell ${replacement} ausgefuehrt.`,instructionBacked:false,severity:'warning'};}
  async function runResponsesHarnessEdit(ctx,instruction,model,settings,source){
    const sessionId=`schaefer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    const reviewBody=AI.buildResponsesHarnessRequest(ctx,instruction,model,settings,'review',sessionId);
    const reviewData=await client.responses(reviewBody,settings.apiKey);
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
    const localReview=AI.analyzeConsistency(source,reviewCompleted.result,instruction);
    const followup=AI.buildResponsesHarnessFollowup(reviewBody,reviewData,{review_complete:true,warnings:[...reviewCompleted.warnings,...localReview].map(w=>({type:w.type,label:w.label,detail:w.detail,instruction_backed:Boolean(w.instructionBacked)})),instruction:'Korrigiere nur unbeabsichtigte Konflikte. Benutzergewollte Änderungen erhalten. Reiche anschließend die vollständige Fassung über submit_radiology_edit ein.'});
    const submitData=await client.responses(followup,settings.apiKey);
    const parsed=AI.extractAIResult(submitData,'submit_radiology_edit');
    return {parsed,data:submitData,usage:mergeUsage(reviewData.usage,submitData.usage),parserWarnings:reviewCompleted.warnings,harness:true,harnessTransport:'responses',steps:2};
  }
  async function runChatHarnessEdit(ctx,instruction,model,settings,source){
    const reviewBody=AI.buildHarnessRequest(ctx,instruction,model,settings,'review');
    const reviewData=await client.chat(reviewBody,settings.apiKey);
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
    const localReview=AI.analyzeConsistency(source,reviewCompleted.result,instruction);
    const followup=AI.buildHarnessFollowup(reviewBody,reviewCall,{review_complete:true,warnings:[...reviewCompleted.warnings,...localReview].map(w=>({type:w.type,label:w.label,detail:w.detail,instruction_backed:Boolean(w.instructionBacked)})),instruction:'Korrigiere nur unbeabsichtigte Konflikte. Benutzergewollte Änderungen erhalten. Reiche anschließend die vollständige Fassung über submit_radiology_edit ein.'});
    const submitData=await client.chat(followup,settings.apiKey);
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
    if(model.supportsTools&&!model.supportsStructured){
      const body=AI.buildHarnessRequest(ctx,instruction,model,settings,'submit');
      const data=await client.chat(body,settings.apiKey);
      return {parsed:AI.extractAIResult(data,'submit_radiology_edit'),data,usage:data.usage||null,parserWarnings:[],harness:false,steps:1};
    }
    const body=AI.buildEditRequest(ctx,instruction,model,settings);
    const data=await client.chat(body,settings.apiKey);
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
  async function executeAIEdit(ctx,instruction,model,settings,source){
    let result,activeModel=model;const substitutions=[];
    // Bekannt gesperrte Harness-Modelle direkt ersetzen, statt erst den
    // Providerfehler zu provozieren.
    if(isGated(activeModel)){
      const alt=fallbackFor(activeModel);
      if(alt){substitutions.push(gateWarning(activeModel.id,alt.id));activeModel=alt;}
    }
    try{result=await runWithModel(ctx,instruction,activeModel,settings,source);}
    catch(e){
      if(!AI.isHarnessGateError(e))throw e;
      rememberGated(activeModel.id);
      const alt=fallbackFor(activeModel);
      if(!alt)throw new Error(`${activeModel.id} ist von OpenRouter nur fuer registrierte Agentic-Harness-Apps freigegeben und es steht kein freies Ausweichmodell zur Verfuegung. Bitte im Modellkatalog ein anderes Modell waehlen.`);
      substitutions.push(gateWarning(activeModel.id,alt.id));
      activeModel=alt;
      result=await runWithModel(ctx,instruction,activeModel,settings,source);
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
    if(!result.parsed.findings||!result.parsed.impression)throw new Error('Das Modell lieferte auch nach automatischer Format-Reparatur keine medizinisch nutzbare Fassung. Die Ausgangsvorlage wurde nicht verändert.');
    return result;
  }
  function openWorkshop(){const ctx=Bridge.getCurrentReportContext();if(!ctx){Bridge.showToast('Zuerst einen Befund auswählen');return;}state.settings=readConfig();if(!state.settings.apiKey){openSettings();setStatus('API-Key erforderlich, bevor die KI-Werkstatt genutzt werden kann.','error');return;}state.context=ctx;state.store=AI.createVersionStore({findings:ctx.findings,impression:ctx.impression,sourceKey:ctx.sourceKey});state.parentVersion=null;el.sourceF.textContent=ctx.findings;el.sourceI.textContent=ctx.impression||'Keine separate Beurteilung.';el.context.innerHTML=[ctx.modality,ctx.region,ctx.theme,ctx.question].map(x=>`<span>${esc(x)}</span>`).join('');el.instruction.value='';el.resultZone.hidden=true;renderWorkshopModel();if(!el.workshop.open)el.workshop.showModal();}
  function renderWorkshopModel(){const m=selectedModel();el.workshopModel.textContent=`OpenRouter · ${m.name} · ${m.id}${(AI.isHarnessGatedModel(m)||gatedIds().has(m.id))?' · GESPERRT (Harness-only) · Ausweichmodell aktiv':''}`;const gated=AI.isHarnessGatedModel(m)||gatedIds().has(m.id);const alt=gated?fallbackFor(m):null;el.privacy.innerHTML=gated?`<strong>Modell bei OpenRouter gesperrt · automatisches Ausweichmodell</strong><span>OpenRouter gibt <code>${esc(m.id)}</code> ausschließlich für auf openrouter.ai/apps registrierte Agentic-Harness-Clients frei. Diese Web-App kann den Endpunkt nicht aufrufen; Anfragen werden automatisch mit dem gleichwertigen freien Modell <code>${esc(alt?.id||'–')}</code> im mehrstufigen Tool-Harness (Review → lokaler Guard → Submit) ausgeführt. Freie Endpunkte protokollieren Prompts und Outputs laut Anbieterhinweis; keine vertraulichen oder personenbezogenen Patientendaten senden.</span>`:'<strong>Datenschutz prüfen</strong><span>Provider-/Modellrichtlinien können variieren. Nur für die gewählte Datenklasse freigegebene Endpunkte verwenden.</span>';}
  function currentEdited(){const v=state.store.current();return {...v,findings:el.resultZone.hidden?v.findings:el.resultF.value,impression:el.resultZone.hidden?v.impression:el.resultI.value};}
  function diffInto(node,a,b){node.replaceChildren();for(const part of AI.buildSemanticDiff(a,b)){const span=document.createElement('span');span.textContent=part.text;if(part.type==='add')span.className='diff-add';if(part.type==='remove')span.className='diff-remove';node.appendChild(span);}}
  function renderWarnings(warnings){el.warnings.innerHTML=(warnings||[]).map(w=>`<div class="ai-warning ${esc(w.severity||'')}"><span class="warning-mark">${w.severity==='high'?'⚠':'◇'}</span><div><strong>${esc(w.label)}</strong><small>${esc(w.detail)}</small></div><span class="${w.instructionBacked?'instruction-backed':''}">${w.instructionBacked?'in Anweisung':'prüfen'}</span></div>`).join('')||'<div class="ai-warning"><span class="warning-mark">✓</span><div><strong>Keine heuristischen Konflikte erkannt</strong><small>Ärztliche Endkontrolle bleibt erforderlich.</small></div><span class="instruction-backed">lokal geprüft</span></div>';}
  function renderVersion(){const snap=state.store.snapshot(),v=snap.versions[snap.index],parent=snap.index>0?snap.versions[snap.index-1]:snap.versions[0];el.resultZone.hidden=false;el.resultF.value=v.findings||'';el.resultI.value=v.impression||'';el.summary.textContent=v.summary||v.label||'Aktuelle Fassung';renderWarnings(v.warnings||[]);diffInto(el.diffF,parent.findings||'',v.findings||'');diffInto(el.diffI,parent.impression||'',v.impression||'');el.timeline.innerHTML=snap.versions.map((x,i)=>`<button type="button" data-version="${i}" class="${i===snap.index?'is-current':''}">${esc(x.label||`V${i}`)}</button>`).join('');for(const b of el.timeline.querySelectorAll('button'))b.addEventListener('click',()=>{state.store.goTo(Number(b.dataset.version));renderVersion();});el.undo.disabled=!state.store.canUndo();el.redo.disabled=!state.store.canRedo();}
  function setProcessing(on){state.processingTimers.forEach(clearTimeout);state.processingTimers=[];el.processing.hidden=!on;const steps=[...el.processing.querySelectorAll('[data-stage]')];steps.forEach(s=>s.className='');if(on){steps[0]?.classList.add('is-active');state.processingTimers.push(setTimeout(()=>{steps[0]?.classList.replace('is-active','is-done');steps[1]?.classList.add('is-active');},350));state.processingTimers.push(setTimeout(()=>{steps[1]?.classList.replace('is-active','is-done');steps[2]?.classList.add('is-active');},900));}}
  async function runAI(){const instruction=el.instruction.value.trim();if(!instruction){Bridge.showToast('Änderungsanweisung fehlt');return;}state.settings=readConfig();if(!state.settings.apiKey){openSettings();return;}const source=currentEdited();const model=selectedModel();const ctx={...state.context,findings:source.findings,impression:source.impression};el.run.disabled=true;setProcessing(true);try{const execution=await executeAIEdit(ctx,instruction,model,state.settings,source);const parsed=execution.parsed;const warnings=[...(execution.parserWarnings||[]),...AI.analyzeConsistency(source,parsed,instruction)];state.parentVersion=source;state.store.add({findings:parsed.findings,impression:parsed.impression,summary:parsed.summary||(execution.harness?'Agentische KI-Transformation':'KI-Transformation'),preserved:parsed.preserved,conflicts:parsed.conflicts,warnings,instruction,modelId:execution.model?.id||model.id,usage:execution.usage||null,sourceKey:state.context.sourceKey,harness:Boolean(execution.harness),steps:execution.steps||1,repaired:Boolean(execution.repaired)});renderVersion();el.instruction.value='';if(execution.substitutions?.length)Bridge.showToast(`Modell ${model.id} ist bei OpenRouter gesperrt \u2013 ausgefuehrt mit ${execution.model.id}`);}catch(e){Bridge.showToast(`KI-Fehler: ${e.message}`);renderWarnings([{type:'api_error',label:'OpenRouter-Anfrage fehlgeschlagen',detail:e.message,severity:'high',instructionBacked:false}]);el.resultZone.hidden=false;}finally{setProcessing(false);el.run.disabled=false;}}
  async function copyWorkshop(){const v=currentEdited();const text=`Befund:\n${v.findings}\n\nBeurteilung:\n${v.impression}`;try{await navigator.clipboard.writeText(text);}catch(_){const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();}Bridge.showToast('KI-Befund kopiert');}
  function applyWorkshop(){const v=currentEdited();const ok=Bridge.applyDraft({sourceKey:state.context.sourceKey,findings:v.findings,impression:v.impression,modelId:selectedModel().id,versionLabel:state.store.current().label||'AI'});if(ok){Bridge.showToast('KI-Entwurf in Befundviewer übernommen');el.workshop.close();}else Bridge.showToast('Ausgangsbefund ist nicht mehr aktiv');}

  state.settings=readConfig();renderSelected();
  el.settingsOpen?.addEventListener('click',openSettings);el.settingsClose?.addEventListener('click',()=>el.settings.close());el.keyToggle?.addEventListener('click',()=>{const show=el.key.type==='password';el.key.type=show?'text':'password';el.keyToggle.textContent=show?'Verbergen':'Anzeigen';});el.keyClear?.addEventListener('click',clearApiKey);el.test?.addEventListener('click',testConnection);el.save?.addEventListener('click',saveSettings);el.modelSearch?.addEventListener('input',e=>{state.query=e.target.value;renderCatalog();});el.filters?.addEventListener('click',e=>{const b=e.target.closest('[data-model-filter]');if(!b)return;const k=b.dataset.modelFilter;if(k==='all'){for(const key of Object.keys(state.filters))state.filters[key]=false;for(const x of el.filters.querySelectorAll('[data-model-filter]'))x.classList.toggle('is-active',x.dataset.modelFilter==='all');}else{state.filters[k]=!state.filters[k];b.classList.toggle('is-active',state.filters[k]);const any=Object.values(state.filters).some(Boolean);el.filters.querySelector('[data-model-filter="all"]')?.classList.toggle('is-active',!any);}renderCatalog();});
  el.edit?.addEventListener('click',openWorkshop);el.workshopClose?.addEventListener('click',()=>el.workshop.close());el.run?.addEventListener('click',runAI);document.querySelectorAll('.quick-action').forEach(b=>b.addEventListener('click',()=>{el.instruction.value=b.dataset.prompt;el.instruction.focus();}));el.undo?.addEventListener('click',()=>{state.store.undo();renderVersion();});el.redo?.addEventListener('click',()=>{state.store.redo();renderVersion();});el.reset?.addEventListener('click',()=>{state.store.reset();renderVersion();});el.rerun?.addEventListener('click',()=>{el.instruction.focus();});el.copy?.addEventListener('click',copyWorkshop);el.apply?.addEventListener('click',applyWorkshop);
  window.SchaeferAIWorkshop=Object.freeze({client,openSettings,openWorkshop,loadModels:()=>loadModels(state.settings.apiKey),getState:()=>({settings:{...state.settings,apiKey:state.settings.apiKey?'***':''},models:state.models.length})});
}());
