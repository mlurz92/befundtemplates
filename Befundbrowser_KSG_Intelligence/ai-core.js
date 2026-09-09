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
  // Bevorzugte freie Ausweichmodelle. Die Reihenfolge stammt aus einer Messung
  // aller kostenlosen OpenRouter-Modelle mit der echten Aufgabe dieser Anwendung
  // (siehe README, Abschnitt 10) und nicht aus den Katalogangaben: Modelle, die
  // `response_format` und `tools` fuehren, halten das Format haeufig trotzdem
  // nicht ein. Die beiden Gemma-4-Endpunkte standen im Katalog, antworteten beim
  // Aufruf aber mit HTTP 404 und sind deshalb entfernt.
  const FALLBACK_MODEL_IDS = [
    'inclusionai/ling-3.0-flash-sante:free',                 // schnellste brauchbare Antwort, medizinisch getunt
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nex-agi/nex-n2.5-pro:free',
    'nex-agi/nex-n2.5-mini:free',
    'nvidia/nemotron-3-super-120b-a12b:free'                 // nur ueber den Reparaturpass brauchbar
  ];
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
  // OpenRouter beantwortet nicht bedienbare Parameterkombinationen und durch die
  // Datenschutzeinstellung ausgeschlossene Anbieter mit HTTP 404 statt mit einer
  // Modellfehlermeldung. Das ist kein Transportproblem, sondern heisst: dieses
  // Modell ist unter den aktuellen Bedingungen nicht erreichbar.
  function isNotRoutableError(error){
    const message=`${error?.message||''} ${error?.openRouter?.message||''}`;
    return Number(error?.status)===404
      || /no endpoints? (?:found|available)/i.test(message)
      || /data policy|guardrail restrictions/i.test(message);
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

  // Stilanker aus der quantitativen Auswertung des 11.796-Befunde-Korpus:
  // Befundsatz median 6 Woerter (P90 17), Beurteilungssatz median 4 (P90 13),
  // Beurteilung rund 14 % der Befundlaenge. Es sind Richtwerte, keine Quoten.
  const STYLE_RULES = [
    'Kompakte, informationsdichte Prosa; häufig nominaler Stil. In der Regel eine eigenständige diagnostische Aussage pro Satz.',
    'Satzlänge: Befund typischerweise 6 bis 17 Wörter, Beurteilung 4 bis 13. Längere Sätze auf trennbare Einzelaussagen prüfen.',
    'Die Beurteilung ist deutlich stärker verdichtet als der Befund (Richtwert etwa ein Siebtel der Länge) und wiederholt ihn nicht Satz für Satz.',
    'Diagnostisches Ziel und ein gültiger Vergleich stehen früh; die Antwort auf die Fragestellung wird nicht hinter einem Normalbefund-Inventar vergraben.',
    'Maße stehen unmittelbar bei dem Befund, den sie quantifizieren.',
    'Negationslogik strikt trennen: "Kein Nachweis ..." bedeutet die direkte Nichtdarstellung der genannten Struktur, "Keine Hinweise auf ..." das Fehlen von Zeichen eines Prozesses. Die beiden Wendungen sind keine Synonyme.',
    'Unabhängige Aussagen nicht mechanisch mit "und" verketten: getrennte kurze Sätze oder eine knappe Parallelkonstruktion. "und" bleibt dort, wo die Grammatik es verlangt.',
    'Echte medizinische Schrägstrich-Notation bleibt erhalten (C5/6, LWK 5/SWK 1, ng/ml).',
    'Keine Lehrbuchprosa, keine Füllwörter, keine Wiederholung der Fragestellung im Befundtext.',
    'Verboten, weil im Korpus praktisch nicht vorkommend: "Es zeigt sich"/"Es zeigen sich" (2 von 11.796 Befunden), "Kein Anhalt für" (0), "Zusammenfassend" in der Beurteilung (0), "DD:" mit Doppelpunkt (1; ausschreiben als "Differenzialdiagnostisch"), Maßangaben mit Dezimalpunkt (0; immer Komma, etwa 1,3 cm), hochgestelltes Hoch-minus-drei (0; korpustypisch ist "x 10-3 mm²/s").',
    'Erlaubt und korpustypisch, also nicht "korrigieren": "Es finden sich" (62 Befunde), "Es besteht/bestehen" (284), "DD" ohne Doppelpunkt (157), "metastasenverdächtig" (772).',
    'Im Fließtext überwiegt "Herd" gegenüber "Läsion" (2.278 zu 1.251 Nennungen); direkte Lokalisation statt "Im Bereich des/der" (nur 61 von 11.796 Befunden).'
  ];
  const EDIT_RULES = [
    'Ändere ausschließlich die medizinischen Sachverhalte, die die Anweisung verlangt.',
    'Erhalte jede übrige Befundtatsache semantisch exakt: Seitenangabe, Lokalisation, Segment, Maße, Anzahl, Vergleichsdynamik (neu, konstant, regredient, progredient), diagnostische Sicherheit und relevante Negativbefunde.',
    'Erfinde nichts hinzu: keine Pathologie, keine Voruntersuchung, kein Vergleichsintervall, keine Methodik, keine Sequenzliste, keine Serien- oder Bildnummer, keine Empfehlung, kein Normalbefund-Inventar.',
    'Unsicherheitsgrade (V. a., suspekt, am ehesten, DD) werden weder verstärkt noch abgeschwächt, sofern die Anweisung das nicht ausdrücklich verlangt.',
    'Befund und Beurteilung müssen widerspruchsfrei sein: Was die Anweisung im Befund ändert, ist in der Beurteilung nachzuführen, sofern es dort überhaupt vorkommt.',
    'Gib immer den vollständigen Befund und die vollständige Beurteilung aus, nicht nur die geänderte Passage.'
  ];
  const OUTPUT_FALLBACK = 'Antworte möglichst strukturiert. Wenn kein Tool und kein JSON-Schema erzwungen ist, verwende:\n===BEFUND===\n...\n===BEURTEILUNG===\n...\n===ÄNDERUNGEN===\n...\n===BEWAHRT===\n...\n===KONFLIKTE===\n...';

  function numbered(items){return items.map((item,index)=>`${index+1}. ${item}`).join('\n');}
  function systemPrompt(structured){
    return [
      'Du bearbeitest eine radiologische Befundvorlage im kompakten Prof.-Schäfer-Stil.',
      'Der medizinische Inhalt hat Vorrang vor dem Stil: Ändere niemals eine medizinische Aussage, nur damit sie stilistisch besser passt.',
      '',
      'ÄNDERUNGSREGELN',
      numbered(EDIT_RULES),
      '',
      'STILREGELN',
      numbered(STYLE_RULES),
      '',
      'AUSGABE',
      structured ? 'Antworte strikt im vorgegebenen JSON-Schema.' : OUTPUT_FALLBACK,
      '',
      'Vor der Ausgabe prüfst du still ab: Ist jede Seitenangabe, jedes Maß, jede Zahl, jede Vergleichsangabe und jeder Sicherheitsgrad entweder unverändert oder von der Anweisung ausdrücklich verlangt? Korrigiere jede Abweichung, bevor du antwortest.'
    ].join('\n');
  }
  // Echte Korpusbefunde derselben Gruppe als Stilreferenz. Regeln allein reichen
  // nicht: Der Stil ist an Beispielen deutlich zuverlaessiger zu treffen. Die
  // Beispiele liefern ausschliesslich Formulierung, Satzbau und Reihenfolge -
  // niemals einen Befundinhalt. Das ist im Prompt ausdruecklich gesagt und wird
  // durch den Consistency Guard zusaetzlich abgesichert.
  const STYLE_EXAMPLE_LIMIT = 3;
  const STYLE_EXAMPLE_MAX_WORDS = 130;
  function formatStyleExamples(examples){
    const usable=(examples||[])
      .filter(x=>x&&x.findings&&x.impression)
      .filter(x=>wordCount(x.findings)<=STYLE_EXAMPLE_MAX_WORDS)
      .slice(0,STYLE_EXAMPLE_LIMIT);
    if(!usable.length)return '';
    const blocks=usable.map((x,index)=>[
      `BEISPIEL ${index+1}`,
      `Befund: ${String(x.findings).trim()}`,
      `Beurteilung: ${String(x.impression).trim()}`
    ].join('\n'));
    return [
      'STILREFERENZEN AUS DEM KORPUS',
      'Die folgenden Befunde stammen aus derselben Untersuchungsgruppe. Sie zeigen ausschließlich,',
      'WIE formuliert wird: Satzlänge, Reihenfolge, Negationsformen, Grad der Verdichtung.',
      'Übernimm daraus keinen einzigen medizinischen Sachverhalt, keine Seitenangabe, kein Maß,',
      'keine Voruntersuchung und keine Empfehlung. Inhalt kommt ausschließlich aus dem Ausgangsbefund',
      'und der Änderungsanweisung.',
      '',
      blocks.join('\n\n')
    ].join('\n');
  }

  function userPrompt(context,instruction){
    const lines = [
      'KONTEXT DER VORLAGE',
      `Modalität: ${context.modality||'–'}`,
      `Untersuchungsregion: ${context.region||'–'}`,
      `Klinische Angaben (Kategorie): ${context.theme||'–'}`,
      `Fragestellung (Kategorie): ${context.question||'–'}`
    ];
    if(context.clinical)lines.push(`Klinische Angaben im Original: ${context.clinical}`);
    if(context.questionRaw)lines.push(`Fragestellung im Original: ${context.questionRaw}`);
    if(context.title)lines.push(`Untersuchung: ${context.title}`);
    const examples=formatStyleExamples(context.styleExamples);
    if(examples)lines.push('',examples);
    lines.push('','AUSGANGSBEFUND',String(context.findings||'').trim()||'–');
    lines.push('','AUSGANGSBEURTEILUNG',String(context.impression||'').trim()||'–');
    lines.push('','ÄNDERUNGSANWEISUNG DES BEFUNDERS',String(instruction||'').trim());
    return lines.join('\n');
  }
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
  // ==========================================================================
  // Stil-Engine
  //
  // Die Stilanker stammen aus der quantitativen Auswertung des 11.796-Befunde-
  // Korpus: Befundsatz Median 6 Woerter (P90 17), Beurteilungssatz Median 4
  // (P90 13), Beurteilung rund 14 % der Befundlaenge. Es sind Richtwerte, keine
  // Quoten - ein klinisch notwendiger Satz darf laenger sein. Die Engine prueft
  // deshalb auf Ausreisser und meldet, sie erzwingt keine Zahlen.
  // ==========================================================================
  // Perzentile aus der Vermessung aller 104.043 Befund- und 18.621
  // Beurteilungssaetze des Korpus. Die Schwellen sind gemessen, nicht gegriffen:
  // Befund   Median 6 | P75 11 | P90 17 | P95 22 | P99 32
  // Beurteil. Median 4 | P75  8 | P90 13 | P95 16 | P99 24
  // Verhaeltnis Beurteilung/Befund  Median 0,14 | P90 0,32 | P95 0,38
  const STYLE_LIMITS = {
    findingsP90: 17, findingsSoft: 22, findingsHard: 32,
    impressionP90: 13, impressionSoft: 16, impressionHard: 24,
    impressionRatio: 0.38
  };

  // Wendungen, die im Gesamtkorpus praktisch nicht vorkommen. Sie sind damit
  // kein Geschmacksurteil, sondern eine messbare Stilverletzung. Gemessen ueber
  // Befund und Beurteilung aller 11.796 Datensaetze:
  //   "Es zeigt sich/zeigen sich"  2 | "Kein Anhalt fuer"  0 | "Zusammenfassend" 0
  //   Mass mit Dezimalpunkt        0 | hochgestelltes 10^-3 0 | "DD:"            1
  // Nicht verboten und deshalb hier nicht gelistet: "Es finden sich" (62),
  // "Es besteht/bestehen" (284) und "DD" ohne Doppelpunkt (157).
  const FORBIDDEN_PATTERNS = [
    [/\bEs (?:zeigt|zeigen) sich\b/gi, 'Es zeigt sich', 'Direkt benennen: „Riss im Hinterhorn …" statt „Es zeigt sich ein Riss …".'],
    [/\bKein(?:e[nrs]?)? Anhalt für\b/gi, 'Kein Anhalt für', 'Korpustypisch sind „Kein Nachweis …" und „Keine Hinweise auf …".'],
    [/\bZusammenfassend\b/gi, 'Zusammenfassend', 'Die Beurteilung beginnt mit der Diagnose, nicht mit einer Überleitung.'],
    [/\bDD\s*:/g, 'DD:', 'Ausschreiben: „Differenzialdiagnostisch …".']
  ];

  // Im Korpus selten, aber vorhanden - deshalb Hinweis statt Verbot.
  // "Im Bereich des/der" 61 Befunde | "Läsion" 974 | "leider" 67
  const DISCOURAGED_PATTERNS = [
    [/\bIm Bereich (?:des|der|von)\b/gi, 'Im Bereich des/der', 'Direkte Lokalisation ist korpustypischer (61 von 11.796 Befunden).'],
    [/\bLäsion(?:en)?\b/g, 'Läsion', 'Im Fließtext überwiegt „Herd" (2.278 gegenüber 1.251 Nennungen).']
  ];

  // Wendungen, die im Korpus nicht vorkommen und Lehrbuchprosa markieren.
  const FILLER_PATTERNS = [
    [/\bes (?:zeigt|zeigen) sich (?:hier|dabei|nunmehr)\b/gi, 'Fuellkonstruktion'],
    [/\bwie (?:bereits )?(?:oben |zuvor )?(?:erwaehnt|erwähnt|beschrieben)\b/gi, 'Rueckverweis'],
    [/\b(?:des Weiteren|darüber hinaus|ferner|zudem noch|letztendlich|grundsätzlich|bekanntermassen|bekanntermaßen)\b/gi, 'Uebergangsfloskel'],
    [/\bist (?:sehr )?(?:gut|deutlich) (?:zu erkennen|erkennbar|sichtbar)\b/gi, 'Beobachterformel'],
    [/\bin der vorliegenden Untersuchung\b/gi, 'Selbstbezug'],
    [/\b(?:zusammenfassend|abschliessend|abschließend) (?:lässt sich|kann) \w+/gi, 'Essayformel'],
    [/\bes (?:ist|wäre) (?:festzuhalten|anzumerken|zu erwähnen)\b/gi, 'Essayformel'],
    [/\bkann nicht ausgeschlossen werden, dass\b/gi, 'Weichmacher']
  ];

  // "Kein Nachweis" bezeichnet die Nichtdarstellung einer Struktur,
  // "Keine Hinweise auf" das Fehlen von Zeichen eines Prozesses.
  const PROCESS_NOUNS = /(entzündung|infektion|infekt|malignität|metastasierung|blutung|ischämie|rezidivierung|progression|reaktivierung|abszedierung|dissemination)/i;
  const STRUCTURE_NOUNS = /(fraktur|erguss|zyste|herd|raumforderung|läsion|stenose|thrombus|konkrement|osteolyse|rundherd|infiltrat)/i;

  function splitSentences(text){
    return String(text||'')
      .split(/(?<=[.!?])\s+/)
      .map(part=>part.trim())
      .filter(Boolean);
  }
  function wordCount(sentence){return (String(sentence||'').match(/[\wÄÖÜäöüßäöüß-]+/g)||[]).length;}
  function median(values){
    if(!values.length)return 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    const mid=sorted.length>>1;
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  }
  function percentile(values,p){
    if(!values.length)return 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    return sorted[Math.min(sorted.length-1,Math.floor(p*sorted.length))];
  }

  function styleMetrics(findings,impression){
    const f=splitSentences(findings).map(wordCount);
    const i=splitSentences(impression).map(wordCount);
    const fw=f.reduce((a,b)=>a+b,0), iw=i.reduce((a,b)=>a+b,0);
    return {
      findingsSentences:f.length, impressionSentences:i.length,
      findingsWords:fw, impressionWords:iw,
      findingsMedian:median(f), impressionMedian:median(i),
      findingsP90:percentile(f,0.9), impressionP90:percentile(i,0.9),
      findingsMax:f.length?Math.max(...f):0, impressionMax:i.length?Math.max(...i):0,
      ratio:fw?Number((iw/fw).toFixed(2)):0
    };
  }

  function styleFinding(type,label,detail,severity='warning'){return {type,label,detail,severity};}
  function combinedText(findings,impression){return `${findings||''} ${impression||''}`;}

  // Prueft eine Fassung gegen die Korpus-Stilanker. Liefert konkrete, dem Modell
  // wieder vorlegbare Beanstandungen - keine Punktzahl.
  function analyzeStyle(findings,impression){
    const out=[];
    const metrics=styleMetrics(findings,impression);

    for(const sentence of splitSentences(findings)){
      const words=wordCount(sentence);
      if(words>STYLE_LIMITS.findingsHard){
        out.push(styleFinding('sentence_too_long','Befundsatz länger als jeder Korpussatz üblicher Länge',
          `${words} Wörter, Korpus-P99 ${STYLE_LIMITS.findingsHard}: „${sentence.slice(0,110)}“`,'high'));
      }else if(words>STYLE_LIMITS.findingsSoft&&(/\sund\s/i.test(sentence)||(sentence.match(/,/g)||[]).length>=2)){
        // 47 % der langen Korpussaetze enthalten "und" - allein ist das kein Fehler.
        // Erst oberhalb des 95. Perzentils ist eine Trennung meist moeglich.
        out.push(styleFinding('und_chain','Befundsatz im obersten Korpus-Perzentil',
          `${words} Wörter (Korpus-P95 ${STYLE_LIMITS.findingsSoft}), auf trennbare Einzelaussagen prüfen: „${sentence.slice(0,110)}“`));
      }
    }
    for(const sentence of splitSentences(impression)){
      const words=wordCount(sentence);
      if(words>STYLE_LIMITS.impressionHard){
        out.push(styleFinding('impression_sentence_too_long','Beurteilungssatz deutlich zu lang',
          `${words} Wörter, Korpus-P99 ${STYLE_LIMITS.impressionHard}: „${sentence.slice(0,110)}“`,'high'));
      }else if(words>STYLE_LIMITS.impressionSoft){
        out.push(styleFinding('impression_sentence_long','Beurteilungssatz über dem 95. Perzentil',
          `${words} Wörter (Korpus-P95 ${STYLE_LIMITS.impressionSoft}): „${sentence.slice(0,110)}“`));
      }
    }
    for(const [pattern,label,hint] of FORBIDDEN_PATTERNS){
      const hits=combinedText(findings,impression).match(pattern);
      if(hits)out.push(styleFinding('forbidden_phrase',`Im Korpus praktisch nicht vorkommende Wendung: „${label}“`,
        `${hint} (nahezu kein Vorkommen in 11.796 Korpusbefunden)`,'high'));
    }
    for(const [pattern,label,hint] of DISCOURAGED_PATTERNS){
      const hits=combinedText(findings,impression).match(pattern);
      if(hits)out.push(styleFinding('discouraged_phrase',`Untypische Wendung: „${label}“`,hint));
    }
    if(metrics.findingsWords>=40&&metrics.ratio>STYLE_LIMITS.impressionRatio){
      out.push(styleFinding('impression_not_condensed','Beurteilung zu wenig verdichtet',
        `Beurteilung erreicht ${Math.round(metrics.ratio*100)} % der Befundlänge (Korpusmedian 14 %).`,'high'));
    }
    const combined=combinedText(findings,impression);
    for(const [pattern,label] of FILLER_PATTERNS){
      const hits=combined.match(pattern);
      if(hits)out.push(styleFinding('filler',`Nicht korpustypische Wendung (${label})`,
        `„${hits[0]}“ entfernen oder durch eine direkte Aussage ersetzen.`));
    }
    for(const match of combined.matchAll(/Keine\s+Hinweise\s+auf\s+(?:eine[nrs]?\s+|einen\s+)?([\wÄÖÜäöüß-]+)/gi)){
      if(STRUCTURE_NOUNS.test(match[1]))out.push(styleFinding('negation_logic',
        'Negationslogik prüfen',`„Keine Hinweise auf ${match[1]}“ betrifft eine Struktur; korpustypisch ist „Kein Nachweis“.`));
    }
    for(const match of combined.matchAll(/Kein(?:e[nrs]?)?\s+Nachweis\s+(?:von\s+|eine[rs]?\s+|einen\s+)?([\wÄÖÜäöüß-]+)/gi)){
      if(PROCESS_NOUNS.test(match[1]))out.push(styleFinding('negation_logic',
        'Negationslogik prüfen',`„Kein Nachweis ${match[1]}“ betrifft einen Prozess; korpustypisch ist „Keine Hinweise auf“.`));
    }
    if(!String(findings||'').trim())out.push(styleFinding('empty_findings','Befund fehlt','Die Fassung enthält keinen Befundtext.','high'));
    return {metrics,findings:out};
  }

  // Meaning-erhaltende Typografie-Normalisierung. Aendert ausschliesslich
  // Leerzeichen und Satzzeichen, niemals Wortlaut, Zahlen oder Reihenfolge.
  function normalizeTypography(text){
    let out=String(text||'').replace(/ /g,' ');
    out=out.replace(/\s+/g,' ');
    out=out.replace(/\s+([,.;:!?])/g,'$1');
    out=out.replace(/([,;:])(?=[^\s\d])/g,'$1 ');
    out=out.replace(/\.{2,}/g,'.');
    out=out.replace(/(?:,\s*){2,}/g,', ');
    out=out.replace(/\s*-\s*-\s*/g,' – ');
    out=out.replace(/\(\s+/g,'(').replace(/\s+\)/g,')');
    // Dezimalpunkt vor Einheit -> Komma. Im Korpus steht das Komma in 100 % der
    // Faelle; die Ersetzung aendert den Wert nicht, nur seine Schreibweise.
    out=out.replace(/\b(\d+)\.(\d+)(?=\s*(?:cm|mm|m|ml|l|Tesla|T|%|mg|g|kg)\b)/g,'$1,$2');
    // Hochgestellte Exponenten in die Korpusschreibweise ueberfuehren.
    out=out.replace(/10[⁻−]\s*³/g,'10-3').replace(/10\^-3/g,'10-3');
    out=out.replace(/mm²\s*\/\s*s/g,'mm²/s');
    out=out.trim();
    if(out&&!/[.!?:]$/.test(out))out+='.';
    return out;
  }

  // Bittet das Modell um einen reinen Stilkorrekturpass. Der Prompt nennt die
  // konkreten Beanstandungen und verbietet jede inhaltliche Aenderung; die
  // Aufrufseite verwirft das Ergebnis, wenn sich der Inhalt doch bewegt hat.
  function buildStyleRepairRequest(draft,styleReport,model,settings={}){
    const s=normalizeSettings(settings);
    const structured=Boolean(model?.supportsStructured);
    const complaints=styleReport.findings.map((item,index)=>`${index+1}. ${item.label}: ${item.detail}`).join('\n');
    const system=[
      'Du bist ein Stilkorrektor für radiologische Befunde im Prof.-Schäfer-Stil.',
      'Du änderst ausschließlich die Formulierung, niemals den medizinischen Inhalt.',
      '',
      'VERBOTEN',
      '- jede Änderung an Seitenangabe, Lokalisation, Segment, Maß, Zahl, Anzahl, Vergleichsangabe, Sicherheitsgrad oder Negation,',
      '- jedes Weglassen und jedes Hinzufügen einer medizinischen Aussage.',
      '',
      'ERLAUBT',
      '- lange Sätze in mehrere kurze diagnostische Sätze trennen,',
      '- Füllwörter und Übergangsfloskeln streichen,',
      '- die Beurteilung verdichten, ohne eine Aussage zu verlieren,',
      '- „Kein Nachweis“ und „Keine Hinweise auf“ korrekt zuordnen.',
      '',
      structured?'Antworte strikt im vorgegebenen JSON-Schema.':'Antworte im Format ===BEFUND=== / ===BEURTEILUNG=== / ===ÄNDERUNGEN=== / ===BEWAHRT=== / ===KONFLIKTE===.'
    ].join('\n');
    const user=[
      'BEANSTANDUNGEN',complaints,'',
      'BEFUND',String(draft.findings||''),'',
      'BEURTEILUNG',String(draft.impression||''),'',
      'Gib beide Abschnitte vollständig und stilistisch korrigiert zurück. Der medizinische Inhalt bleibt identisch.'
    ].join('\n');
    const body={model:model?.id||s.modelId,messages:[{role:'system',content:system},{role:'user',content:user}],
      temperature:0.1,max_tokens:s.maxTokens};
    if(structured)body.response_format={type:'json_schema',json_schema:{name:'radiology_style_fix',strict:true,schema:OUTPUT_SCHEMA}};
    const provider=providerSettings(s,structured);
    if(Object.keys(provider).length)body.provider=provider;
    return body;
  }

  // Ein Stilkorrekturpass darf den Inhalt nicht bewegen. Geprueft wird mit
  // demselben Consistency Guard, der auch die KI-Aenderung absichert.
  function styleRepairIsSafe(before,after){
    const conflicts=analyzeConsistency(before,after,'').filter(item=>(
      item.type==='laterality_change'||item.type==='number_change'||item.type==='negation_change'
      ||item.type==='certainty_change'||item.type==='comparison_invented'
    ));
    return {safe:conflicts.length===0,conflicts};
  }

  function buildSemanticDiff(a,b){const A=tokenize(a),B=tokenize(b);if(A.length*B.length>2_000_000)return [{type:'remove',text:String(a||'')},{type:'add',text:String(b||'')}];const rows=Array.from({length:A.length+1},()=>new Uint16Array(B.length+1));for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)rows[i][j]=A[i]===B[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);let i=0,j=0,parts=[];const push=(type,text)=>{const last=parts[parts.length-1];if(last&&last.type===type)last.text+=text;else parts.push({type,text});};while(i<A.length&&j<B.length){if(A[i]===B[j]){push('same',A[i]);i++;j++;}else if(rows[i+1][j]>=rows[i][j+1]){push('remove',A[i++]);}else push('add',B[j++]);}while(i<A.length)push('remove',A[i++]);while(j<B.length)push('add',B[j++]);return parts;}

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function createVersionStore(original){const base={...clone(original),version:0,label:'Original'};let versions=[base],index=0;return {current:()=>clone(versions[index]),add(v){versions=versions.slice(0,index+1);versions.push({...clone(v),version:versions.length,label:`V${versions.length}`});index=versions.length-1;return this.current();},undo(){if(index>0)index--;return this.current();},redo(){if(index<versions.length-1)index++;return this.current();},reset(){index=0;return this.current();},goTo(i){const n=Number(i);if(Number.isInteger(n)&&n>=0&&n<versions.length)index=n;return this.current();},snapshot(){return {versions:clone(versions),index};},canUndo:()=>index>0,canRedo:()=>index<versions.length-1};}

  return Object.freeze({DEFAULT_MODEL,FALLBACK_MODEL_IDS,HARNESS_GATED_IDS,isHarnessGateError,isNotRoutableError,isHarnessGatedModel,isGatedId,pickFallbackModel,OUTPUT_SCHEMA,HARNESS_TOOLS,RESPONSES_HARNESS_TOOLS,isFreeModel,normalizeModel,sortModels,filterModels,formatPricePerMillion,normalizeSettings,shouldFallbackHarnessTransport,shouldPreferChatHarness,buildEditRequest,buildHarnessRequest,buildHarnessFollowup,buildResponsesHarnessRequest,buildResponsesHarnessFollowup,responseFunctionCalls,parseAIResponse,extractAIResult,completeAIResult,analyzeConsistency,buildSemanticDiff,createVersionStore,STYLE_LIMITS,FORBIDDEN_PATTERNS,DISCOURAGED_PATTERNS,splitSentences,styleMetrics,analyzeStyle,normalizeTypography,buildStyleRepairRequest,styleRepairIsSafe,formatStyleExamples});
}));
