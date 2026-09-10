# -*- coding: utf-8 -*-
"""
Baut die Datenbasis der Anwendung:

  app/data/index.js            Baum Modalitaet > Region > Thema > Fragestellung + Metadaten
  app/data/reports/<slug>.js   Referenzbefunde je Region (nachladbar, funktioniert auch file://)

Fuer jeden vollstaendigen Pfad wird zusaetzlich ein Normalbefund komponiert.
"""
import json, os, re, sys, hashlib, unicodedata, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import taxonomy as T
import normal_templates as NT

OUT = os.path.join(os.path.dirname(HERE), "app", "data")

ONKO_THEMEN = {
    "Mammakarzinom", "Prostatakarzinom", "Rektum- & Analkarzinom", "Kolon- & Sigmakarzinom",
    "Ovarialkarzinom", "Zervix- & Endometriumkarzinom", "Bronchialkarzinom & Lungenrundherd",
    "HNO-Tumoren", "Ösophagus- & Magenkarzinom", "Pankreaskarzinom",
    "Hepatozelluläres Karzinom & Leberherde", "Nierenzellkarzinom", "Harnblasenkarzinom",
    "Hodentumor", "Malignes Lymphom", "Plasmozytom & Myelom", "Malignes Melanom",
    "Sarkom & Weichteiltumor", "Schilddrüsenkarzinom", "Neuroendokriner Tumor",
    "Metastasen bei unbekanntem Primärtumor", "Tumornachsorge & unklare Raumforderung",
}
TRAUMA_THEMEN = {"Trauma & Distorsion", "Fraktur & Frakturkontrolle"}
INF_THEMEN = {"Entzündung, Abszess & Infektion", "Chronisch-entzündliche Darmerkrankung",
              "Perianale Fistel", "Sinusitis & NNH-Erkrankung"}

# Repraesentative klinische Angabe je Thema (fuer den Normalbefund-Kopf)
KLINIK_BY_THEMA = {
    "Mammakarzinom": "Mammakarzinom.",
    "Prostatakarzinom": "Erhöhter PSA-Wert.",
    "Rektum- & Analkarzinom": "Rektumkarzinom.",
    "Kolon- & Sigmakarzinom": "Kolonkarzinom.",
    "Ovarialkarzinom": "Ovarialkarzinom.",
    "Zervix- & Endometriumkarzinom": "Zervixkarzinom.",
    "Bronchialkarzinom & Lungenrundherd": "Bronchialkarzinom.",
    "HNO-Tumoren": "Oropharynxkarzinom.",
    "Ösophagus- & Magenkarzinom": "Ösophaguskarzinom.",
    "Pankreaskarzinom": "Pankreaskopfkarzinom.",
    "Hepatozelluläres Karzinom & Leberherde": "Leberzirrhose. Verdacht auf HCC.",
    "Nierenzellkarzinom": "Nierenzellkarzinom.",
    "Harnblasenkarzinom": "Harnblasenkarzinom.",
    "Hodentumor": "Hodentumor.",
    "Malignes Lymphom": "Malignes Lymphom.",
    "Plasmozytom & Myelom": "Multiples Myelom.",
    "Malignes Melanom": "Malignes Melanom.",
    "Sarkom & Weichteiltumor": "Weichteilsarkom.",
    "Schilddrüsenkarzinom": "Schilddrüsenkarzinom.",
    "Neuroendokriner Tumor": "Neuroendokriner Tumor.",
    "Metastasen bei unbekanntem Primärtumor": "Metastasen bei unbekanntem Primärtumor.",
    "Tumornachsorge & unklare Raumforderung": "Tumornachsorge.",
    "Vorsorge & Gesundheits-Check": "Individuelle Gesundheitsvorsorge.",
    "Trauma & Distorsion": "Distorsion.",
    "Fraktur & Frakturkontrolle": "Zustand nach Fraktur.",
    "Entzündung, Abszess & Infektion": "Verdacht auf einen entzündlichen Prozess.",
    "Chronisch-entzündliche Darmerkrankung": "Morbus Crohn.",
    "Perianale Fistel": "Perianale Fistel.",
    "Endometriose": "Verdacht auf Endometriose.",
    "Sinusitis & NNH-Erkrankung": "Chronische Sinusitis.",
    "Bandscheibenvorfall & Radikulopathie": "Radikuläres Syndrom.",
    "Degenerative Gelenkerkrankung & Schmerz": "Persistierende Beschwerden.",
    "Gefäßerkrankung": "Bekannte Gefäßerkrankung.",
    "Postoperativer Verlauf": "Zustand nach Operation.",
    "Urolithiasis & Harnstau": "Kolikartige Flankenschmerzen.",
    "Zysten & benigne Läsionen": "Unklare Raumforderung.",
    "Allgemeine Indikation": "Keine Angabe.",
}

