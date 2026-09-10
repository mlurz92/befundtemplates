# -*- coding: utf-8 -*-
"""Parst den Rohkorpus (CSV, Trennzeichen |) in strukturierte Befund-Records."""
import csv, re, sys, json, unicodedata

csv.field_size_limit(10**9)

FIELDS = ["Titel", "Klin. Angaben", "Fragestellung", "Methodik", "Befund", "Beurteilung"]
# Varianten der Feldmarken, wie sie im Export vorkommen
MARKERS = [
    ("titel",        r"Titel\s*:"),
    ("klinik",       r"Klin(?:\.|ische)?\s*Angaben?\s*:"),
    ("frage",        r"Frage\s*stellung\s*:|Fragestellung\s*:"),
    ("methodik",     r"Methodik\s*:|Technik\s*:"),
    ("befund",       r"Befund\s*:"),
    ("beurteilung",  r"Beurteilung\s*:|Bewertung\s*:"),
]
MARK_RE = re.compile("|".join("(?P<%s>%s)" % (k, v) for k, v in MARKERS))
# Fallback: gleiche Marken ohne Doppelpunkt (kommt im Export bei ~20 % der Datensaetze vor)
MARKERS_NC = [
    ("titel",       r"\bTitel(?=\s)"),
    ("klinik",      r"\bKlin(?:\.|ische)?\s*Angaben?(?=\s)"),
    ("frage",       r"\bFragestellung(?=\s)"),
    ("methodik",    r"\bMethodik(?=\s)"),
    ("befund",      r"\bBefund(?=\s)"),
    ("beurteilung", r"\bBeurteilung(?=\s)"),
]
MARK_RE_NC = re.compile("|".join("(?P<%s>%s)" % (k, v) for k, v in MARKERS_NC))

def clean(s):
    if s is None: return ""
    s = s.replace(" ", " ").replace("\r", " ").replace("\n", " ")
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"\s*--\s*$", "", s.strip())
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip(" .;,-").strip() if False else s.strip()

def _sections(text, rx):
    out = {}
    hits = list(rx.finditer(text))
    if not hits:
        return {}
    # nur die jeweils erste Marke je Feldtyp eroeffnet einen Abschnitt,
    # spaetere Treffer desselben Typs sind Fliesstext und werden angehaengt
    seen = set()
    keep = []
    for m in hits:
        if m.lastgroup in seen:
            continue
        seen.add(m.lastgroup)
        keep.append(m)
    for i, m in enumerate(keep):
        start = m.end()
        end = keep[i + 1].start() if i + 1 < len(keep) else len(text)
        out[m.lastgroup] = clean(text[start:end]).lstrip(":").strip()
    return out


def split_report(text):
    text = clean(text)
    out = _sections(text, MARK_RE)
    if len(out) < 2:
        alt = _sections(text, MARK_RE_NC)
        if len(alt) > len(out):
            out = alt
    if not out:
        return {"befund": text}
    return out

def main(path):
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        r = csv.reader(f, delimiter="|")
        header = next(r)
        for i, row in enumerate(r, start=1):
            if len(row) < 3: continue
            mod, study, raw = row[0].strip(), row[1].strip(), row[2]
            rec = split_report(raw)
            rec["id"] = "AS-%06d" % i
            rec["mod_raw"] = mod
            rec["study_raw"] = study
            rows.append(rec)
    json.dump(rows, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
    # Statistik
    import collections
    c = collections.Counter()
    for r_ in rows:
        for k in ["titel","klinik","frage","methodik","befund","beurteilung"]:
            if r_.get(k): c[k]+=1
    print(len(rows), dict(c))

if __name__ == "__main__":
    main(sys.argv[1], )
