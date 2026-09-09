(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BefundAI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Modelle, die OpenRouter ausschliesslich fuer registrierte Agentic-Harness-Apps
  // freigibt (https://openrouter.ai/apps). Aus einer eigenstaendigen Browser-App
  // sind sie nicht aufrufbar; der Endpunkt antwortet mit
  // "... is only available on agentic harnesses". Sie bleiben im Katalog waehlbar,
  // die App weicht bei der Ausfuehrung aber automatisch auf ein gleichwertiges
  // freies Modell aus.
  const HARNESS_GATED_IDS = new Set(['thinkingmachines/inkling-small:free','thinkingmachines/inkling:free']);
  // Bevorzugte freie Ausweichmodelle: Tool-Calling und JSON-Schema faehig,
  // ohne Harness-Beschraenkung.
  const FALLBACK_MODEL_IDS = ['nvidia/nemotron-3-super-120b-a12b:free','google/gemma-4-31b-it:free','nex-agi/nex-n2.5-pro:free','google/gemma-4-26b-a4b-it:free','dots-studio/dots-3-note-preview:free'];
  const DEFAULT_MODEL = FALLBACK_MODEL_IDS[0];
  const HARNESS_ONLY_IDS = HARNESS_GATED_IDS;
  const OUTPUT_SCHEMA = {
    type:'object', additionalProperties:false,
    properties:{
      findings:{type:'string'}, impression:{type:'string'}, summary:{type:'string'},
      preserved:{type:'array',items:{type:'string'}}, conflicts:{type:'array',items:{type:'string'}}
    },
    required:['findings','impression','summary','preserved','conflicts']
  };

  function fold(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').toLowerCase();}
  function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function isFreeModel(raw){
    if(!raw) return false;
    if(String(raw.id||'').endsWith(':free')) return true;
    const p=raw.pricing||{}; const vals=['prompt','completion','request'].map(k=>num(p[k]));
    return vals.every(v=>v===0);
  }
  function supports(params, re){return (params||[]).some(p=>re.test(String(p)));}
  function isGatedId(id,gatedSet){const key=String(id||'');return HARNESS_GATED_IDS.has(key)||Boolean(gatedSet&&gatedSet.has&&gatedSet.has(key));}
  function normalizeModel(raw,zdrSet,gatedSet){
    const p=raw?.pricing||{}; const params=raw?.supported_parameters||[]; const arch=raw?.architecture||{}; const top=raw?.top_provider||{};
    return {
      raw, id:String(raw?.id||''), name:String(raw?.name||raw?.id||'Unbekannt'), description:String(raw?.description||''),
      author:String(raw?.id||'').split('/')[0]||'–', free:isFreeModel(raw), contextLength:Number(raw?.context_length||top.context_length||0)||0,
      maxCompletionTokens:Number(top.max_completion_tokens||0)||0, inputPrice:num(p.prompt), outputPrice:num(p.completion), requestPrice:num(p.request),
      inputModalities:Array.isArray(arch.input_modalities)?arch.input_modalities:[], outputModalities:Array.isArray(arch.output_modalities)?arch.output_modalities:[],
      supportedParameters:params.slice(), supportsStructured:params.includes('response_format'), supportsTools:params.includes('tools')||params.includes('tool_choice'),
      supportsReasoning:supports(params,/reason/i), zdr:Boolean(zdrSet&&zdrSet.has(raw?.id)), moderated:top.is_moderated===true,
      harnessOnly:isGatedId(String(raw?.id||''),gatedSet),harnessGated:isGatedId(String(raw?.id||''),gatedSet), created:Number(raw?.created||0)||0
    };
  }
  function sortModels(models,selectedId){return (models||[]).slice().sort((a,b)=>{
    const as=a.id===selectedId, bs=b.id===selectedId; if(as!==bs)return as?-1:1; if(a.free!==b.free)return a.free?-1:1;
    if(a.supportsStructured!==b.supportsStructured)return a.supportsStructured?-1:1; if(a.contextLength!==b.contextLength)return b.contextLength-a.contextLength;
    return a.name.localeCompare(b.name,'de');
  });}
  function filterModels(models,q,filters={}){const needle=fold(q);return (models||[]).filter(m=>{
    if(needle&&!fold(`${m.name} ${m.id} ${m.author} ${m.description}`).includes(needle))return false;
    if(filters.free&&!m.free)return false;if(filters.structured&&!m.supportsStructured)return false;if(filters.tools&&!m.supportsTools)return false;if(filters.reasoning&&!m.supportsReasoning)return false;if(filters.zdr&&!m.zdr)return false;return true;
  });}
  function formatPricePerMillion(v){const n=num(v);if(n===null)return '–';if(n===0)return '$0';const x=n*1e6;return x<0.01?`$${x.toPrecision(2)}`:`$${x.toFixed(2)}`;}
  function normalizeSettings(s={}){return {apiKey:String(s.apiKey||''),rememberKey:Boolean(s.rememberKey),modelId:String(s.modelId||DEFAULT_MODEL),denyDataCollection:Boolean(s.denyDataCollection),requireZdr:Boolean(s.requireZdr),temperature:Number.isFinite(Number(s.temperature))?Number(s.temperature):0.2,maxTokens:Number.isFinite(Number(s.maxTokens))?Number(s.maxTokens):2200};}
  function isHarnessGateError(error){
    const message=String(error?.message||'');
    const meta=String(error?.openRouter?.message||'');
    return /only available on agentic harnesses|agentic harness(?:es)? only|available on agentic harnesses/i.test(`${message} ${meta}`);
  }
  function isHarnessGatedModel(model,gatedSet){
    const id=String(typeof model==='string'?model:(model?.id||''));
    return isGatedId(id,gatedSet);
  }
  // Waehlt ein gleichwertiges, frei nutzbares Ausweichmodell: erst die kuratierte
  // Praeferenzliste, danach das beste freie Modell des Live-Katalogs.
  function pickFallbackModel(models,excludeIds=[]){
    const blocked=new Set([...HARNESS_GATED_IDS,...excludeIds].map(String));
    const list=Array.isArray(models)?models.filter(m=>m&&m.id&&!blocked.has(m.id)):[];
    for(const id of FALLBACK_MODEL_IDS){const hit=list.find(m=>m.id===id);if(hit)return hit;}
    const capable=list.filter(m=>m.free&&(m.supportsStructured||m.supportsTools));
    if(capable.length)return sortModels(capable)[0];
    const anyFree=list.filter(m=>m.free);
    if(anyFree.length)return sortModels(anyFree)[0];
    return null;
  }
  function shouldFallbackHarnessTransport(error){const status=Number(error?.status)||0;const message=String(error?.message||'');if(status===401||status===403||status===429)return false;
    // Die Harness-Sperre ist eine Zugangsentscheidung des Gateways, kein Transportproblem:
    // ein anderer Transportpfad kann sie nicht aufloesen. Fehler durchreichen, damit die
    // Ausfuehrung auf ein freigegebenes Modell ausweichen kann.
    if(isHarnessGateError(error))return false;
    if(/agentic harness/i.test(message))return true;if(/failed to fetch|networkerror|network error|cors|load failed|fetch failed/i.test(message))return true;if(error instanceof TypeError&&status===0)return true;return status===404||status===405||status===415||status===422||status>=500;}
  function shouldPreferChatHarness(protocol,responsesTransportFailed=false){return String(protocol||'').toLowerCase()==='file:'||Boolean(responsesTransportFailed);}

  function systemPrompt(structured){return `Du bearbeitest einen radiologischen Befund im kompakten Prof.-Schäfer-Stil.\nREGELN:\n1. Ändere ausschließlich die vom Benutzer verlangten medizinischen Sachverhalte.\n2. Erhalte alle übrigen Befundtatsachen semantisch: Lateralisierung, Lokalisation, Maße, Anzahl, Vergleichsdynamik, diagnostische Sicherheit und relevante Negativbefunde.\n3. Erfinde keine Pathologie, Voruntersuchung, Methodik oder Empfehlung.\n4. Befund und Beurteilung müssen konsistent sein.\n5. Unsicherheitsgrade wie V. a., suspekt, am ehesten dürfen nicht eigenmächtig verstärkt oder abgeschwächt werden.\n6. Formuliere kompakt, präzise, radiologisch; keine Erläuterungen außerhalb der vorgesehenen Felder.\n${structured?'Antworte strikt im vorgegebenen JSON-Schema.':'Antworte möglichst strukturiert. Wenn kein Tool oder JSON-Schema erzwungen ist, verwende bevorzugt:\n===BEFUND===\n...\n===BEURTEILUNG===\n...\n===ÄNDERUNGEN===\n...\n===BEWAHRT===\n...\n===KONFLIKTE===\n...'}`;}
  function userPrompt(context,instruction){return `KONTEXT\nModalität: ${context.modality||'–'}\nRegion: ${context.region||'–'}\nThema: ${context.theme||'–'}\nFragestellung: ${context.question||'–'}\n\nAUSGANGSBEFUND\n${context.findings||''}\n\nAUSGANGSBEURTEILUNG\n${context.impression||''}\n\nÄNDERUNGSANWEISUNG\n${instruction}`;}
  function providerSettings(settings,requireParameters=false){const s=normalizeSettings(settings);const provider={};if(s.denyDataCollection)provider.data_collection='deny';if(s.requireZdr)provider.zdr=true;if(requireParameters)provider.require_parameters=true;return provider;}
  function buildEditRequest(context,instruction,model,settings={}){
    const s=normalizeSettings(settings); const structured=Boolean(model?.supportsStructured);
    const body={model:model?.id||s.modelId,messages:[{role:'system',content:systemPrompt(structured)},{role:'user',content:userPrompt(context,instruction)}],temperature:s.temperature,max_tokens:s.maxTokens};
    const provider=providerSettings(s,structured);
    if(structured)body.response_format={type:'json_schema',json_schema:{name:'radiology_edit',strict:true,schema:OUTPUT_SCHEMA}};
    if(Object.keys(provider).length)body.provider=provider; return body;
  }

  const TOOL_PARAMETERS={...OUTPUT_SCHEMA,description:'Vollständige radiologische Befundtransformation. Befund und Beurteilung müssen beide vollständig enthalten sein.'};
  const HARNESS_TOOLS=[
    {type:'function',function:{name:'review_radiology_edit',description:'Prüfe einen vollständigen Befundentwurf gegen Ausgangsbefund und Änderungsanweisung. Liefere den vollständigen Entwurf strukturiert zur lokalen Konsistenzprüfung.',parameters:TOOL_PARAMETERS}},
    {type:'function',function:{name:'submit_radiology_edit',description:'Reiche nach der lokalen Prüfung die vollständige finale Befundfassung ein. Muss vollständigen Befund und vollständige Beurteilung enthalten.',parameters:TOOL_PARAMETERS}}
  ];
  function buildHarnessRequest(context,instruction,model,settings={},stage='review'){
    const s=normalizeSettings(settings);const name=stage==='submit'?'submit_radiology_edit':'review_radiology_edit';
    const body={model:model?.id||s.modelId,messages:[{role:'system',content:systemPrompt(false)+'\nDu arbeitest in einem agentischen Harness. Verwende das angeforderte Tool; gib die vollständige Fassung in dessen Argumenten aus.'},{role:'user',content:userPrompt(context,instruction)}],temperature:s.temperature,max_tokens:s.maxTokens,parallel_tool_calls:false,tools:HARNESS_TOOLS,tool_choice:{type:'function',function:{name}}};
    const provider=providerSettings(s,false);if(Object.keys(provider).length)body.provider=provider;return body;
  }
  function normalizeToolCall(call){if(!call)return null;if(call.function)return {id:call.id||call.call_id||'call_local',type:'function',function:{name:String(call.function.name||''),arguments:typeof call.function.arguments==='string'?call.function.arguments:JSON.stringify(call.function.arguments||{})}};return {id:call.id||call.call_id||'call_local',type:'function',function:{name:String(call.name||''),arguments:typeof call.arguments==='string'?call.arguments:JSON.stringify(call.arguments||{})}};}
  function buildHarnessFollowup(baseRequest,reviewCall,toolResult){const call=normalizeToolCall(reviewCall);if(!call)throw new Error('Agentischer Review-Toolaufruf fehlt.');const body=JSON.parse(JSON.stringify(baseRequest));body.messages.push({role:'assistant',content:null,tool_calls:[call]});body.messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(toolResult||{})});body.tool_choice={type:'function',function:{name:'submit_radiology_edit'}};return body;}


  // OpenRouter Agent SDK uses the OpenResponses API. Harness-only models must use
  // this item-based protocol rather than Chat Completions, even when the logical
  // tool loop is otherwise identical.
  const RESPONSES_HARNESS_TOOLS=HARNESS_TOOLS.map(t=>({
    type:'function',
    name:t.function.name,
    description:t.function.description,
    parameters:t.function.parameters
  }));
  function buildResponsesHarnessRequest(context,instruction,model,settings={},stage='review',sessionId=''){
    const s=normalizeSettings(settings);const name=stage==='submit'?'submit_radiology_edit':'review_radiology_edit';
    const body={
      model:model?.id||s.modelId,
      instructions:systemPrompt(false)+'\nDu arbeitest in einem agentischen Harness auf Basis der OpenResponses API. Verwende zwingend das angeforderte Function-Tool und liefere darin den vollständigen Befund und die vollständige Beurteilung.',
      input:userPrompt(context,instruction),
      temperature:s.temperature,
      max_output_tokens:s.maxTokens,
      parallel_tool_calls:false,
      max_tool_calls:1,
      tools:RESPONSES_HARNESS_TOOLS,
      tool_choice:{type:'function',name}
    };
    if(sessionId)body.session_id=String(sessionId).slice(0,256);
    const provider=providerSettings(s,false);if(Object.keys(provider).length)body.provider=provider;
    return body;
  }
  function responseFunctionCalls(data){return (Array.isArray(data?.output)?data.output:[]).filter(x=>x?.type==='function_call').map(x=>({id:x.id||x.call_id||'call_local',call_id:x.call_id||x.id||'call_local',name:String(x.name||''),arguments:typeof x.arguments==='string'?x.arguments:JSON.stringify(x.arguments||{})}));}
  function buildResponsesHarnessFollowup(baseRequest,previousResponse,toolResult){
    const calls=responseFunctionCalls(previousResponse);const call=calls.find(x=>x.name==='review_radiology_edit')||calls[0];
    if(!call)throw new Error('Agentischer Review-Function-Call fehlt.');
    const body={...JSON.parse(JSON.stringify(baseRequest)),previous_response_id:String(previousResponse?.id||''),input:[{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(toolResult||{})}],tool_choice:{type:'function',name:'submit_radiology_edit'}};
    return body;
  }

  function keyFold(k){return fold(k).replace(/[^a-z0-9]/g,'');}
  function valueByKeys(o,keys){if(!o||typeof o!=='object')return undefined;const wanted=new Set(keys.map(keyFold));for(const [k,v] of Object.entries(o))if(wanted.has(keyFold(k)))return v;return undefined;}
  function asList(v){if(Array.isArray(v))return v.map(String).map(x=>x.trim()).filter(Boolean);if(typeof v==='string')return v.split(/\n|;/).map(x=>x.replace(/^[-•*]\s*/,'').trim()).filter(Boolean);return [];}
  function cleanObj(o){
    if(!o||typeof o!=='object')return {findings:'',impression:'',summary:'',preserved:[],conflicts:[],raw:o};
    const nested=valueByKeys(o,['result','ergebnis','radiology_edit','radiologyedit','output','data']);if(nested&&typeof nested==='object'&&!Array.isArray(nested))o=nested;
    return {findings:String(valueByKeys(o,['findings','befund','befundtext'])||'').trim(),impression:String(valueByKeys(o,['impression','beurteilung','assessment','conclusion'])||'').trim(),summary:String(valueByKeys(o,['summary','änderungen','aenderungen','changes','änderungszusammenfassung','aenderungszusammenfassung'])||'').trim(),preserved:asList(valueByKeys(o,['preserved','bewahrt','erhalten','preserved_facts'])),conflicts:asList(valueByKeys(o,['conflicts','konflikte','warnings','warnungen'])),raw:o};
  }
  function parseAIResponse(content){
    if(content&&typeof content==='object'&&!Array.isArray(content))return cleanObj(content);
    let text=String(content||'').trim(); const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i); if(fenced)text=fenced[1].trim();
    try{const parsed=JSON.parse(text);return cleanObj(parsed);}catch(_){ }
    const normalized=text.replace(/\r/g,'').trim();
    const exact=(label,next)=>{const tail=next?`(?====${next}===|$)`:'$';const re=new RegExp(`===${label}===\\s*([\\s\\S]*?)${tail}`,'i');return (normalized.match(re)?.[1]||'').trim();};
    const exactFindings=exact('BEFUND','BEURTEILUNG'),exactImpression=exact('BEURTEILUNG','ÄNDERUNGEN'),exactSummary=exact('ÄNDERUNGEN','BEWAHRT'),exactPreserved=exact('BEWAHRT','KONFLIKTE'),exactConflicts=exact('KONFLIKTE');
    if(exactFindings||exactImpression)return {findings:exactFindings,impression:exactImpression,summary:exactSummary,preserved:asList(exactPreserved),conflicts:asList(exactConflicts),raw:text};

    // Headings may contain markdown, inline colons and modifiers such as
    // "Befund (angepasst):". Accept these without requiring a specific model.
    const labels={
      findings:['BEFUND','FINDINGS','RADIOLOGISCHER BEFUND'],
      impression:['BEURTEILUNG','IMPRESSION','ASSESSMENT','CONCLUSION','ZUSAMMENFASSUNG'],
      summary:['ÄNDERUNGEN','AENDERUNGEN','CHANGES','CHANGE SUMMARY','ÄNDERUNGSZUSAMMENFASSUNG'],
      preserved:['BEWAHRT','PRESERVED','ERHALTEN'],
      conflicts:['KONFLIKTE','CONFLICTS','WARNUNGEN','WARNINGS']
    };
    const escRe=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const markerPattern=Object.values(labels).flat().map(escRe).sort((a,b)=>b.length-a.length).join('|');
    const markerRe=new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*{1,2})?(${markerPattern})(?:\\*{1,2})?(?:\\s*\\([^\\n)]{0,50}\\))?\\s*[:\\-–—]?\\s*`, 'ig');
    const matches=[...normalized.matchAll(markerRe)];
    if(matches.length){
      const sections={findings:'',impression:'',summary:'',preserved:'',conflicts:''};
      const kindFor=label=>Object.entries(labels).find(([,arr])=>arr.some(x=>fold(x)===fold(label)))?.[0]||'';
      for(let i=0;i<matches.length;i++){
        const kind=kindFor(matches[i][1]);if(!kind)continue;
        const a=(matches[i].index||0)+matches[i][0].length,b=i+1< matches.length?(matches[i+1].index||normalized.length):normalized.length;
        sections[kind]=normalized.slice(a,b).trim();
      }
      if(sections.findings||sections.impression)return {findings:sections.findings,impression:sections.impression,summary:sections.summary,preserved:asList(sections.preserved),conflicts:asList(sections.conflicts),raw:text};
    }

    // Last-resort report heuristic: many models return the full report as two
    // unlabeled paragraphs. Only infer an impression when the last paragraph
    // starts with a conventional radiological assessment phrase.
    const paragraphs=normalized.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
    if(paragraphs.length>=2){
      const last=paragraphs[paragraphs.length-1];
      const impressionCue=/^(?:kein(?:e|en|er|es)?\s+(?:nachweis|hinweis)|keine\s+hinweise|hinweis\s+auf|nachweis\s+(?:eines|einer|von)|v\.?\s*a\.?|verdacht\s+auf|suspekt|unauff[aä]llig|regelrecht|zusammenfassend|befundkonstellation|vereinbar\s+mit|am\s+ehesten)/i;
      if(impressionCue.test(last))return {findings:paragraphs.slice(0,-1).join('\n\n'),impression:last,summary:'',preserved:[],conflicts:[],raw:text,inferredSections:true};
    }
    return {findings:'',impression:'',summary:'',preserved:[],conflicts:[],raw:text,unstructured:Boolean(normalized)};
  }
  function toolCallsFromResponse(data){const chat=data?.choices?.[0]?.message?.tool_calls||[];const responses=Array.isArray(data?.output)?data.output.filter(x=>x?.type==='function_call'):[];return [...chat,...responses].map(normalizeToolCall).filter(Boolean);}
  function extractAIResult(data,preferredTool='submit_radiology_edit'){
    const calls=toolCallsFromResponse(data);const chosen=calls.find(c=>c.function.name===preferredTool)||calls.find(c=>c.function.name==='review_radiology_edit')||calls[0];if(chosen){try{return cleanObj(JSON.parse(chosen.function.arguments||'{}'));}catch(_){return parseAIResponse(chosen.function.arguments||'');}}
    const c=data?.choices?.[0]?.message?.content;if(Array.isArray(c)){const text=c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('\n');return parseAIResponse(text);}if(typeof c==='string')return parseAIResponse(c);
    if(typeof data?.output_text==='string')return parseAIResponse(data.output_text);
    if(Array.isArray(data?.output)){const text=data.output.flatMap(x=>Array.isArray(x?.content)?x.content:[]).map(x=>x?.text||'').filter(Boolean).join('\n');if(text)return parseAIResponse(text);}
    return parseAIResponse('');
  }
  function completeAIResult(parsed,original){const source=parsed||{};const p=cleanObj(source);const warnings=[];let findings=p.findings,impression=p.impression;if(!findings&&impression){findings=String(original?.findings||'');warnings.push({type:'parser_preserved_findings',label:'Befund aus Ausgangsvorlage beibehalten',detail:'Das Modell lieferte keinen separat parsbaren Befund; der Ausgangsbefund wurde unverändert übernommen.',instructionBacked:false,severity:'high'});}if(!impression&&findings){impression=String(original?.impression||'');warnings.push({type:'parser_preserved_impression',label:'Beurteilung aus Ausgangsvorlage beibehalten',detail:'Das Modell lieferte keine separat parsbare Beurteilung; die Ausgangsbeurteilung wurde unverändert übernommen.',instructionBacked:false,severity:'high'});}if(!findings&&!impression&&String(source?.raw||p.raw||'').trim()){findings=String(original?.findings||'');impression=String(original?.impression||'');warnings.push({type:'parser_unstructured_response',label:'Unstrukturierte Modellantwort abgefangen',detail:'Die Modellantwort enthielt keine sicher trennbaren Befund-/Beurteilungssektionen. Die Ausgangsvorlage wurde deshalb unverändert bewahrt; der Workflow kann einen Format-Reparaturpass ausführen.',instructionBacked:false,severity:'high'});}return {result:{...p,findings,impression},warnings,complete:Boolean(findings&&impression),needsRepair:warnings.some(w=>/^parser_/.test(w.type))};}


  const LAT={rechts:/\b(rechts?|rechten?|rechter|rechte|re\.?)\b/i,links:/\b(links?|linken?|linker|linke|li\.?)\b/i,bilateral:/\b(beidseits|bds\.?|bilateral)\b/i};
  function cats(text,map){return Object.entries(map).filter(([,re])=>re.test(text)).map(([k])=>k);}
  function extractNumbers(text){return Array.from(String(text||'').matchAll(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|l|%|°|grad)?\b/gi),m=>m[0].replace(/\s+/g,' ').trim().toLowerCase());}
  function instructionHas(instruction,value){return fold(instruction).includes(fold(value));}
  function warning(type,label,detail,instructionBacked=false,severity='warning'){return {type,label,detail,instructionBacked,severity};}
  function analyzeConsistency(original,revised,instruction=''){
    const o=`${original?.findings||''} ${original?.impression||''}`;const r=`${revised?.findings||''} ${revised?.impression||''}`;const out=[];
    const ol=cats(o,LAT),rl=cats(r,LAT); if(ol.join('|')!==rl.join('|')){const changed=[...new Set([...ol,...rl])].filter(x=>!ol.includes(x)||!rl.includes(x));out.push(warning('laterality_change','Lateralisierung verändert',`${ol.join(', ')||'–'} → ${rl.join(', ')||'–'}`,changed.some(x=>instructionHas(instruction,x))));}
    const on=extractNumbers(o),rn=extractNumbers(r); if(on.join('|')!==rn.join('|')){const newVals=rn.filter(x=>!on.includes(x));const removed=on.filter(x=>!rn.includes(x));out.push(warning('number_change','Zahl/Maß verändert',`${removed.join(', ')||'–'} → ${newVals.join(', ')||'–'}`,newVals.concat(removed).some(x=>instructionHas(instruction,x))));}
    const neg=/\b(kein(?:e|en|er|es)?|ohne|nicht|unauffällig|regelrecht)\b/gi;const oc=(o.match(neg)||[]).length,rc=(r.match(neg)||[]).length;if(oc!==rc)out.push(warning('negation_change','Negation verändert',`${oc} → ${rc} Negationsmarker`,/\b(kein|ohne|nicht|normal|unauff|regelrecht)\b/i.test(instruction)));
    const certainty={suspicious:/\b(v\.?\s*a\.?|verdacht|suspekt|am ehesten|wahrscheinlich)\b/i,certain:/\b(gesichert|nachweis(?:bar)?|beweisend)\b/i};const ocert=cats(o,certainty),rcert=cats(r,certainty);if(ocert.join('|')!==rcert.join('|'))out.push(warning('certainty_change','Diagnostische Sicherheit verändert',`${ocert.join(', ')||'–'} → ${rcert.join(', ')||'–'}`,/verdacht|suspekt|gesichert|sicher|wahrscheinlich/i.test(instruction)));
    const comp=/\b(voruntersuch|vergleich|progredient|regredient|konstant|unverändert|verlaufs?)\w*/i;if(!comp.test(o)&&comp.test(r)&&!comp.test(instruction))out.push(warning('comparison_invented','Vergleich/Verlauf neu eingeführt','Im Ausgangstext nicht vorhanden.',false,'high'));
    const fl=cats(revised?.findings||'',LAT),il=cats(revised?.impression||'',LAT);if(fl.length&&il.length&&!fl.some(x=>il.includes(x)))out.push(warning('section_conflict','Befund/Beurteilung widersprüchlich',`Befund: ${fl.join(', ')} · Beurteilung: ${il.join(', ')}`,false,'high'));
    const sectionPolarity=(text)=>{const t=String(text||'');const negative=/\b(kein(?:e|en|er|es)?|ohne|nicht|unauffällig|regelrecht)\b/i.test(t);const positive=/\b(nachweisbar|nachweis eines|vorhanden|suspekt|pathologisch|progredient|metastase|raumforderung|ruptur|fraktur|entzündung|abszess)\b/i.test(t);return {negative,positive};};
    const fp=sectionPolarity(revised?.findings||''),ip=sectionPolarity(revised?.impression||'');
    if((fp.negative&&!fp.positive&&ip.positive&&!ip.negative)||(ip.negative&&!ip.positive&&fp.positive&&!fp.negative))out.push(warning('section_negation_conflict','Negationskonflikt zwischen Befund und Beurteilung','Eine Sektion ist überwiegend negativ formuliert, die andere enthält eine positive pathologische Aussage.',false,'high'));
    return out;
  }

  function tokenize(text){return String(text||'').match(/\s+|[\p{L}\p{N}]+(?:[.,]\d+)?|[^\s\p{L}\p{N}]/gu)||[];}
  function buildSemanticDiff(a,b){const A=tokenize(a),B=tokenize(b);if(A.length*B.length>2_000_000)return [{type:'remove',text:String(a||'')},{type:'add',text:String(b||'')}];const rows=Array.from({length:A.length+1},()=>new Uint16Array(B.length+1));for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)rows[i][j]=A[i]===B[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);let i=0,j=0,parts=[];const push=(type,text)=>{const last=parts[parts.length-1];if(last&&last.type===type)last.text+=text;else parts.push({type,text});};while(i<A.length&&j<B.length){if(A[i]===B[j]){push('same',A[i]);i++;j++;}else if(rows[i+1][j]>=rows[i][j+1]){push('remove',A[i++]);}else push('add',B[j++]);}while(i<A.length)push('remove',A[i++]);while(j<B.length)push('add',B[j++]);return parts;}

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function createVersionStore(original){const base={...clone(original),version:0,label:'Original'};let versions=[base],index=0;return {current:()=>clone(versions[index]),add(v){versions=versions.slice(0,index+1);versions.push({...clone(v),version:versions.length,label:`V${versions.length}`});index=versions.length-1;return this.current();},undo(){if(index>0)index--;return this.current();},redo(){if(index<versions.length-1)index++;return this.current();},reset(){index=0;return this.current();},goTo(i){const n=Number(i);if(Number.isInteger(n)&&n>=0&&n<versions.length)index=n;return this.current();},snapshot(){return {versions:clone(versions),index};},canUndo:()=>index>0,canRedo:()=>index<versions.length-1};}

  return Object.freeze({DEFAULT_MODEL,FALLBACK_MODEL_IDS,HARNESS_GATED_IDS,isHarnessGateError,isHarnessGatedModel,isGatedId,pickFallbackModel,OUTPUT_SCHEMA,HARNESS_TOOLS,RESPONSES_HARNESS_TOOLS,isFreeModel,normalizeModel,sortModels,filterModels,formatPricePerMillion,normalizeSettings,shouldFallbackHarnessTransport,shouldPreferChatHarness,buildEditRequest,buildHarnessRequest,buildHarnessFollowup,buildResponsesHarnessRequest,buildResponsesHarnessFollowup,responseFunctionCalls,parseAIResponse,extractAIResult,completeAIResult,analyzeConsistency,buildSemanticDiff,createVersionStore});
}));
