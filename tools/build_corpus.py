#!/usr/bin/env python3
"""Erzeugt data/reports.js und data/build-summary.json aus der Referenz-CSV.

Aufruf:
    python3 tools/build_corpus.py <csv> <ausgabeverzeichnis>

Aufbau:
1. Parsen und Normalisieren (corpus_parse)
2. Vierstufige Taxonomie: Modalitaet -> Region -> Klinische Angaben -> Fragestellung
3. Zusammenfuehren seltener Kategorien, damit keine Sackgassen mit einem Treffer entstehen
4. Standard-Normalbefunde aus echten Korpus-Negativsaetzen (normal_miner)
5. Repraesentativitaets-Ranking der Vorlagen innerhalb jeder Gruppe
"""
import collections
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from corpus_parse import load_corpus                                  # noqa: E402
from taxonomy_region import region_for                                # noqa: E402
from taxonomy_text import clinical_category, question_category        # noqa: E402
from normal_miner import collect, select_template, sentences, normalize  # noqa: E402

SCHEMA_VERSION = 3
TAXONOMY_VERSION = '2026-09-09-intelligence-5-0'

MIN_CLINICAL = 4          # Klin. Angaben unter dieser Fallzahl je Region werden gebuendelt
MIN_QUESTION = 3          # Fragestellungen unter dieser Fallzahl je Knoten werden gebuendelt
CLINICAL_BUCKET = 'Weitere Indikationen'
QUESTION_BUCKET = 'Weitere Fragestellungen'

# Kleine Regionen in eine fachlich passende groessere ueberfuehren.
REGION_MERGE = {
    'Orbita': 'Nasennebenhöhlen / Gesichtsschädel',
    'Becken / Harnblase': 'Becken',
    'Becken / Hoden': 'Becken',
    'Gefäße / periphere Angiographie': 'Gefäße',
    'Gefäße / Aorta': 'Gefäße',
    'Mamma': 'Thorax',
}
MIN_REGION = 12


def modality_of(raw):
    return 'CT' if str(raw or '').upper().startswith('CT') else 'MRT'


def fallback_region(record):
    """Regionsbestimmung fuer Protokolle wie 'CT Kombination' anhand des Titels."""
    return region_for(f"{record.get('title', '')} {record.get('method', '')}") or 'Sonstige Region'


# --- Repraesentativitaet ---------------------------------------------------------
def representativeness(record, phrase_counts):
    """Wie typisch ist dieser Befund fuer seine Gruppe?

    Bewertet wird die Ueberlappung der Saetze mit den in der Gruppe haeufigen
    Formulierungen, ergaenzt um Vollstaendigkeit (Beurteilung vorhanden, saubere
    Sektionen) und eine moderate Laengennormierung.
    """
    own = [normalize(s) for s in sentences(record['findings'])]
    if not own:
        return 0.0
    overlap = sum(phrase_counts.get(s, 0) for s in own) / len(own)
    score = overlap
    if record['impression']:
        score *= 1.25
    if record['parse_quality'] == 'explicit':
        score *= 1.1
    words = len(record['findings'].split())
    if words < 12:
        score *= 0.6
    elif words > 220:
        score *= 0.85
    return round(score, 3)


# --- Normalbefund ----------------------------------------------------------------
# Auswahlstufen von streng nach locker.
TIERS = ((3, 0.02, 1.2), (2, 0.01, 1.0), (1, 0.0, 0.0))


def compose_template(question_counts, question_total, region_counts, region_total,
                     global_counts, global_total):
    """Waehlt die Normalsaetze einer Gruppe.

    Zuerst wird die fragestellungsgenaue Evidenz versucht. Traegt sie nicht, ist die
    breitere Regionsevidenz einer aus Einzelnennungen zusammengesetzten Vorlage
    vorzuziehen: ein Satz, der genau einmal im Korpus steht, ist kein Standard.
    """
    attempts = (
        ('Fragestellung', question_counts, question_total, TIERS[0]),
        ('Region', region_counts, region_total, TIERS[0]),
        ('Fragestellung', question_counts, question_total, TIERS[1]),
        ('Region', region_counts, region_total, TIERS[1]),
        ('Fragestellung', question_counts, question_total, TIERS[2]),
        ('Region', region_counts, region_total, TIERS[2]),
    )
    best = ([], 'Region', 0)
    for index, (basis, counts, total, (min_support, min_share, min_lift)) in enumerate(attempts):
        chosen = select_template(counts, global_counts, total, global_total,
                                 min_support=min_support, min_share=min_share, min_lift=min_lift)
        needed = 4 if index < 4 else 1
        if len(chosen) >= needed:
            return chosen, basis
        if len(chosen) > len(best[0]):
            best = (chosen, basis, index)
    return best[0], best[1]