# Fragestellungs-Phaenotyp -> Ordnung und Beurteilung des Normalbefundes
FRAGE_SPEC = {
    "Primäres Staging": dict(
        frage="Staging.", vergleich=False, prior="Keine Voraufnahmen.", onk=True,
        beur="Kein Nachweis von Fernmetastasen und metastasensuspekten Lymphknoten."),
    "Lokales Staging & Ausbreitungsdiagnostik": dict(
        frage="Lokale Ausbreitungsdiagnostik erbeten.", vergleich=False,
        prior="Keine Voraufnahmen.", onk=True,
        beur="Kein Nachweis einer lokalen Tumorausbreitung."),
    "Restaging & Therapieansprechen": dict(
        frage="Restaging.", vergleich=True, konstanz=True, onk=True,
        beur="Kein Nachweis von Tumormanifestationen im Untersuchungsgebiet."),
    "Verlaufskontrolle": dict(
        frage="Verlaufskontrolle.", vergleich=True, onk=False,
        beur="Unveränderter Befund."),
    "Rezidiv & Nachsorge": dict(
        frage="Nachsorge. Rezidiv?", vergleich=True, onk=True,
        extra=["Kein Lokalrezidiv."],
        beur="Kein Nachweis eines Lokalrezidivs."),
    "Metastasensuche": dict(
        frage="Metastasen?", vergleich=False, prior="Keine Voraufnahmen.", onk=True,
        beur="Kein Nachweis von Metastasen."),
    "Therapie- & OP-Planung": dict(
        frage="Therapieplanung.", vergleich=False, prior="Keine Voraufnahmen.", onk=True,
        beur="Keine planungsrelevanten Auffälligkeiten."),
    "Verletzungsfolgen & Trauma": dict(
        frage="Verletzungsfolgen?", vergleich=False, prior="Keine Voraufnahmen.", trauma=True,
        beur="Keine Verletzungsfolgen."),
    "Fraktur & Konsolidierung": dict(
        frage="Fraktur?", vergleich=False, prior="Keine Voraufnahmen.", trauma=True,
        beur="Kein Frakturnachweis."),
    "Entzündung & Abszess": dict(
        frage="Entzündung?", vergleich=False, prior="Keine Voraufnahmen.", inf=True,
        beur="Keine Hinweise auf einen entzündlichen Prozess."),
    "Dignität unklarer Befund": dict(
        frage="Dignität?", vergleich=False, prior="Keine Voraufnahmen.",
        beur="Kein Nachweis einer malignomsuspekten Formation."),
    "Ursache der Beschwerden": dict(
        frage="Ursache der Beschwerden?", vergleich=False, prior="Keine Voraufnahmen.",
        beur=None),
    "Vorsorgeuntersuchung": dict(
        frage="Individuelle Gesundheitsvorsorge.", vergleich=False, prior="Keine Voraufnahmen.",
        beur="Kein pathologischer Befund im Untersuchungsgebiet."),
    "Allgemeine Befundabklärung": dict(
        frage="Abklärung erbeten.", vergleich=False, prior="Keine Voraufnahmen.",
        beur=None),
}

