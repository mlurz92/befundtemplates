"""Kontrolliertes Vokabular fuer Klinische Angaben (Ebene 3) und Fragestellung (Ebene 4).

Der Rohkorpus enthaelt 2.893 verschiedene Fragestellungs-Freitexte, von denen die
grosse Mehrheit genau einmal vorkommt. Als Navigationsebene ist das unbrauchbar:
die Auswahl fuehrt dann auf eine einzige Vorlage. Beide Ebenen werden deshalb auf
ein kontrolliertes Vokabular abgebildet; der Originaltext bleibt als
question_raw/clinical am Datensatz erhalten und wird in der Vorlage angezeigt.

Regeln werden der Reihe nach geprueft, die erste zutreffende gewinnt.
"""
import re


def fold(text):
    text = str(text or '').lower()
    text = (text.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss'))
    text = re.sub(r'[-–—/\\]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


# ICD-10-Kodes kommen in den klinischen Angaben als alleinige Diagnoseangabe vor
# ("C34.1 rechts.") und sind dort die praeziseste Entitaetsinformation.
ICD_MAP = [
    (r'\bc0[0-6]\b', 'Zungen- / Mundhöhlenkarzinom'),
    (r'\bc09\b|\bc10\b', 'Tonsillen- / Oropharynxkarzinom'),
    (r'\bc11\b|\bc07\b|\bc08\b|\bc30\b|\bc31\b', 'Nasopharynx- / HNO-Tumor sonstiger Lokalisation'),
    (r'\bc1[23]\b|\bc32\b', 'Larynx- / Hypopharynxkarzinom'),
    (r'\bc1[56]\b', 'Magen- / Ösophaguskarzinom'),
    (r'\bc1[789]\b', 'Kolon- / Sigmakarzinom'),
    (r'\bc20\b', 'Rektumkarzinom'),
    (r'\bc21\b', 'Analkarzinom'),
    (r'\bc22\b', 'Hepatozelluläres Karzinom (HCC)'),
    (r'\bc2[34]\b', 'Cholangiokarzinom / Gallenwege'),
    (r'\bc25\b', 'Pankreaskarzinom'),
    (r'\bc3[34]\b', 'Bronchial- / Lungenkarzinom'),
    (r'\bc4[35]\b', 'Malignes Melanom'),
    (r'\bc49\b|\bc48\b', 'Sarkom / Weichteiltumor'),
    (r'\bc50\b', 'Mammakarzinom'),
    (r'\bc5[12]\b', 'Vulva- / Vaginalkarzinom'),
    (r'\bc53\b', 'Zervixkarzinom'),
    (r'\bc5[45]\b', 'Endometriumkarzinom'),
    (r'\bc56\b', 'Ovarialkarzinom'),
    (r'\bc61\b', 'Prostatakarzinom'),
    (r'\bc62\b', 'Hodentumor / Keimzelltumor'),
    (r'\bc6[45]\b', 'Nierenzellkarzinom'),
    (r'\bc6[78]\b', 'Urothel- / Harnblasenkarzinom'),
    (r'\bc73\b', 'Schilddrüsenkarzinom'),
    (r'\bc7[789]\b', 'Metastasierung / unbekannter Primärtumor'),
    (r'\bc8[1-6]\b|\bc9[0-5]\b', 'Lymphom / hämatologische Erkrankung'),
]
ICD_COMPILED = [(re.compile(pattern), name) for pattern, name in ICD_MAP]


# --- Ebene 3: Klinische Angaben -------------------------------------------------
CLINICAL_RULES = [
    ('Mammakarzinom', r'mammaca|mammakarzinom|mamma ca|brustkrebs|mamma karzinom'),
    ('Prostatakarzinom', r'prostatakarzinom|prostata ca|prostataca|\bpca\b|gleason'),
    ('Prostata / PSA-Erhöhung', r'psa'),
    ('Rektumkarzinom', r'rektumkarzinom|rektum ca|rektumca'),
    ('Analkarzinom', r'analkarzinom|anal ca'),
    ('Kolon- / Sigmakarzinom', r'kolonkarzinom|sigmakarzinom|kolon ca|sigma ca|coecum|zoekal|kolorektal'),
    ('Zervixkarzinom', r'zervixkarzinom|zervix ca|collumkarzinom|cervixkarzinom'),
    ('Endometriumkarzinom', r'endometriumkarzinom|korpuskarzinom|uteruskarzinom'),
    ('Ovarialkarzinom', r'ovarialkarzinom|ovarial ca|ovarialca'),
    ('Vulva- / Vaginalkarzinom', r'vulvakarzinom|vaginalkarzinom|vulvaekarzinom'),
    ('Urothel- / Harnblasenkarzinom', r'harnblasenkarzinom|urothelkarzinom|blasenkarzinom|urothel ca'),
    ('Nierenzellkarzinom', r'nierenkarzinom|nierenzellkarzinom|niere ca|nierentumor'),
    ('Hodentumor / Keimzelltumor', r'hodentumor|seminom|keimzelltumor|hodenkarzinom'),
    ('Pankreaskarzinom', r'pankreaskarzinom|pankreas ca|pankreasca|ipmn'),
    ('Hepatozelluläres Karzinom (HCC)', r'\bhcc\b|hepatozellulaer'),
    ('Cholangiokarzinom / Gallenwege', r'cholangiokarzinom|\bccc\b|klatskin|gallenblasenkarzinom'),
    ('Magen- / Ösophaguskarzinom', r'magenkarzinom|oesophaguskarzinom|magen ca|kardiakarzinom'),
    ('Bronchial- / Lungenkarzinom', r'bronchialkarzinom|lungenkarzinom|\bnsclc\b|\bsclc\b|lungen ca|pancoast'),
    ('Larynx- / Hypopharynxkarzinom', r'larynxkarzinom|hypopharynxkarzinom|kehlkopfkarzinom|larynx ca'),
    ('Tonsillen- / Oropharynxkarzinom', r'tonsillenkarzinom|oropharynxkarzinom|tonsillen ca'),
    ('Zungen- / Mundhöhlenkarzinom', r'zungenkarzinom|mundbodenkarzinom|mundhoehlenkarzinom|zungengrundkarzinom'),
    ('Nasopharynx- / HNO-Tumor sonstiger Lokalisation', r'nasopharynxkarzinom|parotiskarzinom|speicheldruesenkarzinom|hypopharynx|sinunasal'),
    ('Schilddrüsenkarzinom', r'schilddruesenkarzinom|thyreoidea ca'),
    ('Lymphom / hämatologische Erkrankung', r'lymphom|\bcll\b|\baml\b|\bnhl\b|leukaemie|hodgkin|myeloproliferativ'),
    ('Plasmozytom / Multiples Myelom', r'plasmozytom|myelom'),
    ('Malignes Melanom', r'melanom'),
    ('Sarkom / Weichteiltumor', r'sarkom|\bgist\b|weichteiltumor|liposarkom'),
    ('Neuroendokriner Tumor', r'neuroendokrin|\bnet\b|karzinoid'),
    ('Metastasierung / unbekannter Primärtumor', r'\bcup\b|unbekannter primaertumor|metastasier|metastasen|filiae'),
    ('Sonstige / unklare Tumorerkrankung', r'karzinom|malignom|\btumor\b|\bneoplas|\bnpl\b|onkolog'),

    ('Sinusitis / Nasennebenhöhlen', r'sinusitis|nasennebenhoehle|polyposis nasi|septumdeviation|cholesteatom|otitis|mastoiditis'),
    ('Chronisch-entzündliche Darmerkrankung', r'morbus crohn|colitis|crohn|ced\b'),
    ('Entzündung / Infektion / Abszess', r'abszess|entzuendung|infekt|osteomyelitis|spondylodiszitis|phlegmone|fistel|empyem|pneumonie|sepsis|divertikulitis|pankreatitis|pyelonephritis|prostatitis|cholezystitis|appendizitis|arthritis|epicondylitis|tendinitis|tendinopathie|sakroiliitis|bursitis|fasziitis|itis\b'),
    ('Fraktur / Frakturverlauf', r'fraktur|bruch\b|durchbauung|konsolidierung|pseudarthrose'),
    ('Trauma / Verletzungsfolgen', r'trauma|sturz|distorsion|verletzung|unfall|prellung|luxation|ruptur|anpralltrauma|supination'),
    ('Bandscheiben- / Wirbelsäulenbeschwerden', r'bandscheiben|radikulaer|spinalkanalstenose|ischialgie|lumbalgie|zervikobrachialgie|myelopathie|skoliose'),
    ('Degeneration / Arthrose', r'arthrose|degenerativ|gonarthrose|coxarthrose|impingement|tendinose|chondropathie|knorpelschaden'),
    ('Schmerz / Funktionsbeschwerden', r'schmerz|beschwerden|bewegungseinschraenkung|schwellung|gonalgie|omalgie|belastungs'),
    ('Postoperativer / posttherapeutischer Verlauf', r'zustand nach|folgezustand|z\.? ?n\.?|postoperativ|nach operation|nach resektion|nach implantation|radiochemotherapie|chemotherapie|strahlentherapie|bestrahlung'),
    ('Gefäßerkrankung', r'aneurysma|dissektion|arterienstenose|thrombose|embolie|\bpavk\b|ischaemie|varize|gefaessstenose|angiodysplasie'),
    ('Unklare Raumforderung / Befundabklärung', r'raumforderung|unklare|unklarer|unklares|auffaellig|verdacht|abklaerung|\bv\.? ?a\.?\b|zyste|herd'),
    ('Gesundheitsvorsorge / Screening', r'vorsorge|screening|check|krebshilfe|studie'),
    ('Benigne gynäkologische Erkrankung', r'myom|endometriose|adenomyose|uterus myomatosus|ovarialzyste'),
    ('Osteonekrose / Knochenstoffwechsel', r'nekrose|osteoporose|knochenmarkoedem|osteochondrosis|morbus ahlbaeck'),
    ('Benigne Raumforderung / Zyste', r'myom|adenom|haemangiom|zyste|lipom|desmoid|struma'),
    ('Bauchwand / Hernie', r'hernie|bauchwand|narbenbruch|sinus pilonidalis'),
]

# --- Ebene 4: Fragestellung -----------------------------------------------------
QUESTION_RULES = [
    ('Therapieansprechen / Restaging', r'restaging|therapieansprechen|ansprechen|zwischenstaging|response|progress\b|progredienz|remission'),
    ('Lokales Staging / Ausbreitungsdiagnostik', r'lokales staging|lokale ausbreitung|ausbreitungsdiagnostik|lokale staging|infiltration|t-?stadium'),
    ('Staging', r'staging|tumorausdehnung|primaerstaging|tnm'),
    ('Nachsorge / Rezidivfrage', r'nachsorge|rezidiv|lokalrezidiv|wiederauftreten|nachkontrolle'),
    ('Therapie- / OP-Planung', r'op-?planung|op-?vorbereitung|therapieplanung|planung|biopsie|punktion|intervention|bestrahlungsplanung|markierung'),
    ('Metastasensuche', r'metastas|filiae|absiedl'),
    ('Verlaufskontrolle', r'verlaufskontrolle|verlauf|kontrolle|follow'),
    ('Tumorverdacht / Dignität', r'\btumor\b|malignom|malignitaet|karzinom|dignitaet|neoplas|raumforderung|tumorsuche|\bnpl\b|maligne|\bhcc\b|lymphom|adenom|zyste|herd'),
    ('Fraktur / Konsolidierung', r'fraktur|durchbauung|konsolidierung|pseudarthrose|stressreaktion|nekrose|hueftkopfnekrose'),
    ('Kniebinnenschaden / Meniskus', r'kniebinnenschaden|meniskus|kreuzband|binnenschaden'),
    ('Rotatorenmanschette / Impingement', r'rotatorenmanschette|impingement|\brm\b|supraspinatus|labrum|slap'),
    ('Bandläsion / Sehnenläsion', r'bandlaesion|bandruptur|sehnenlaesion|sehnenruptur|ligament|band\b|sehne'),
    ('Bandscheibenvorfall / Spinalkanalstenose', r'bandscheiben|prolaps|spinalkanalstenose|nervenwurzel|foramen|myelopathie|\bnpp\b|radikulaer'),
    ('Entzündung / Abszess', r'entzuendung|abszess|infekt|osteomyelitis|spondylodiszitis|fistel|empyem|sinusitis|itis\b|entzuendlich|cholesteatom'),
    ('Trauma / Verletzungsfolgen', r'verletzungsfolgen|traumafolgen|unfallfolgen|trauma|verletzung|laesion|schaden|distorsion|ruptur|kontusion|hernie|adhaesion'),
    ('Ausdehnung / Ausmaß', r'ausdehnung|ausmass|groesse|extension|befundausdehnung|schweregrad|auspraegung|statuserhebung|status\b|ursprung|stadium'),
    ('Gesundheitsvorsorge / Screening', r'vorsorge|screening|gesundheitsvorsorge|krebshilfe|studie|check'),
    ('Blutung / Ischämie', r'blutung|ischaemie|infarkt|stroke|embolie|thrombose|stenose|aneurysma|perfusion'),
    ('Abklärung / Ursachensuche', r'abklaerung|ursache|auffaelligkeit|befundabklaerung|erbeten|klaerung|unklar|beurteilung|frage'),
]

CLINICAL_COMPILED = [(name, re.compile(pattern)) for name, pattern in CLINICAL_RULES]
QUESTION_COMPILED = [(name, re.compile(pattern)) for name, pattern in QUESTION_RULES]

CLINICAL_FALLBACK = 'Sonstige klinische Angabe'
QUESTION_FALLBACK = 'Sonstige Fragestellung'


def _match_clinical(text):
    if not text:
        return ''
    for pattern, name in ICD_COMPILED:
        if pattern.search(text):
            return name
    for name, pattern in CLINICAL_COMPILED:
        if pattern.search(text):
            return name
    return ''


def clinical_category(clinical, title='', question=''):
    """Kategorie der klinischen Angaben.

    Die klinischen Angaben selbst haben Vorrang; erst wenn sie fehlen oder
    unspezifisch sind, werden Titel und Fragestellung herangezogen.
    """
    return (_match_clinical(fold(clinical))
            or _match_clinical(fold(title))
            or _match_clinical(fold(question))
            or CLINICAL_FALLBACK)


def question_category(question, clinical='', title=''):
    """Kanonische Fragestellung; nutzt bei leerem Feld die klinischen Angaben."""
    primary = fold(question)
    for name, pattern in QUESTION_COMPILED:
        if pattern.search(primary):
            return name
    haystack = fold(f'{clinical} {title}')
    for name, pattern in QUESTION_COMPILED:
        if pattern.search(haystack):
            return name
    return QUESTION_FALLBACK
