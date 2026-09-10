# -*- coding: utf-8 -*-
"""Kanonisierung von Modalitaet, Untersuchungsregion, Thema und Fragestellung."""
import re

# ---------------------------------------------------------------- Modalitaet
def norm_mod(m):
    m = (m or "").strip().upper()
    return "MRT" if m.startswith("M") else "CT"

# ------------------------------------------------------------------- Region
def _study_key(s):
    s = (s or "").strip()
    s = re.sub(r"\((?:Erwachsener|Kind)\s*\)", " ", s, flags=re.I)
    s = re.sub(r"_(?:neu|15-09-17|W)\b", " ", s, flags=re.I)
    s = s.replace("^", " ").replace("_", " ").replace("/", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s

# (Regex auf dem normalisierten Studienschluessel) -> (Gruppe, kanonische Region)
REGION_RULES = [
    # --- Kopf / Hals -------------------------------------------------------
    (r"felsenbein",                          ("Kopf & Hals", "Felsenbein")),
    (r"\bnnh\b|nasennebenh|sinusitis|navi hno|dental|gesichtsschaedel|gesichtssch",
                                             ("Kopf & Hals", "Nasennebenhöhlen & Gesichtsschädel")),
    (r"orbita",                              ("Kopf & Hals", "Orbita")),
    (r"hypophyse",                           ("Kopf & Hals", "Hypophyse")),
    (r"parotis",                             ("Kopf & Hals", "Speicheldrüsen")),
    (r"\bstroke\b|khbw|neurodegeneration|hirnsch|\bcct\b|schaedel|schädel|3d head|kopf",
                                             ("Kopf & Hals", "Neurokranium")),
    (r"^hals|hals ", ("Kopf & Hals", "Hals / Weichteile")),
    # --- Wirbelsaeule ------------------------------------------------------
    (r"\bhws\b",                             ("Wirbelsäule", "HWS")),
    (r"\bbws\b",                             ("Wirbelsäule", "BWS")),
    (r"\blws\b",                             ("Wirbelsäule", "LWS")),
    (r"gesam\w* ws|wirbelsaeule|wirbelsäule|\bws\b|bandscheibe",
                                             ("Wirbelsäule", "Gesamte Wirbelsäule")),
    # --- Thorax ------------------------------------------------------------
    (r"lungenembolie",                       ("Thorax", "Lungenembolie")),
    (r"mammo|mamma|brust",                   ("Thorax", "Mamma")),
    (r"thorax abdomen|thorax oberbauch|thorax ob|tho abd|thorax abd",
                                             ("Thorax", "Thorax & Abdomen")),
    (r"thorax",                              ("Thorax", "Thorax")),
    # --- Abdomen -----------------------------------------------------------
    (r"cholangio",                           ("Abdomen", "Gallenwege (MRCP)")),
    (r"pankreas|plasmozytom",                ("Abdomen", "Pankreas")),
    (r"leber|hcc",                           ("Abdomen", "Leber")),
    (r"niere|nebenniere|steinsuche|urograph",("Abdomen", "Nieren & Nebennieren")),
    (r"sellink|hernie",                      ("Abdomen", "Dünndarm & Bauchwand")),
    (r"abdomen|\bbba\b|\bob\b|oberbauch",    ("Abdomen", "Abdomen gesamt")),
    # --- Becken ------------------------------------------------------------
    (r"prostata|krebshilfe|fusionsbiopsie",  ("Becken", "Prostata")),
    (r"gyntumore|gyn",                       ("Becken", "Gynäkologische Tumoren")),
    (r"rektum",                              ("Becken", "Rektum")),
    (r"fistel|defäkogra|defaekogra|defäkogramm", ("Becken", "Perianale Fistel & Beckenboden")),
    (r"becken knöchern|becken knoechern|beckenteilersatz", ("Becken", "Becken knöchern")),
    (r"blase|hoden",                         ("Becken", "Harnblase & Hoden")),
    (r"becken",                              ("Becken", "Becken")),
    # --- Gefaesse ----------------------------------------------------------
    (r"aorta",                               ("Gefäße", "Aorta")),
    (r"angio|bein angio|peripherie",         ("Gefäße", "Periphere Gefäße")),
    # --- Gelenke / Extremitaeten ------------------------------------------
    (r"\bknie\b",                            ("Gelenke", "Knie")),
    (r"schulter|rotatoren",                  ("Gelenke", "Schulter")),
    (r"bizepssehne|oberarm",                 ("Gelenke", "Oberarm & Bizepssehne")),
    (r"ellenbogen",                          ("Gelenke", "Ellenbogen")),
    (r"handgel",                             ("Gelenke", "Handgelenk")),
    (r"daumen|finger|\bhand\b|hand\*",       ("Gelenke", "Hand & Finger")),
    (r"\bosg\b|sprunggelenk",                ("Gelenke", "OSG")),
    (r"vorfuss|\bfuss\b|\bfuß\b|zehen",      ("Gelenke", "Fuß")),
    (r"h(ü|ue)fte",                          ("Gelenke", "Hüfte")),
    (r"\bisg\b",                             ("Gelenke", "ISG")),
    (r"ober.*unterschenkel|unterschenkel|oberschenkel|muskelstruktur|myopathie|muskel",
                                             ("Extremitäten", "Ober- & Unterschenkel / Muskulatur")),
    (r"ober.*unterarm|arme oben|arm oben",   ("Extremitäten", "Arm")),
    (r"untere extremit",                     ("Extremitäten", "Untere Extremität")),
    (r"obere extremit",                      ("Extremitäten", "Obere Extremität")),
    (r"extremit",                            ("Extremitäten", "Extremitäten")),
    # --- Ganzkoerper -------------------------------------------------------
    (r"ganzk(ö|oe)rper|kopf bis fuss|lymphom|polytrauma|porsche",
                                             ("Ganzkörper", "Ganzkörper")),
    (r"skelett",                             ("Ganzkörper", "Muskel & Skelett")),
]
_REGION_RX = [(re.compile(p), t) for p, t in REGION_RULES]

def region_of(study_raw):
    k = _study_key(study_raw)
    for rx, t in _REGION_RX:
        if rx.search(k):
            return t
    return ("Sonstige", "Sonstige Untersuchung")

# -------------------------------------------------------------------- Thema
# Reihenfolge = Prioritaet. Erste Regel, die in den Klin. Angaben greift, gewinnt.
THEMA_RULES = [
    ("Mammakarzinom",              r"mamma[ -]?(ca|karzinom)|mammakarzinom|brustkrebs"),
    ("Prostatakarzinom",           r"prostata[ -]?(ca|karzinom)|psa|fusionsbiopsie|pi-rads|prostatakarzinom"),
    ("Rektum- & Analkarzinom",     r"rektum[ -]?(ca|karzinom)|analkarzinom|anal[ -]?ca\b"),
    ("Kolon- & Sigmakarzinom",     r"kolon[ -]?(ca|karzinom)|sigma[ -]?(ca|karzinom)|kolorektal"),
    ("Ovarialkarzinom",            r"ovarial|adnex[ -]?(ca|karzinom)|tuben"),
    ("Zervix- & Endometriumkarzinom", r"zervix|cervix|endometrium|corpus[ -]?uteri|vulva|vagina"),
    ("Bronchialkarzinom & Lungenrundherd", r"bronchial|lungen[ -]?(ca|karzinom)|nsclc|sclc|pulmonaler? rundherd|rundherd"),
    ("HNO-Tumoren",                r"larynx|hypopharynx|oropharynx|tonsillen|zungengrund|parotis[ -]?(ca|karzinom)|mundboden|kopf-hals-tumor|hno-tumor"),
    ("Ösophagus- & Magenkarzinom", r"(ö|oe)sophagus|magen[ -]?(ca|karzinom)|kardia|gist"),
    ("Pankreaskarzinom",           r"pankreas[ -]?(ca|karzinom)|pankreaskopf|ipmn|zystische pankreas"),
    ("Hepatozelluläres Karzinom & Leberherde", r"\bhcc\b|hepatozellul|leberzirrhose|cholangiozellul|\bccc\b|klatskin|leberherd|leberraumforderung"),
    ("Nierenzellkarzinom",         r"nieren[ -]?(ca|karzinom|zellkarzinom)|nierentumor"),
    ("Harnblasenkarzinom",         r"harnblasen[ -]?(ca|karzinom)|urothel"),
    ("Hodentumor",                 r"hoden[ -]?(ca|tumor)|seminom|keimzell"),
    ("Malignes Lymphom",           r"lymphom|hodgkin|\bcll\b|\bnhl\b|leuk(ä|ae)mie"),
    ("Plasmozytom & Myelom",       r"plasmozytom|myelom"),
    ("Malignes Melanom",           r"melanom"),
    ("Sarkom & Weichteiltumor",    r"sarkom|\bgist\b|weichteiltumor|liposarkom|desmoid"),
    ("Schilddrüsenkarzinom",       r"schilddr(ü|ue)sen[ -]?(ca|karzinom)|struma maligna"),
    ("Neuroendokriner Tumor",      r"\bnet\b|neuroendokrin|karzinoid"),
    ("Metastasen bei unbekanntem Primärtumor", r"\bcup\b|unbekannter? primär|primariussuche|tumorsuche"),
    ("Tumornachsorge & unklare Raumforderung", r"karzinom|malign|tumor|neoplas|\bnpl\b|metastas|\bca\b"),
    ("Vorsorge & Gesundheits-Check", r"porsche|boxenstopp|gesundheitsvorsorge|vorsorge|check-?up|screening"),
    ("Trauma & Distorsion",        r"distorsion|trauma|sturz|unfall|verletzung|prellung|verdreh|umkn|luxation|anprall|ruptur|kontusion|\briss\b|läsion|einriss|binnenschaden"),
    ("Fraktur & Frakturkontrolle", r"fraktur|bruch|osteosynthese|durchbauung|konsolidier|pseudarthrose"),
    ("Entzündung, Abszess & Infektion", r"abszess|absze(ß|ss)|entz(ü|ue)nd|infekt|osteomyelit|spondylodiszit|phlegmon|sepsis|fieber|arthritis|bursitis|tendinit|fasziit|otitis|pyelonephrit|cholesteatom|mastoidit|itis\b|pneumoni"),
    ("Chronisch-entzündliche Darmerkrankung", r"morbus crohn|colitis|\bced\b|divertikulit"),
    ("Perianale Fistel",           r"fistel|periproktit|sinus pilonidalis"),
    ("Endometriose",               r"endometriose|adenomyos"),
    ("Sinusitis & NNH-Erkrankung", r"sinusitis|polyposis nasi|nnh|septumdeviation"),
    ("Bandscheibenvorfall & Radikulopathie", r"bandscheib|prolaps|nucleus pulposus|radikul|spinalkanalstenose|ischialgie|lumboischialgie|lumbalgie|zervikobrachial|\bnpp\b|cauda"),
    ("Degenerative Gelenkerkrankung & Schmerz", r"arthrose|degenerativ|impingement|schmerz|beschwerden|omarthrose|gonarthrose|coxarthrose|instabilit|algie(?!e)|epicondylit|dynie|malazie|-syndrom|sehnenansatz|tendinos|karpaltunnel|knorpelschaden|chondropath"),
    ("Gefäßerkrankung",            r"aneurysma|dissektion|\bpavk\b|stenose der|embolie|thrombose|ischäm|ischaem|bypass|stent|gefäß"),
    ("Postoperativer Verlauf",     r"z\.? ?n\.? ?op|zustand nach|postoperativ|\bz\. n\.|nach operation|resektion|prothese|\btep\b"),
    ("Urolithiasis & Harnstau",    r"stein|kolik|harnstau|hydronephros|urolithias"),
    ("Zysten & benigne Läsionen",  r"zyste|h(ä|ae)mangiom|adenom|lipom|myom|fnh|ganglion|raumforderung|osteochondrom|enchondrom"),
]
_THEMA_RX = [(n, re.compile(p, re.I)) for n, p in THEMA_RULES]

def thema_of(klinik, frage=""):
    t = ((klinik or "") + " " + (frage or "")).lower()
    if not t.strip():
        return "Allgemeine Indikation"
    for name, rx in _THEMA_RX:
        if rx.search(t):
            return name
    return "Allgemeine Indikation"

# ------------------------------------------------------------- Fragestellung
FRAGE_RULES = [
    ("Lokales Staging & Ausbreitungsdiagnostik", r"lokale?s? staging|lokale ausbreitung|ausbreitungsdiagnostik|lokale? ausdehnung|infiltration|mrf|t-?stadium"),
    ("Therapie- & OP-Planung",     r"therapieplanung|op-?planung|op-?vorbereitung|bestrahlungsplanung|planung|biopsie geplant|fusionsbiopsie|interventionsplanung|resektabilit"),
    ("Restaging & Therapieansprechen", r"restaging|re-?staging|zwischenstaging|therapieansprechen|ansprechen|response|unter therapie|nach chemo|nach radiochemo"),
    ("Primäres Staging",           r"^staging|staging|erstdiagnose|primärstaging|statuserhebung|tumorsuche|primärtumor"),
    ("Rezidiv & Nachsorge",        r"nachsorge|rezidiv|lokalrezidiv|wiederauftreten|tumornachsorge"),
    ("Metastasensuche",            r"metastas|filiae|absiedl"),
    ("Verlaufskontrolle",          r"verlaufskontrolle|verlauf|kontrolle|progress|konstanz|größenverlauf"),
    ("Verletzungsfolgen & Trauma", r"verletzungsfolg|traumafolg|trauma|verletzung|bandl(ä|ae)sion|bandruptur|bandverletzung|bandschaden|kniebinnenschaden|binnenschaden|meniskus|rotatorenmanschette|\brm\b|sehnenriss|ruptur|unfallfolge|knorpelschaden|tfcc|einriss|\briss\b|l(ä|ae)sion|instabilit"),
    ("Fraktur & Konsolidierung",   r"fraktur|durchbauung|konsolidier|pseudarthrose|osteosynthese"),
    ("Entzündung & Abszess",       r"abszess|absze(ß|ss)|entz(ü|ue)nd|infekt|osteomyelit|spondylodiszit|arthritis|fistel|sinusitis|pneumonit|divertikulit|prostatit|cholesteatom|itis\b|mastoidit"),
    ("Dignität unklarer Befund",   r"dignit|malignit|malignom|tumor|karzinom|raumforderung|auffälligkeit|\bnpl\b|suspekt|unklar|neoplas|lymphom|\bhcc\b|adenom|zyste|herd"),
    ("Ursache der Beschwerden",    r"ursache|beschwerden|schmerz|ausma(ß|ss)|ausdehnung|ausbreitung|abkl(ä|ae)rung|kl(ä|ae)rung|befund\?|impingement|spinalkanalstenose|bandscheibenvorfall|prolaps|auspr(ä|ae)gung|fokussuche|hernie|ausschluss|\bnpp\b|arthrose|degenerat"),
    ("Vorsorgeuntersuchung",       r"vorsorge|krebshilfe|studie|boxenstopp|check"),
]
_FRAGE_RX = [(n, re.compile(p, re.I)) for n, p in FRAGE_RULES]

def frage_of(frage, klinik=""):
    t = (frage or "").strip().lower()
    if not t:
        t = (klinik or "").lower()
    for name, rx in _FRAGE_RX:
        if rx.search(t):
            return name
    return "Allgemeine Befundabklärung"