# Untersuchungsbezeichnung im Titel (Regionslabel ist teils ein UI-Label, kein Befundtitel)
TITEL_REGION = {
    "Thorax & Abdomen": "Thorax und Abdomen",
    "Nasennebenhöhlen & Gesichtsschädel": "Nasennebenhöhlen",
    "Nieren & Nebennieren": "Nieren und Nebennieren",
    "Gallenwege (MRCP)": "Gallenwege",
    "Hals / Weichteile": "Hals",
    "Perianale Fistel & Beckenboden": "Becken",
    "Gynäkologische Tumoren": "Becken",
    "Harnblase & Hoden": "Becken",
    "Becken knöchern": "Becken knöchern",
    "Ober- & Unterschenkel / Muskulatur": "Ober- und Unterschenkel",
    "Oberarm & Bizepssehne": "Oberarm",
    "Hand & Finger": "Hand",
    "Dünndarm & Bauchwand": "Abdomen",
    "Gesamte Wirbelsäule": "gesamte Wirbelsäule",
    "Abdomen gesamt": "Abdomen",
    "Periphere Gefäße": "Becken-Bein-Arterien",
    "Sonstige Untersuchung": "Untersuchung",
    "Lungenembolie": "Thorax",
    "Neurokranium": "Schädel",
}

def titel(mod, region, meth):
    km = "mit KM" if re.search(r"post KM|Kontrastmittelgest|CTA|MRA|mit KM", meth) else "nativ"
    return "%s %s %s" % (mod, TITEL_REGION.get(region, region), km)

def _kernbegriff(satz):
    """Letztes Substantiv eines Kurzsatzes - dient der Redundanzpruefung."""
    w = re.sub(r"[^\wÄÖÜäöüß]+$", "", satz.strip()).split()
    return w[-1].lower() if w else ""

def dedupe(seq):
    out, seen = [], set()
    for s in seq:
        k = s.lower()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out

def compose_normal(mod, region, thema, frage):
    tpl = NT.R["%s|%s" % (mod, region)]
    spec = FRAGE_SPEC[frage]
    sents = []
    if spec.get("vergleich"):
        sents.append("Es liegt die %s vom %s zum Vergleich vor." % (mod, NT.DATE))
    elif spec.get("prior"):
        sents.append(spec["prior"])
    pending_extra = list(spec.get("extra", []))
    sents += tpl["core"]
    if spec.get("onk") or thema in ONKO_THEMEN:
        sents += tpl["onk"]
    if spec.get("trauma") or thema in TRAUMA_THEMEN:
        sents += tpl["trauma"]
    if spec.get("inf") or thema in INF_THEMEN:
        sents += tpl["inf"]
    # Zusatzsaetze des Phaenotyps nur, wenn der Kernbegriff noch nicht vorkommt
    joined = " ".join(sents).lower()
    for e in pending_extra:
        if _kernbegriff(e) not in joined:
            sents.insert(1, e)
    if spec.get("konstanz"):
        sents.append("Keine Befundänderung im Vergleich zur Voruntersuchung.")
    befund = " ".join(dedupe(sents))
    beur = spec.get("beur") or tpl["beur"]
    return {
        "titel": titel(mod, region, tpl["meth"]),
        "klinik": KLINIK_BY_THEMA.get(thema, "Keine Angabe."),
        "frage": spec["frage"],
        "methodik": tpl["meth"],
        "befund": befund,
        "beurteilung": beur,
    }

# --------------------------------------------------------------- Qualitaet
def quality(rec):
    b = rec.get("befund") or ""
    q = 0
    if rec.get("beurteilung"): q += 30
    if rec.get("methodik"): q += 12
    if rec.get("titel"): q += 8
    if rec.get("klinik"): q += 6
    if rec.get("frage"): q += 6
    n = len(b.split())
    q += 24 if 45 <= n <= 220 else (14 if 25 <= n < 45 else (10 if n > 220 else 0))
    # Vollstaendige Saetze statt Fragmenten
    if b.endswith("."): q += 4
    if re.search(r"\bSerie \d+, Bild \d+", b): q += 3
    if re.search(r"nicht (?:hinreichend |suffizient )?(?:beurteilbar|zu beurteilen)|Untersuchung abgebrochen", b): q -= 20
    return q

def slug(s):
    s = unicodedata.normalize("NFKD", s)
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "x"