# Schluesselbegriffe je Fragestellung: Saetze, die den diagnostischen Zielbefund
# betreffen, werden in der Vorlage nach vorn sortiert ("diagnostic target early").
QUESTION_KEYWORDS = {
    'Staging': ('metastas', 'lymphknoten', 'fernmetastas', 'infiltrat'),
    'Lokales Staging / Ausbreitungsdiagnostik': ('kapsel', 'ueberschreit', 'uberschreit', 'infiltrat', 'ausbreit', 'organ', 'emvi', 'mesorektal'),
    'Nachsorge / Rezidivfrage': ('rezidiv', 'lokalrezidiv', 'tumorbett', 'narbe'),
    'Metastasensuche': ('metastas', 'filia', 'absiedl'),
    'Tumorverdacht / Dignität': ('raumforderung', 'tumor', 'herd', 'malign', 'suspekt'),
    'Entzündung / Abszess': ('entzuend', 'abszess', 'infekt', 'sekret', 'schleimhaut', 'erguss', 'oedem', 'bursitis', 'arthritis'),
    'Fraktur / Konsolidierung': ('fraktur', 'knochen', 'kortikalis', 'durchbau', 'konsolid'),
    'Trauma / Verletzungsfolgen': ('ruptur', 'oedem', 'knochenmark', 'band', 'sehne', 'erguss', 'haematom'),
    'Kniebinnenschaden / Meniskus': ('meniskus', 'kreuzband', 'knorpel', 'binnen'),
    'Rotatorenmanschette / Impingement': ('rotatorenmanschette', 'sehne', 'supraspinatus', 'bursitis', 'labrum', 'atrophie'),
    'Bandläsion / Sehnenläsion': ('band', 'sehne', 'ligament', 'ruptur'),
    'Bandscheibenvorfall / Spinalkanalstenose': ('bandscheib', 'spinalkanal', 'foramin', 'nervenwurzel', 'prolaps'),
    'Blutung / Ischämie': ('blutung', 'ischaem', 'infarkt', 'perfusion', 'embolie'),
    'Therapieansprechen / Restaging': ('metastas', 'lymphknoten', 'progress'),
}


def question_affinity(sentence, question):
    keywords = QUESTION_KEYWORDS.get(question, ())
    folded = (sentence.lower().replace('ä', 'ae').replace('ö', 'oe')
              .replace('ü', 'ue').replace('ß', 'ss'))
    return sum(1 for keyword in keywords if keyword in folded)


def order_for_question(chosen, question):
    """Zielbefund zuerst, danach die uebrige Reihenfolge unveraendert."""
    indexed = list(enumerate(chosen))
    indexed.sort(key=lambda pair: (-question_affinity(pair[1]['text'], question), pair[0]))
    return [item for _, item in indexed]


IMPRESSION_BY_QUESTION = {
    'Staging': 'Kein Nachweis von Fernmetastasen im Untersuchungsgebiet.',
    'Lokales Staging / Ausbreitungsdiagnostik': 'Kein Nachweis einer organüberschreitenden Tumorausbreitung.',
    'Nachsorge / Rezidivfrage': 'Kein Nachweis eines Lokalrezidivs.',
    'Verlaufskontrolle': 'Konstanter Befund gegenüber der Voruntersuchung.',
    'Therapieansprechen / Restaging': 'Keine Hinweise auf eine Progression im Untersuchungsgebiet.',
    'Metastasensuche': 'Kein Nachweis von Metastasen im Untersuchungsgebiet.',
    'Tumorverdacht / Dignität': 'Kein Nachweis einer suspekten Raumforderung.',
    'Therapie- / OP-Planung': 'Keine planungsrelevante Zusatzpathologie im Untersuchungsgebiet.',
    'Trauma / Verletzungsfolgen': 'Kein Nachweis einer frischen Verletzung.',
    'Fraktur / Konsolidierung': 'Kein Nachweis einer Fraktur.',
    'Kniebinnenschaden / Meniskus': 'Kein Nachweis eines Kniebinnenschadens.',
    'Rotatorenmanschette / Impingement': 'Kein Nachweis einer Rotatorenmanschettenruptur.',
    'Bandläsion / Sehnenläsion': 'Kein Nachweis einer Band- oder Sehnenruptur.',
    'Bandscheibenvorfall / Spinalkanalstenose': 'Kein Nachweis eines Bandscheibenvorfalls oder einer Spinalkanalstenose.',
    'Entzündung / Abszess': 'Keine Hinweise auf einen entzündlichen Prozess.',
    'Blutung / Ischämie': 'Keine Hinweise auf eine Blutung oder Ischämie.',
    'Ausdehnung / Ausmaß': 'Befund auf das Untersuchungsgebiet begrenzt.',
    'Gesundheitsvorsorge / Screening': 'Kein erklärungsbedürftiger Befund im Untersuchungsgebiet.',
    'Abklärung / Ursachensuche': 'Kein erklärungsbedürftiger Befund im Untersuchungsgebiet.',
}
IMPRESSION_DEFAULT = 'Unauffälliger Befund im Untersuchungsgebiet.'


