// Prueft jede Standardvorlage mit derselben Stil-Engine, die auch die
// KI-Ausgaben absichert. Aufruf:
//   node tools/verify_templates.mjs <verzeichnis-der-anwendung>
import {createRequire} from 'module';
import {readFileSync} from 'fs';
import path from 'path';
const require=createRequire(import.meta.url);
const root=path.resolve(process.argv[2]||'Befundbrowser_KSG_Intelligence');
const AI=require(path.join(root,'ai-core.js'));
const raw=readFileSync(path.join(root,'data','reports.js'),'utf8');
const data=JSON.parse(raw.slice(raw.indexOf('=')+1).trim().replace(/;$/,''));

let violations=0, worstFindings=0, worstImpression=0;
const byType=new Map();
for(const n of data.reference_normals){
  const report=AI.analyzeStyle(n.findings,n.impression);
  worstFindings=Math.max(worstFindings,report.metrics.findingsMax);
  worstImpression=Math.max(worstImpression,report.metrics.impressionMax);
  for(const item of report.findings){
    violations++;
    byType.set(item.type,(byType.get(item.type)||0)+1);
    if(violations<=8)console.log(`  ${n.id}: ${item.label} — ${item.detail.slice(0,100)}`);
  }
  // Typografie muss bereits normalisiert sein
  if(AI.normalizeTypography(n.findings)!==n.findings){
    violations++;console.log(`  ${n.id}: Typografie nicht normalisiert`);
  }
}
console.log(`\nVorlagen: ${data.reference_normals.length}`);
console.log(`Stilverstöße: ${violations}`, violations?Object.fromEntries(byType):'');
console.log(`längster Befundsatz: ${worstFindings} Wörter (Grenze ${AI.STYLE_LIMITS.findingsHard})`);
console.log(`längster Beurteilungssatz: ${worstImpression} Wörter (Grenze ${AI.STYLE_LIMITS.impressionHard})`);
process.exit(violations?1:0);