def main(parsed_path):
    rows = json.load(open(parsed_path, encoding="utf-8"))
    tree = {}          # mod -> region -> thema -> frage -> [report refs]
    groups = {}        # mod -> region -> group
    store = collections.defaultdict(list)   # regionslug -> [report]
    seen_text = set()

    for r in rows:
        mod = T.norm_mod(r["mod_raw"])
        grp, region = T.region_of(r["study_raw"])
        thema = T.thema_of(r.get("klinik"), r.get("frage"))
        frage = T.frage_of(r.get("frage"), r.get("klinik"))
        befund = (r.get("befund") or "").strip()
        if len(befund) < 40:
            continue
        key = hashlib.md5(re.sub(r"[^a-zäöüß]", "", (befund + (r.get("beurteilung") or "")).lower())[:500]
                          .encode("utf-8")).hexdigest()
        if key in seen_text:
            continue
        seen_text.add(key)

        rec = {
            "id": r["id"],
            "titel": r.get("titel") or titel(mod, region, r.get("methodik") or ""),
            "klinik": r.get("klinik") or "",
            "frage": r.get("frage") or "",
            "methodik": r.get("methodik") or "",
            "befund": befund,
            "beurteilung": r.get("beurteilung") or "",
            "studie": r["study_raw"],
        }
        rec["q"] = quality(rec)
        rsl = slug(mod + "-" + region)
        store[rsl].append(rec)
        groups.setdefault(mod, {})[region] = grp
        tree.setdefault(mod, {}).setdefault(region, {}).setdefault(thema, {}) \
            .setdefault(frage, []).append(rec["id"])

    # Sortierung: beste Referenz zuerst
    for rsl, lst in store.items():
        lst.sort(key=lambda x: (-x["q"], x["id"]))

    os.makedirs(os.path.join(OUT, "reports"), exist_ok=True)
    normals = collections.defaultdict(dict)   # regionslug -> "thema||frage" -> Normalbefund
    index = {"modalitaeten": {}, "meta": {}}
    total_norm = 0
    for mod in sorted(tree):
        regs = {}
        for region in sorted(tree[mod]):
            rsl = slug(mod + "-" + region)
            themen = {}
            for thema in sorted(tree[mod][region]):
                fragen = {}
                for frage in sorted(tree[mod][region][thema]):
                    ids = tree[mod][region][thema][frage]
                    order = {r["id"]: i for i, r in enumerate(store[rsl])}
                    ids.sort(key=lambda i: order.get(i, 10**9))
                    fragen[frage] = ids
                    normals[rsl][thema + "||" + frage] = compose_normal(mod, region, thema, frage)
                    total_norm += 1
                themen[thema] = {"n": sum(len(v) for v in fragen.values()),
                                 "fragen": fragen}
            regs[region] = {
                "gruppe": groups[mod][region],
                "slug": rsl,
                "n": sum(t["n"] for t in themen.values()),
                "methodik": NT.R["%s|%s" % (mod, region)]["meth"],
                "themen": themen,
            }
        index["modalitaeten"][mod] = regs

    for rsl, lst in store.items():
        payload = {r["id"]: {k: r[k] for k in
                             ("titel", "klinik", "frage", "methodik", "befund",
                              "beurteilung", "studie", "q")} for r in lst}
        with open(os.path.join(OUT, "reports", rsl + ".js"), "w", encoding="utf-8") as f:
            f.write("window.__BT_SHARD__(%s,%s,%s);\n"
                    % (json.dumps(rsl),
                       json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                       json.dumps(normals[rsl], ensure_ascii=False, separators=(",", ":"))))

    index["meta"] = {
        "referenzbefunde": sum(len(v) for v in store.values()),
        "normalbefunde": total_norm,
        "regionen": sum(len(v) for v in index["modalitaeten"].values()),
        "pfade": total_norm,
    }
    with open(os.path.join(OUT, "index.js"), "w", encoding="utf-8") as f:
        f.write("window.__BT_INDEX__ = %s;\n"
                % json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps(index["meta"], ensure_ascii=False))
    sizes = sorted(((os.path.getsize(os.path.join(OUT, "reports", f)) // 1024, f)
                    for f in os.listdir(os.path.join(OUT, "reports"))), reverse=True)
    print("index.js %d KB, groesster Shard %s" % (os.path.getsize(os.path.join(OUT, "index.js")) // 1024, sizes[0]))

if __name__ == "__main__":
    main(sys.argv[1])
