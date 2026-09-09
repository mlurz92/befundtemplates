"""Parsing und Normalisierung des Prof.-Schäfer-Korpus (CSV -> strukturierte Records).

Der RIS-Export hat jedes Komma durch "/" ersetzt. Drei Schrägstrich-Klassen sind zu
unterscheiden:

1. Listenkomma      "Leber/ Milz"        -> "Leber, Milz"      (94.573 Vorkommen)
2. Dezimalkomma     "1/5 Tesla"          -> "1,5 Tesla"        (vor Einheit, ohne Leerzeichen)
3. Echte Notation   "LWK 4/5", "ng/ml"   -> unveraendert

Die Abschnittsmarker treten mit und ohne Doppelpunkt auf; ohne Doppelpunkt wird ein
Satzanfang verlangt, damit Prosa wie "kein pathologischer Befund." nicht zerteilt wird.
"""
import csv
import re

csv.field_size_limit(10 ** 7)

SECTION_LABELS = [
    ('title', r'Titel'),
    ('clinical', r'Klin\.?\s*Angaben|Klinische\s*Angaben|Anamnese'),
    ('question_raw', r'Fragestellung(?:en)?|Frage'),
    ('method', r'Methodik|Methode|Technik'),
    ('findings', r'Befund'),
    ('impression', r'Beurteilung|Beurtlg\.?|Zusammenfassung'),
]

VERTEBRA = r'(?:HWK|BWK|LWK|SWK|WK|Th|C|L|S|D)'
UNIT = r'(?:cm|mm|m|ml|l|Tesla|T|%|mg|g|kg|Jahre|Sekunden|s|min|mSv|Gy|MHz)'

# 1. Echte Notation schuetzen.
KEEP_PATTERNS = [
    re.compile(rf'\b{VERTEBRA}\s?\d+\s*/\s*{VERTEBRA}?\s?\d+'),                 # LWK 4/5, HWK 5/6, L4/5
    re.compile(r'\b(?:ng|mg|µg|mcg|g|mmol|mval|IE|E|ml|l|U)\s*/\s*'
               r'(?:ml|l|dl|kg|min|h|d|m²|qm|24h)\b', re.I),                    # ng/ml, mg/dl
    re.compile(r'\b[A-Za-zÄÖÜäöü]\s?/\s?[A-Za-zÄÖÜäöü]\b'),                     # S/P, N/A
    re.compile(r'\b\d{1,2}\s*/\s*\d{4}\b'),                                     # 12/2023
    re.compile(r'\bTNM|[TNM]\d\s*/\s*\d\b'),
]
# 2. Dezimalkomma: Ziffer/Ziffer unmittelbar vor einer Einheit.
DECIMAL = re.compile(rf'(?<!\d)(\d{{1,3}})\s*/\s*(\d{{1,2}})(?=\s*\xa0?\s*{UNIT}\b)')
# 3. Ziffer/Ziffer ohne Einheit -> ebenfalls Dezimalkomma (Messwerte ohne Einheitsangabe).
DECIMAL_BARE = re.compile(r'(?<!\d)(\d{1,3})\s*/\s*(\d{1,2})(?!\d)')


def restore_commas(text):
    """Fuehrt die Export-Schraegstriche in Kommata zurueck; echte Notation bleibt."""
    if not text:
        return ''
    protected = []

    def protect(match):
        protected.append(match.group(0))
        return f'\x00{len(protected) - 1}\x01'

    for pattern in KEEP_PATTERNS:
        text = pattern.sub(protect, text)
    text = DECIMAL.sub(r'\1,\2', text)
    text = DECIMAL_BARE.sub(r'\1,\2', text)
    # Verbleibende Schraegstriche sind Listenkommata.
    text = re.sub(r'\s*/\s*', ', ', text)
    for index, value in enumerate(protected):
        text = text.replace(f'\x00{index}\x01', value)
    return text


def clean_ws(text):
    text = str(text or '').replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\s+([,.;:!?])', r'\1', text)
    text = re.sub(r'(?:,\s*){2,}', ', ', text)
    text = re.sub(r',\s*\.', '.', text)
    text = re.sub(r'\s*--\s*$', '', text).strip()
    return text.strip(' ,;')


def _marker_regex(require_colon):
    alternatives = '|'.join(f'(?P<{name}>{pattern})' for name, pattern in SECTION_LABELS)
    colon = r'\s*:\s*' if require_colon else r'\s*:?\s+'
    lead = r'(?:^|(?<=\s))' if require_colon else r'(?:^|(?<=[.!?]\s)|(?<=[.!?]\s\s))'
    return re.compile(rf'{lead}(?:{alternatives}){colon}', re.I)


def split_sections(raw):
    text = re.sub(r'\s+', ' ', str(raw or '')).strip()
    for require_colon in (True, False):
        hits = list(_marker_regex(require_colon).finditer(text))
        if len(hits) < 2:
            continue
        out = {}
        for index, hit in enumerate(hits):
            name = next(key for key, value in hit.groupdict().items() if value)
            start = hit.end()
            end = hits[index + 1].start() if index + 1 < len(hits) else len(text)
            chunk = text[start:end].strip()
            if not chunk:
                continue
            if name not in out or len(chunk) > len(out[name]):
                out[name] = chunk
        if 'findings' in out:
            quality = 'explicit' if require_colon else 'legacy_markers'
            return out, quality
    return {}, 'heuristic'


def parse_row(row, source_row):
    raw = re.sub(r'\s+', ' ', str(row.get('Befund gespeichert') or '')).strip()
    sections, quality = split_sections(raw)
    record = {
        'source_row': source_row,
        'modality_raw': (row.get('Modalität') or '').strip(),
        'study_description': (row.get('Studienbeschreibung') or '').strip(),
        'raw': clean_ws(restore_commas(raw)),
        'parse_quality': quality,
    }
    for key, _ in SECTION_LABELS:
        record[key] = clean_ws(restore_commas(sections.get(key, '')))
    if not record['findings']:
        record['findings'] = record['raw']
    return record


def load_corpus(path):
    with open(path, encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
    return [parse_row(row, index + 1) for index, row in enumerate(rows)]
