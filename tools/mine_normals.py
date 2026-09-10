# -*- coding: utf-8 -*-
"""Extrahiert je Modalitaet/Region die haeufigsten Negativ-/Normalsaetze und Methodikzeilen."""
import json, re, sys, collections
sys.path.insert(0, "/home/user/befundtemplates/tools")
import taxonomy as T

PATHO = re.compile(
    r"metastas|karzinom|tumor|malign|ruptur|fraktur|abszess|infiltrat|verdickt|stenos|"
    r"raumforderung|prolaps|erguss|ödem|oedem|riss|läsion|suspekt|progredien|nekros|"
    r"entzünd|defekt|verdächtig|pathologisch|einriss|arthros|degenerativ", re.I)

def sentences(t):
    t = re.sub(r"\s+", " ", t or "")
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if 3 < len(s.strip()) < 160]

def main(parsed, out):
    d = json.load(open(parsed, encoding="utf-8"))
    sent = collections.defaultdict(collections.Counter)
    meth = collections.defaultdict(collections.Counter)
    beur = collections.defaultdict(collections.Counter)
    for r in d:
        key = (T.norm_mod(r["mod_raw"]), T.region_of(r["study_raw"])[1])
        b = r.get("befund") or ""
        if r.get("methodik"):
            meth[key][re.sub(r"\s+", " ", r["methodik"]).strip()] += 1
        # nur "normale" Berichte fuer Beurteilungs-Mining
        if not PATHO.search(b) and len(b) > 60:
            beur[key][re.sub(r"\s+", " ", (r.get("beurteilung") or "")).strip()] += 1
        for s in sentences(b):
            if re.match(r"^(Kein|Keine|Regelrecht|Unauff|Normal|Orthotop|Reizlos|Frei|Zart|Schlank|Glatt|Intakt|Die |Der |Das )", s) \
               and not PATHO.search(s):
                sent[key][s] += 1
    res = {}
    for key in set(list(sent) + list(meth)):
        res["%s|%s" % key] = {
            "n_neg": sent[key].most_common(45),
            "methodik": meth[key].most_common(6),
            "beurteilung_normal": [x for x in beur[key].most_common(8) if x[0]],
        }
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(res), "Region-Profile")

main(sys.argv[1], sys.argv[2])