def compose_impression(question_counts, question_total, region_counts, region_total,
                       global_counts, global_total, question):
    """Waehlt die Beurteilungszeile - bevorzugt aus echter Korpusevidenz.

    Die Beurteilung ist im Korpus deutlich staerker verdichtet als der Befund
    (Median 4 Woerter). Es wird daher hoechstens ein Satz uebernommen; nur wenn
    keine belastbare Evidenz vorliegt, greift die kuratierte Standardzeile.
    """
    for counts, total, min_support in ((question_counts, question_total, 3),
                                       (question_counts, question_total, 2),
                                       (region_counts, region_total, 4)):
        chosen = select_template(counts, global_counts, total, global_total,
                                 limit=4, min_support=min_support, min_share=0.02, min_lift=1.1)
        for item in chosen:
            # Die Beurteilung muss die Fragestellung beantworten. Ein haeufiger,
            # aber thematisch unbezogener Negativsatz ("Keine Perforation." bei
            # der Frage nach einer Entzuendung) ist dafuer untauglich.
            if len(item['text'].split()) <= 13 and question_affinity(item['text'], question):
                return item['text'], 'Korpus', item['count']
    return IMPRESSION_BY_QUESTION.get(question, IMPRESSION_DEFAULT), 'kuratiert', 0


