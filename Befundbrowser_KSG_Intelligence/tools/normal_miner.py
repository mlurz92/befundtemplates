"""Ableitung der Standard-Normalbefunde aus echter Korpus-Evidenz.

Statt generischer Boilerplate werden die tatsaechlich von Prof. Schäfer verwendeten
Negativ- und Normalsaetze je Modalitaet/Region gezaehlt und die haeufigsten zu einer
Vorlage zusammengesetzt. Damit stammt jede Formulierung aus dem Korpus; erfunden wird
nichts. Saetze mit Messwerten, Datumsangaben, Seitenangaben oder Vergleichsbezug
werden ausgeschlossen, weil sie patientenspezifisch sind.
"""
import re
from collections import Counter, defaultdict

SENTENCE_SPLIT = re.compile(r'(?<=[.!?])\s+')

# Ein Satz gilt als normal/negativ, wenn er eine dieser Konstruktionen enthaelt.
NORMAL_MARKERS = re.compile(
    r'\b(kein|keine|keinen|keiner|keines|ohne|unauff|regelrecht|normal|intakt|'
    r'nicht nachweisbar|nicht abgrenzbar|frei von|glatt begrenzt|altersentsprechend|'
    r'seitengleich|homogen)\b', re.I)

# Ausschluss: patientenspezifische oder positive Aussagen.
EXCLUDE = re.compile(
    r'\d'                                            # Masse, Daten, Level
    r'|\b(vergleich|voruntersuchung|vorunters|verglichen|voraufnahme|vorbild|zuvor|konstant|unveraendert|unverändert|'
    r'progredient|regredient|neu aufgetreten|zunahme|abnahme|z\.? ?n\.?|zustand nach|'
    r'anamnest|patient|klinisch)\b'
    r'|\b(rechts|links|beidseits|bds)\b'              # Lateralitaet ist fallspezifisch
    r'|\bvoraufnahm\w*|\bvorbild\w*|\bvorbefund\w*'
    r'|\b(nachweis eines|nachweis einer|suspekt|verdaechtig|pathologisch verae|'
    r'raumforderung mit|metastas|karzinom|tumor|fraktur|ruptur|abszess|infiltrat)\b',
    re.I)

TRAILING = re.compile(r'\s*[.;,]+\s*$')


def sentences(text):
    for part in SENTENCE_SPLIT.split(str(text or '')):
        part = part.strip()
        if part:
            yield part


def normalize(sentence):
    sentence = TRAILING.sub('', sentence.strip())
    sentence = re.sub(r'\s+', ' ', sentence)
    return sentence


# Eine Verneinung irgendwo im Satz genuegt nicht. "Das Hauptfragment, in dem keine
# Schrauben verankert sind, ist abgerutscht." enthaelt "keine" und ist dennoch ein
# positiver pathologischer Befund. Zugelassen sind deshalb nur zwei Satzformen:
NEGATION_LEAD = re.compile(
    r'^(kein(?:e|en|er|es)?|ohne|unauff\w+|regelrecht\w*|normal\w*|altersentsprechend\w*|'
    r'seitengleich\w*|frei von|nicht )\b', re.I)
COPULAR_NORMAL = re.compile(
    r'\b(?:ist|sind|erscheint|erscheinen|stellt sich|stellen sich|zeigt sich|zeigen sich)\b'
    r'[^.]{0,60}\b(intakt|regelrecht|unauff\w+|normal\w*|frei|erhalten|glatt begrenzt|'
    r'altersentsprechend|seitengleich|homogen|reizlos|zart|schlank|pneumatisiert)\b[^.]{0,25}\.?$', re.I)
# Einschraenkende oder gegenlaeufige Konjunktionen deuten auf eine positive Zweitaussage.
ADVERSATIVE = re.compile(r'\b(aber|jedoch|allerdings|dagegen|hingegen|sondern|wohingegen)\b', re.I)


def is_normal_sentence(sentence):
    words = sentence.split()
    if not (2 <= len(words) <= 14):
        return False
    if sentence[0].islower():
        return False
    if EXCLUDE.search(sentence) or ADVERSATIVE.search(sentence):
        return False
    return bool(NEGATION_LEAD.match(sentence) or COPULAR_NORMAL.search(sentence))


def collect(records, key_fields, text_field):
    """Zaehlt normale Saetze je Gruppenschluessel."""
    counts = defaultdict(Counter)
    totals = Counter()
    for record in records:
        key = tuple(record[field] for field in key_fields)
        totals[key] += 1
        seen = set()
        for sentence in sentences(record.get(text_field, '')):
            sentence = normalize(sentence)
            if is_normal_sentence(sentence) and sentence not in seen:
                seen.add(sentence)
                counts[key][sentence + '.'] += 1
    return counts, totals


