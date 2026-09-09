"""Regionszuordnung aus der RIS-Studienbeschreibung.

Die Studienbeschreibung ist das Protokoll der tatsaechlich gefahrenen Untersuchung
und damit die verlaesslichste Quelle fuer die Region - deutlich robuster als eine
Textheuristik ueber den Befund. Die Regeln werden der Reihe nach geprueft; die
erste zutreffende gewinnt, spezifische Regeln stehen vor allgemeinen.
"""
import re


def norm(text):
    text = str(text or '').lower()
    text = text.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    text = re.sub(r'\(.*?\)', ' ', text)                    # (Erwachsener)
    text = re.sub(r'_?(neu|alt|test|metall|raw|\d{2}-\d{2}-\d{2})\b', ' ', text)
    text = re.sub(r'[\^_/+.,\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # RIS-Abkuerzungen expandieren, sonst greifen die Kombinationsregeln nicht
    # ("Hals+Tho.+OB ven." ist eine Hals-Thorax-Oberbauch-Untersuchung).
    for short, long in (('tho', 'thorax'), ('thx', 'thorax'), ('abd', 'abdomen'),
                        ('ob', 'oberbauch'), ('gk', 'ganzkoerper'), ('wk', 'wirbelkoerper')):
        text = re.sub(rf'\b{short}\b', long, text)
    return text


# (Regionsname, Regex auf der normalisierten Studienbeschreibung)
RULES = [
    # --- Kombinationsuntersuchungen zuerst: sie enthalten die Einzelbegriffe ---
    ('Hals + Thorax + Abdomen', r'\bhals\b.*\bthorax\b.*\b(abdomen|oberbauch)\b|\bthorax\b.*\b(abdomen|oberbauch)\b.*\bhals\b|\boberbauch\b.*\bhals\b.*\bthorax\b|\bpolytrauma\b|\blymphom\b'),
    ('Hals + Thorax', r'\bhals\b.*\bthorax\b|\bthorax\b.*\bhals\b'),
    ('Thorax + Abdomen', r'\bthorax\b.*\b(abdomen|oberbauch)\b|\b(abdomen|oberbauch)\b.*\bthorax\b'),
    ('Ganzkörper / Screening', r'\bganzkoerper\b|\bkopf bis fuss\b|\bporsche\b|\bplasmozytom\b|\bkrebshilfestudie\b'),

    # --- Kopf / Hals ---
    ('Nasennebenhöhlen / Gesichtsschädel', r'\bnnh\b|\bsinusitis\b|\bnavi hno\b|\bnavi\b|\bgesichtsschaedel\b|\bdental\b|\bnasennebenhoehle\b|\bmkg\b'),
    ('Felsenbein / Ohr', r'\bfelsenbein'),
    ('Orbita', r'\borbita\b'),
    ('Kopf / Neurokranium', r'\bcct\b|\bschaedel\b|\bhirnschaedel\b|\bstroke\b|\bhypophyse\b|\bkhbw\b|\bneurodegeneration\b|\b3d head\b|\bkopf\b|\bparotis\b'),
    ('Hals / Weichteile', r'\bhals\b|\blarynx\b'),

    # --- Wirbelsäule ---
    ('Wirbelsäule HWS', r'\bhws\b'),
    ('Wirbelsäule BWS / LWS', r'\bbws\b|\blws\b'),
    ('Wirbelsäule gesamt', r'\bwirbelsaeule\b|\bgesam\w* ws\b|\bws\b|\bbandscheibe\b'),

    # --- Thorax / Mamma ---
    ('Mamma', r'\bmamma\b|\bmammo\b|\bbrust\b'),
    ('Thorax', r'\bthorax\b|\blungenembolie\b'),

    # --- Abdomen-Organprogramme vor dem allgemeinen Abdomen ---
    ('Leber / Galle', r'\bleber\b|\bhcc\b|\bcholangiographie\b'),
    ('Pankreas', r'\bpankreas\w*'),
    ('Nieren / Nebennieren / Harnwege', r'\bnieren\b|\bnebennieren\b|\burographie\b|\bsteinsuche\b|\bnierensteine\b|\brfa niere\b'),
    ('Dünndarm (Hydro-Sellink)', r'\bhydro\b|\bsellink\b'),
    ('Bauchwand / Hernie', r'\bhernie\b'),
    ('Abdomen', r'\babdomen\b|\bbba\b'),

    # --- Becken ---
    ('Becken / Prostata', r'\bprostata\b'),
    ('Becken / Gynäkologie', r'\bgyntumore\b|\bgyn\b'),
    ('Becken / Rektum', r'\brektum\b|\bdefaekogra\w+'),
    ('Becken / Fistel', r'\bfistel\b'),
    ('Becken / Harnblase', r'\bblase\b'),
    ('Becken / Hoden', r'\bhoden\b'),
    ('Becken knöchern', r'\bbecken knoechern\b|\bknoechern\b|\bbeckenteilersatz\b'),
    ('Becken', r'\bbecken\b'),

    # --- Gelenke / Extremitäten ---
    ('Schulter / Oberarm', r'\bschulter\b|\bshoulder\b|\bbizepssehne\b|\boberarm\b'),
    ('Ellenbogen', r'\bellenbogen\b'),
    ('Hand / Handgelenk / Finger', r'\bhandgel\w*|\bhand\b|\bfinger\b|\bdaumen\b'),
    ('Hüfte / ISG', r'\bhuefte\b|\bisg\b'),
    ('Knie', r'\bknie\b'),
    ('OSG / Fuß', r'\bosg\b|\bfuss\b|\bsprunggelenk\b|\bzehen\b|\bvorfuss\b'),
    ('Ober- / Unterschenkel / Muskulatur', r'\bober\b|\bunterschenkel\b|\bunterarm\b|\bmuskel\b|\bmyopathie\b|\bmuskelstruktur\b|\bskelett\b|\bextremitaet\w*'),

    # --- Gefäße ---
    ('Gefäße / Aorta', r'\baorta\b'),
    ('Gefäße / periphere Angiographie', r'\bangio\w*|\bperipherie\b|\bgefaesse\b'),
]

COMPILED = [(name, re.compile(pattern)) for name, pattern in RULES]


def region_for(study_description):
    text = norm(study_description)
    for name, pattern in COMPILED:
        if pattern.search(text):
            return name
    return ''