def build(csv_path, out_dir):
    raw_bytes = open(csv_path, 'rb').read()
    records = load_corpus(csv_path)

    # --- Ebene 1-2 ---
    for record in records:
        record['modality'] = modality_of(record['modality_raw'])
        record['region'] = region_for(record['study_description']) or fallback_region(record)

    region_counts = collections.Counter(r['region'] for r in records)
    for record in records:
        target = REGION_MERGE.get(record['region'])
        if target:
            record['region'] = target
        elif region_counts[record['region']] < MIN_REGION:
            record['region'] = 'Sonstige Region'

    # --- Ebene 3-4 ---
    for record in records:
        record['clinical_category'] = clinical_category(
            record['clinical'], record['title'], record['question_raw'])
        record['question_category'] = question_category(
            record['question_raw'], record['clinical'], record['title'])

    # Seltene Kategorien buendeln: eine Auswahl, die auf genau eine Vorlage fuehrt,
    # ist als Navigationsebene wertlos.
    level3 = collections.Counter((r['modality'], r['region'], r['clinical_category']) for r in records)
    for record in records:
        if level3[(record['modality'], record['region'], record['clinical_category'])] < MIN_CLINICAL:
            record['clinical_category'] = CLINICAL_BUCKET
    level4 = collections.Counter(
        (r['modality'], r['region'], r['clinical_category'], r['question_category']) for r in records)
    for record in records:
        key = (record['modality'], record['region'], record['clinical_category'], record['question_category'])
        if level4[key] < MIN_QUESTION:
            record['question_category'] = QUESTION_BUCKET

    # --- Normalsaetze zaehlen ---
    region_phrases, region_totals = collect(records, ['modality', 'region'], 'findings')
    # Beurteilungen getrennt zaehlen: sie sind kuerzer und beantworten die Frage.
    impression_phrases, impression_totals = collect(
        records, ['modality', 'region', 'question_category'], 'impression')
    impression_region, impression_region_totals = collect(
        records, ['modality', 'region'], 'impression')
    global_impressions = collections.Counter()
    for counter in impression_region.values():
        global_impressions.update(counter)
    global_impression_total = sum(impression_region_totals.values())
    question_phrases, question_totals = collect(
        records, ['modality', 'region', 'question_category'], 'findings')
    global_phrases = collections.Counter()
    for counter in region_phrases.values():
        global_phrases.update(counter)
    global_total = sum(region_totals.values())

    # --- Duplikate und Ranking ---
    seen = {}
    duplicates = 0
    for record in records:
        digest = hashlib.sha1(record['findings'].encode('utf-8')).hexdigest()
        record['duplicate_of'] = seen.get(digest, '')
        if record['duplicate_of']:
            duplicates += 1
        else:
            seen[digest] = f"R{record['source_row']:05d}"

    groups = collections.defaultdict(list)
    for record in records:
        groups[(record['modality'], record['region'],
                record['clinical_category'], record['question_category'])].append(record)

    for key, members in groups.items():
        phrase_counts = question_phrases.get((key[0], key[1], key[3]),
                                             region_phrases.get((key[0], key[1]), collections.Counter()))
        for record in members:
            record['representativeness_score'] = representativeness(record, phrase_counts)
        members.sort(key=lambda r: (-r['representativeness_score'], bool(r['duplicate_of']), r['source_row']))
        for index, record in enumerate(members, start=1):
            record['rank_in_group'] = index
            record['group_size'] = len(members)

    # --- Standard-Normalbefunde ---
    normals = []
    for (modality, region, question), total in sorted(question_totals.items()):
        counts = question_phrases[(modality, region, question)]
        chosen, basis = compose_template(counts, total,
                                         region_phrases[(modality, region)],
                                         region_totals[(modality, region)],
                                         global_phrases, global_total)
        if not chosen:
            continue
        chosen = order_for_question(chosen, question)
        findings = ' '.join(item['text'] for item in chosen)
        impression, impression_basis, impression_count = compose_impression(
            impression_phrases[(modality, region, question)],
            impression_totals[(modality, region, question)],
            impression_region[(modality, region)],
            impression_region_totals[(modality, region)],
            global_impressions, global_impression_total, question)
        evidence = min(item['count'] for item in chosen)
        level = 'hoch' if evidence >= 20 else 'mittel' if evidence >= 5 else 'orientierend'
        slug = re.sub(r'[^a-z0-9]+', '-',
                      f'{modality}-{region}-{question}'.lower()
                      .replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')).strip('-')
        normals.append({
            'id': f'N-{slug}',
            'is_reference': True,
            'modality': modality,
            'region': region,
            'question': question,
            'title': 'Standard-Normalbefund · korpusbasiert',
            'findings': findings,
            'impression': impression,
            'impression_basis': impression_basis,
            'impression_count': impression_count,
            'sentences': chosen,
            'evidence_basis': basis,
            'evidence_count': evidence,
            'evidence_reports': total,
            'evidence_level': level,
            'source_phrase_count': sum(counts.values()),
        })

    # --- Ausgabe ---
    out_reports = []
    for record in records:
        out_reports.append({
            'id': f"R{record['source_row']:05d}",
            'source_row': record['source_row'],
            'modality': record['modality'],
            'modality_raw': record['modality_raw'],
            'region': record['region'],
            'theme': record['clinical_category'],
            'question': record['question_category'],
            'title': record['title'],
            'clinical': record['clinical'],
            'question_raw': record['question_raw'],
            'method': record['method'],
            'findings': record['findings'],
            'impression': record['impression'],
            'raw': record['raw'],
            'study_description': record['study_description'],
            'parse_quality': record['parse_quality'],
            'duplicate_of': record['duplicate_of'],
            'representativeness_score': record['representativeness_score'],
            'rank_in_group': record['rank_in_group'],
            'group_size': record['group_size'],
        })

    counter = lambda field: dict(collections.Counter(r[field] for r in out_reports).most_common())
    summary = {
        'schema_version': SCHEMA_VERSION,
        'taxonomy_version': TAXONOMY_VERSION,
        'corpus_sha256': hashlib.sha256(raw_bytes).hexdigest(),
        'total_reports': len(out_reports),
        'modality_counts': counter('modality'),
        'parse_quality_counts': counter('parse_quality'),
        'duplicate_reports': duplicates,
        'region_counts': counter('region'),
        'theme_counts': counter('theme'),
        'question_counts': counter('question'),
        'reference_normals': len(normals),
        'leaf_groups': len(groups),
        'leaf_singletons': sum(1 for members in groups.values() if len(members) == 1),
        'leaf_median_size': sorted(len(m) for m in groups.values())[len(groups) // 2],
    }

    os.makedirs(out_dir, exist_ok=True)
    payload = {'meta': summary, 'reports': out_reports, 'reference_normals': normals}
    with open(os.path.join(out_dir, 'reports.js'), 'w', encoding='utf-8') as handle:
        handle.write('window.BEFUND_DATA=')
        json.dump(payload, handle, ensure_ascii=False, separators=(',', ':'))
        handle.write(';\n')
    with open(os.path.join(out_dir, 'build-summary.json'), 'w', encoding='utf-8') as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)
    return summary


if __name__ == '__main__':
    result = build(sys.argv[1], sys.argv[2])
    print(json.dumps({k: v for k, v in result.items() if not isinstance(v, dict)},
                     ensure_ascii=False, indent=2))