STOPWORDS = {
    'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem',
    'und', 'oder', 'ist', 'sind', 'im', 'in', 'am', 'an', 'auf', 'bei', 'mit', 'ohne',
    'von', 'vom', 'zur', 'zum', 'sowie', 'auch', 'nicht', 'sich', 'werden', 'wird',
}


# Synonymklassen des Korpus: unterschiedliche Formulierung, gleiche Aussage.
SYNONYMS = {
    'pulmonal': 'lunge', 'lungen': 'lunge', 'lunge': 'lunge',
    'ossaer': 'knochen', 'knoechern': 'knochen', 'knochern': 'knochen', 'ossar': 'knochen',
    'verdaechtig': 'suspekt', 'verdacht': 'suspekt', 'verdachtig': 'suspekt',
    'metastasenverdaechtig': 'metastasensuspekt', 'metastasenverdachtig': 'metastasensuspekt',
    'erguss': 'erguss', 'gelenkerguss': 'erguss',
    'lymphadenopathie': 'lymphknoten', 'lymphknotenmetastas': 'lymphknoten',
    'muskulaer': 'muskel', 'muskular': 'muskel', 'musculaer': 'muskel',
    # Normalitaetsaussagen sind austauschbar formuliert.
    'unauffaellig': 'normal', 'unauffallig': 'normal', 'regelrecht': 'normal',
    'altersentsprechend': 'normal', 'normal': 'normal', 'reizlos': 'normal',
}


def stem(word):
    word = (word.lower().replace('ä', 'ae').replace('ö', 'oe')
            .replace('ü', 'ue').replace('ß', 'ss'))
    for suffix in ('ungen', 'lichen', 'enden', 'ern', 'en', 'es', 'er', 'em', 'e', 'n', 's'):
        if len(word) - len(suffix) >= 4 and word.endswith(suffix):
            word = word[:-len(suffix)]
            break
    return SYNONYMS.get(word, word)


# Organpraefixe fuer die Kompositazerlegung: "Lungenmetastasen" und "pulmonale
# Metastasen" sollen als dieselbe Aussage erkannt werden.
COMPOUND_PREFIXES = ('lunge', 'leber', 'knochen', 'lymphknoten', 'niere', 'milz',
                     'pankreas', 'prostata', 'meniskus', 'knorpel', 'gelenk', 'hirn',
                     'darm', 'weichteil', 'haut', 'muskel', 'sehne', 'band')


def expand(word):
    token = stem(word)
    for prefix in COMPOUND_PREFIXES:
        if token.startswith(prefix) and len(token) > len(prefix) + 2:
            rest = token[len(prefix):].lstrip('ns')
            # rest ist bereits Teil des gestemmten Tokens und wird nicht erneut gestemmt
            return {prefix, rest} if len(rest) > 2 else {prefix}
        if token.endswith(prefix) and len(token) > len(prefix) + 2:
            head = token[:-len(prefix)].rstrip('ns')
            return {head, prefix} if len(head) > 2 else {prefix}
    return {token}


def content_words(sentence):
    words = re.findall(r'[A-Za-zÄÖÜäöüß]+', sentence.lower())
    out = set()
    for word in words:
        if word in STOPWORDS or len(word) <= 2:
            continue
        out |= expand(word)
    return frozenset(out)


def select_template(region_counts, global_counts, region_total, global_total,
                    limit=7, min_support=3, min_share=0.02, min_lift=1.2):
    """Waehlt die regionstypischen Normalsaetze aus.

    Reine Haeufigkeit genuegt nicht: Saetze wie "Kein Aszites." kommen in fast jeder
    Region vor. Gewertet wird deshalb die Distinktivitaet (Anteil in der Region
    gegenueber dem Anteil im Gesamtkorpus). Saetze, deren Inhaltswoerter in einem
    bereits gewaehlten Satz enthalten sind, entfallen als Dublette.
    """
    if not region_total:
        return []
    scored = []
    for sentence, count in region_counts.items():
        if count < min_support:
            continue
        share = count / region_total
        if share < min_share:
            continue
        global_share = global_counts.get(sentence, count) / max(global_total, 1)
        lift = share / global_share if global_share else 1.0
        if lift < min_lift:
            continue
        scored.append((share * min(lift, 6.0), share, count, sentence))
    scored.sort(reverse=True)

    chosen = []
    chosen_sets = []
    for _, share, count, sentence in scored:
        words = content_words(sentence)
        if any(words <= other or other <= words for other in chosen_sets):
            continue
        chosen.append({'text': sentence, 'count': count, 'share': round(share, 4)})
        chosen_sets.append(words)
        if len(chosen) >= limit:
            break
    return chosen
