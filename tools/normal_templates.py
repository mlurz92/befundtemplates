# -*- coding: utf-8 -*-
"""
Normalbefund-Bibliothek.

Die Bausteine sind aus dem Korpus abgeleitet: jeder Satz stammt als Formulierung aus
den haeufigsten Negativ-/Normalsaetzen der jeweiligen Modalitaet/Region. Zusammen-
gesetzt wird nach Regionsprofil (Organinventar), Themenklasse (onkologisch, Trauma,
Entzuendung) und Fragestellungs-Phaenotyp (Ordnung + Beurteilung).

Es werden keine Messwerte, Vergleichsdaten oder Befunde erfunden: wo ein Vergleich
zum Phaenotyp gehoert, steht ein ausdruecklicher Platzhalter [Datum].
"""

DATE = "[Datum]"

# --------------------------------------------------------------------------
# Regionsprofile:  "MOD|Region" -> dict
#   meth   Methodikzeile
#   core   Normalinventar in korpustypischer Reihenfolge
#   onk    Zusatzsaetze bei onkologischer Fragestellung
#   trauma Zusatzsaetze bei Trauma-/Frakturfrage
#   inf    Zusatzsaetze bei Entzuendungsfrage
#   beur   knappe Normalbeurteilung (Default)
#   organ  Kurzbezeichnung fuer generierte Saetze
# --------------------------------------------------------------------------
R = {}

def reg(key, meth, core, beur, onk=(), trauma=(), inf=(), organ=""):
    R[key] = dict(meth=meth, core=list(core), beur=beur, onk=list(onk),
                  trauma=list(trauma), inf=list(inf), organ=organ)

# ============================ KOPF & HALS =================================
reg("CT|Neurokranium",
    "Spiral-CT des Schädels, 2D-Rekonstruktionen.",
    ["Regelrechte Dichtewerte des supra- und infratentoriellen Hirnparenchyms.",
     "Keine Blutung.", "Kein Infarktnachweis.", "Normale Weite der inneren und äußeren Liquorräume.",
     "Kein Liquoraufstau.", "Mittelständige Falx.",
     "Regelrechte Belüftung der Nasennebenhöhlen, Mittelohren und Mastoide.",
     "Intakte Kalotte."],
    "Regelrechter kranieller Befund.",
    onk=["Keine Hirnmetastasen.", "Keine Osteolysen der Kalotte."],
    trauma=["Kein Nachweis einer intrakraniellen Blutung.", "Keine Kalottenfraktur.",
            "Kein Weichteilhämatom."],
    inf=["Keine Hinweise auf eine Enzephalitis.", "Keine Abszedierung."],
    organ="Hirnparenchym")

reg("MRT|Neurokranium",
    "3 Tesla, sagittale T2, axiale FLAIR, T1, Diffusion, T1 post KM, sagittale MPRAGE post KM, 2D-Rekonstruktionen.",
    ["Regelrechte Signalgebung des supra- und infratentoriellen Hirnparenchyms.",
     "Keine Diffusionsstörung.", "Normale Weite der inneren und äußeren Liquorräume.",
     "Kein Liquoraufstau.", "Normale Meningen.", "Keine pathologische Kontrastmittelaufnahme.",
     "Frei belüftete Nasennebenhöhlen und Mastoide."],
    "Regelrechter kranieller Befund.",
    onk=["Keine Hirnmetastasen.", "Kein Nachweis einer Meningeosis carcinomatosa.",
         "Normales Kalottensignal."],
    trauma=["Keine intrakranielle Blutung.", "Keine Kontusion."],
    inf=["Keine Hinweise auf eine Enzephalitis.", "Kein Empyem."],
    organ="Hirnparenchym")

reg("CT|Nasennebenhöhlen & Gesichtsschädel",
    "Dünnschicht Spiral-CT des Mittelgesichts, 2D-Rekonstruktionen.",
    ["Die Nasennebenhöhlen sind frei belüftet.", "Keine Sekretverhalte.",
     "Keine Schleimhautschwellung.", "Regelrechte Weite der Ostien und des Infundibulums.",
     "Mittelständiges Nasenseptum.", "Frei belüftete Mittelohren und Mastoide.",
     "Intakte Frontobasis.", "Keine ossären Destruktionen."],
    "Regelrechter Befund der Nasennebenhöhlen.",
    onk=["Keine knöchernen Arrosionen.", "Keine Lymphadenopathie."],
    trauma=["Keine Mittelgesichtsfraktur.", "Kein Hämatosinus.", "Kein Orbitabodendefekt."],
    inf=["Keine Hinweise auf eine Sinusitis.", "Keine Orbitaphlegmone."],
    organ="Nasennebenhöhlen")

reg("MRT|Nasennebenhöhlen & Gesichtsschädel",
    "3 Tesla, koronare TIRM, T1, T2, axiale Diffusion, axiale Dixon-VIBE post KM.",
    ["Die Nasennebenhöhlen sind regelrecht belüftet, wie die Mittelohren und Mastoide.",
     "Keine Sekretverhalte.", "Normale Signalgebung der Frontobasis.",
     "Unauffällige Darstellung der Nasenhaupthöhle und der Orbita beidseits.",
     "Normale Signalgebung der Kopfspeicheldrüsen.", "Keine Lymphadenopathie."],
    "Regelrechter Befund des Gesichtsschädels.",
    onk=["Kein Nachweis einer Tumorformation.", "Keine perineurale Ausbreitung."],
    inf=["Keine Hinweise auf eine Sinusitis.", "Keine Abszedierung."],
    organ="Gesichtsschädel")

reg("CT|Felsenbein",
    "Dünnschicht Spiral-CT der Felsenbeine, 2D-Rekonstruktionen.",
    ["Frei belüftete Mittelohren und Mastoide.", "Kein Sekretverhalt im Mittelohr.",
     "Intakte Gehörknöchelchenkette beidseits.", "Das Tegmen tympani ist intakt.",
     "Keine knöchernen Arrosionen.", "Normale Darstellung des äußeren Gehörganges.",
     "Regelrechte Darstellung des Innenohres und des inneren Gehörganges.",
     "Normale Darstellung der Gegenseite."],
    "Regelrechter Felsenbeinbefund.",
    onk=["Keine Destruktion der Gehörknöchelchenkette."],
    trauma=["Keine Felsenbeinfraktur.", "Keine Luxation der Gehörknöchelchenkette."],
    inf=["Keine Hinweise auf ein Cholesteatom.", "Keine Mastoiditis.",
         "Keine knöcherne Destruktion."],
    organ="Felsenbein")

reg("MRT|Orbita",
    "3 Tesla, koronare TIRM, T1, axiale T2, Diffusion, sagittale und koronare T1fs post KM.",
    ["Normale Signalgebung und Konfiguration der Bulbi beidseits.",
     "Regelrechte Darstellung der äußeren Augenmuskeln.",
     "Unauffälliger Nervus opticus beidseits ohne pathologische Kontrastmittelaufnahme.",
     "Normales retrobulbäres Fettgewebe.", "Regelrecht belüftete Nasennebenhöhlen.",
     "Unauffällige Meningen.", "Normale Weite der Liquorräume."],
    "Regelrechter Orbitabefund.",
    inf=["Keine Orbitalphlegmone.", "Keine Dakryoadenitis."],
    organ="Orbita")

reg("MRT|Hypophyse",
    "3 Tesla, sagittale und koronare T2, koronare und sagittale T1, triplanare T1 post KM, sagittale MPRAGE post KM.",
    ["Normal große Hypophyse mit homogener Kontrastmittelaufnahme.",
     "Kein Nachweis eines Mikro- oder Makroadenoms.", "Mittelständiger Hypophysenstiel.",
     "Regelrechte Darstellung des Chiasma opticum.", "Freie Sinus cavernosi.",
     "Kein Liquoraufstau."],
    "Regelrechte Hypophyse.",
    organ="Hypophyse")

reg("MRT|Speicheldrüsen",
    "3 Tesla, koronare TIRM, T1, axiale T1, T2, axiale und koronare T1fs post KM.",
    ["Normale Signalgebung der Kopfspeicheldrüsen.", "Kein Gangaufstau.",
     "Kein Konkrementnachweis.", "Keine fokale Raumforderung.",
     "Normale Darstellung des Zungenkörpers und Mundbodens.",
     "Kein Nachweis einer zervikalen Lymphadenopathie."],
    "Regelrechte Kopfspeicheldrüsen.",
    inf=["Keine Sialadenitis.", "Keine Abszedierung."],
    organ="Kopfspeicheldrüsen")

reg("CT|Hals / Weichteile",
    "Kontrastmittelgestützte Spiral-CT des Halses, 2D-Rekonstruktionen.",
    ["Normale Darstellung der Kopfspeicheldrüsen.", "Regelrechte Schleimhautkontrastierung "
     "von Naso-, Oro- und Hypopharynx sowie Larynx.", "Freie Valleculae und Recessus piriformes.",
     "Normale Schilddrüse.", "Keine Lymphadenopathie.",
     "Frei perfundierte Halsgefäße.", "Regelrechter Skelettstatus im Untersuchungsabschnitt."],
    "Regelrechter Halsbefund.",
    onk=["Kein Nachweis eines Primärtumors.", "Keine metastasensuspekten zervikalen Lymphknoten.",
         "Keine Osteolysen."],
    inf=["Keine Abszedierung.", "Keine Weichteilphlegmone."],
    organ="Hals")

reg("MRT|Hals / Weichteile",
    "3 Tesla, koronare TIRM, axiale T1, T2, Diffusion, Dixon-VIBE post KM.",
    ["Normale Signalgebung der Kopfspeicheldrüsen, des Zungenkörpers und Mundbodens.",
     "Regelrechte Darstellung von Naso-, Oro- und Hypopharynx sowie Larynx.",
     "Keine Diffusionsstörung.", "Keine pathologische Kontrastmittelaufnahme.",
     "Keine Lymphadenopathie.", "Unauffälliges Knochenmarksignal."],
    "Regelrechter Halsbefund.",
    onk=["Kein Nachweis eines Lokalrezidivs.", "Keine metastasensuspekten zervikalen Lymphknoten."],
    inf=["Keine Abszedierung.", "Keine Osteomyelitis."],
    organ="Hals")

# ============================== WIRBELSÄULE ================================
reg("MRT|HWS",
    "3 Tesla, RARE-Myelogramme, sagittale T1, sagittale und axiale T2.",
    ["Die Untersuchung umfasst sagittal den Achsenskelettabschnitt zwischen C1 und Th3.",
     "Regelrechte Halslordose.", "Kein Wirbelgleiten.",
     "Regelrechte Artikulation in den Wirbelgelenken.", "Kein Bandscheibenvorfall.",
     "Keine Spinalkanalstenose.", "Keine Neuroforamenstenose.", "Kein Myelopathiesignal.",
     "Das Knochenmarksignal ist regulär."],
    "Regelrechter Befund der Halswirbelsäule.",
    onk=["Keine Wirbelkörpermetastasen.", "Kein epiduraler Weichteilanteil."],
    trauma=["Keine diskoligamentäre Verletzung.", "Keine Wirbelkörperfraktur.",
            "Kein prävertebrales Hämatom."],
    inf=["Keine Spondylodiszitis.", "Kein Epiduralabszess."],
    organ="Halswirbelsäule")

reg("MRT|BWS",
    "3 Tesla, sagittale TIRM, T1, sagittale und axiale T2.",
    ["Die Untersuchung umfasst sagittal den Achsenskelettabschnitt zwischen C7 und L1.",
     "Regelrechte Brustkyphose.", "Kein Wirbelgleiten.",
     "Die Wirbel zeigen eine reguläre Konfiguration, kein Nachweis von Höhenminderungen.",
     "Keine Bandscheibenpathologie.", "Keine Spinalkanalstenose.", "Normales Myelonsignal.",
     "Regelrechte Artikulation in den Facettengelenken."],
    "Regelrechter Befund der Brustwirbelsäule.",
    onk=["Keine Wirbelkörpermetastasen.", "Keine Rippenpathologie."],
    trauma=["Keine Wirbelkörperfraktur.", "Intakte Hinterkante."],
    inf=["Keine Spondylodiszitis.", "Kein Epiduralabszess."],
    organ="Brustwirbelsäule")

reg("MRT|LWS",
    "3 Tesla, RARE-Myelogramme, sagittale T1, sagittale und axiale T2.",
    ["Die Untersuchung umfasst sagittal den Achsenskelettabschnitt zwischen BWK 11 und SWK 4.",
     "Regelrechte Lendenlordose.", "Kein Wirbelgleiten.", "Keine Gefügestörung.",
     "Kein Bandscheibenvorfall.", "Keine Spinalkanalstenose.",
     "Keine Nervenwurzelkompression.", "Regelrechte Artikulation in den Facettengelenken.",
     "Normale Signalgebung des Conus medullaris.", "Unauffälliges Knochenmark."],
    "Regelrechter Befund der Lendenwirbelsäule.",
    onk=["Keine Wirbelkörpermetastasen.", "Kein epiduraler Weichteilanteil."],
    trauma=["Keine Wirbelkörperfraktur.", "Keine diskoligamentäre Verletzung."],
    inf=["Keine Spondylodiszitis.", "Kein Epiduralabszess.", "Keine Psoasabszedierung."],
    organ="Lendenwirbelsäule")

reg("MRT|Gesamte Wirbelsäule",
    "1,5 Tesla, sagittale TIRM, T1, sagittale und axiale T2.",
    ["Die Untersuchung umfasst sagittal den Achsenskelettabschnitt zwischen C1 und dem Os coccygis.",
     "Regelrechte Wirbelsäulenstatik.", "Kein Wirbelgleiten.",
     "Reguläres Knochenmarksignal aller erfassten Wirbelkörper.",
     "Keine Spinalkanalstenose.", "Kein Myelopathiesignal.",
     "Normale Signalgebung des Conus medullaris."],
    "Regelrechter Befund der gesamten Wirbelsäule.",
    onk=["Keine Wirbelkörpermetastasen.", "Kein extraossärer Weichteilanteil.",
         "Keine pathologische Fraktur."],
    trauma=["Keine Wirbelkörperfraktur.", "Intakte Hinterkanten."],
    inf=["Keine Spondylodiszitis.", "Kein Epiduralabszess."],
    organ="Wirbelsäule")

reg("CT|HWS",
    "Spiral-CT der HWS, 2D-Rekonstruktionen.",
    ["Regelrechte Halslordose.", "Kein Wirbelgleiten.",
     "Regelrechte Artikulation in den Wirbelgelenken sowie im Atlantodentalgelenk und den "
     "Atlantookzipitalgelenken.", "Keine knöcherne Einengung des zervikalen Spinalkanals.",
     "Keine Verlegung der Neuroforamina.", "Keine Osteolysen."],
    "Regelrechter knöcherner Befund der Halswirbelsäule.",
    onk=["Keine Osteolysen.", "Keine Wirbelkörperdestruktion."],
    trauma=["Keine Fraktur.", "Keine Dislokation.", "Kein prävertebrales Hämatom."],
    organ="Halswirbelsäule")

reg("CT|LWS",
    "Spiral-CT der LWS, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Lendenlordose.", "Kein Wirbelgleiten.",
     "Keine Hinterkantenbeteiligung.", "Keine knöcherne Spinalkanalstenose.",
     "Kein Nachweis einer Beteiligung der Wirbelgelenke und der Wirbelbögen.",
     "Keine Osteolysen."],
    "Regelrechter knöcherner Befund der Lendenwirbelsäule.",
    trauma=["Keine Fraktur.", "Intakte Hinterkante."],
    organ="Lendenwirbelsäule")

reg("CT|Gesamte Wirbelsäule",
    "Spiral-CT der Wirbelsäule, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Wirbelsäulenstatik.", "Kein Wirbelgleiten.",
     "Regelrechte Höhe und Konfiguration aller erfassten Wirbelkörper.",
     "Keine Osteolysen.", "Keine knöcherne Spinalkanalstenose.",
     "Keine Verlegung der Neuroforamina."],
    "Regelrechter knöcherner Wirbelsäulenbefund.",
    onk=["Keine Osteolysen.", "Keine stabilitätsgefährdenden Destruktionen."],
    trauma=["Keine Fraktur.", "Intakte Hinterkanten."],
    organ="Wirbelsäule")

# ================================ THORAX ===================================
reg("CT|Thorax",
    "Kontrastmittelgestützte Spiral-CT des Thorax, 2D-Rekonstruktionen, MIP.",
    ["Regelrecht belüftetes Lungenparenchym.", "Keine Infiltrate.", "Keine Rundherde.",
     "Keine Pleuraergüsse.", "Keine mediastinale oder hiläre Lymphadenopathie.",
     "Normal großes Herz.", "Frei perfundierte thorakale Gefäße.",
     "Unauffällige Schilddrüse, soweit erfasst.",
     "Normale Darstellung der erfassten Oberbauchorgane.", "Intaktes Thoraxskelett."],
    "Regelrechter Thoraxbefund.",
    onk=["Keine Lungenmetastasen.", "Keine Pleurakarzinose.",
         "Keine metastasensuspekten axillären, mediastinalen und hilären Lymphknoten.",
         "Keine Osteolysen."],
    trauma=["Kein Pneumothorax.", "Keine Rippenfraktur.", "Keine Lungenkontusion.",
            "Kein Hämatothorax."],
    inf=["Keine Infiltrate.", "Kein Empyem.", "Keine Abszedierung."],
    organ="Thorax")

reg("CT|Lungenembolie",
    "Kontrastmittelgestützte Spiral-CT des Thorax in arterieller Phase, 2D-Rekonstruktionen, MIP.",
    ["Kein Nachweis einer zentralen oder peripheren Lungenarterienembolie.",
     "Regelrechte Kontrastierung des gesamten Pulmonalarterienstromgebietes.",
     "Keine Rechtsherzbelastung.", "Kein Infarktareal.",
     "Regelrecht belüftetes Lungenparenchym.", "Keine Infiltrate.", "Keine Pleuraergüsse.",
     "Keine Lymphadenopathie.", "Intaktes Thoraxskelett."],
    "Keine Lungenembolie.",
    onk=["Keine Lungenmetastasen.", "Keine Pleurakarzinose."],
    organ="Pulmonalarterien")

reg("CT|Thorax & Abdomen",
    "Kontrastmittelgestützte Spiral-CT von Thorax und Abdomen, 2D-Rekonstruktionen, MIP.",
    ["Regelrecht belüftetes Lungenparenchym.", "Keine Infiltrate und Rundherde.",
     "Keine Pleuraergüsse.", "Keine mediastinale oder hiläre Lymphadenopathie.",
     "Normal großes Herz.", "Homogenes Leberparenchym.", "Kein Galleaufstau.",
     "Normales Pankreas, Milz, Nieren und Nebennieren.", "Kein Harnaufstau.",
     "Regelrechte Darstellung des Darmes.", "Kein Aszites.",
     "Keine retroperitoneale und mesenteriale Lymphadenopathie.", "Regelrechter Skelettstatus."],
    "Regelrechter Befund von Thorax und Abdomen.",
    onk=["Keine Lungen- und Lebermetastasen.", "Keine Peritonealkarzinose.",
         "Keine metastasensuspekten Lymphknoten.", "Keine Osteolysen."],
    trauma=["Keine freie Flüssigkeit.", "Keine Organverletzung.", "Kein Pneumothorax."],
    inf=["Keine Infiltrate.", "Keine Abszedierung.", "Keine freie Luft."],
    organ="Thorax und Abdomen")

reg("MRT|Thorax",
    "3 Tesla, koronare TIRM, T1, axiale T2, axiale VIBE post KM.",
    ["Regelrechte Signalgebung der Thoraxwand und der erfassten Muskulatur.",
     "Keine pathologische Kontrastmittelaufnahme.", "Keine Lymphadenopathie.",
     "Keine Pleuraergüsse.", "Unauffälliges Knochenmarksignal.",
     "Regelrechte Signalgebung der parenchymatösen Oberbauchorgane."],
    "Regelrechter Thoraxbefund.",
    onk=["Kein Lokalrezidiv.", "Keine Beteiligung des Rippenthorax.",
         "Keine metastasensuspekten Lymphknoten."],
    organ="Thoraxwand")

reg("MRT|Mamma",
    "1,5 Tesla, axiale TIRM, axiale und koronare T2, axiale Diffusion, Perfusion, "
    "koronare Dixon-VIBE post KM.",
    ["Regelrechte Drüsenkörperarchitektur beidseits.",
     "Kein Nachweis eines kontrastmittelaffinen Herdes.",
     "Kein Non-Mass-Enhancement.", "Keine Diffusionsstörung.", "Keine Hautverdickung.",
     "Keine Mamillenretraktion.", "Keine axilläre Lymphadenopathie beidseits."],
    "Regelrechter Mammabefund. MR-BI-RADS 1.",
    onk=["Kein Nachweis eines Lokalrezidivs.", "Keine kontralaterale Herdformation."],
    organ="Mamma")

reg("CT|Mamma",
    "Kontrastmittelgestützte Spiral-CT von Thorax und Abdomen, 2D-Rekonstruktionen, MIP.",
    ["Keine Lungenmetastasen, Infiltrate und Erguss.",
     "Keine metastasensuspekten axillären, mediastinalen und hilären Lymphknoten.",
     "Homogenes Leberparenchym ohne Metastasen.",
     "Normales Pankreas, Milz, Nieren und Nebennieren.", "Kein Aszites.",
     "Keine Osteolysen."],
    "Kein Nachweis einer Metastasierung.",
    organ="Thorax und Abdomen")

# ================================ ABDOMEN ==================================
reg("CT|Abdomen gesamt",
    "Kontrastmittelgestützte Spiral-CT des Abdomen, 2D-Rekonstruktionen.",
    ["Homogenes Leberparenchym.", "Kein Galleaufstau.",
     "Normales Pankreas, Milz, Nieren und Nebennieren.", "Kein Harnaufstau.",
     "Regelrechte Darstellung von Magen, Dünn- und Dickdarm.", "Keine freie Luft.",
     "Kein Aszites.", "Keine Lymphadenopathie.", "Frei perfundierte abdominelle Gefäße.",
     "Regelrechter Skelettstatus im Untersuchungsabschnitt."],
    "Regelrechter Abdomenbefund.",
    onk=["Keine Lebermetastasen.", "Keine Peritonealkarzinose.",
         "Keine metastasensuspekten Lymphknoten.", "Keine Osteolysen."],
    trauma=["Keine freie Flüssigkeit.", "Keine Organverletzung.", "Kein Kontrastmittelaustritt."],
    inf=["Keine Abszedierung.", "Keine freie Luft.", "Keine Divertikulitis."],
    organ="Abdomen")

reg("MRT|Abdomen gesamt",
    "3 Tesla, axiale und koronare HASTE, axiale Diffusion, axiale und koronare VIBE post KM.",
    ["Homogenes Leberparenchym ohne fokale Läsion.", "Kein Galleaufstau.",
     "Unauffälliges Pankreas, Milz, Nieren und Nebennieren.", "Kein Harnaufstau.",
     "Regelrechte Darstellung des Darmes.", "Kein Aszites.", "Keine Lymphadenopathie.",
     "Keine Diffusionsstörung.", "Unauffälliges Knochenmark."],
    "Regelrechter Abdomenbefund.",
    onk=["Keine Lebermetastasen.", "Keine Peritonealkarzinose.",
         "Keine metastasensuspekten Lymphknoten."],
    inf=["Keine Abszedierung.", "Keine entzündliche Darmwandverdickung."],
    organ="Abdomen")

reg("MRT|Leber",
    "3 Tesla, axiale und koronare HASTE, axiale Diffusion, VIBE nativ und post KM in "
    "mehreren Phasen, koronare VIBE post KM.",
    ["Normal große Leber mit homogenem Parenchymsignal.",
     "Kein Nachweis eines fokalen Leberherdes.", "Keine Diffusionsstörung.",
     "Die Lebergefäße sind offen.", "Kein Galleaufstau.", "Normale Gallenblase.",
     "Normales Pankreas, Milz, Nieren und Nebennieren.", "Kein Aszites.",
     "Keine Lymphadenopathie.", "Unauffälliges Knochenmark."],
    "Regelrechter Leberbefund.",
    onk=["Keine Lebermetastasen.", "Keine Hinweise auf eine Peritonealkarzinose."],
    organ="Leber")

reg("CT|Leber",
    "Mehrphasige, kontrastmittelgestützte Spiral-CT des Abdomen, 2D-Rekonstruktionen.",
    ["Normal große Leber mit homogenem Parenchym.",
     "Kein Nachweis eines hypo- oder hypervaskularisierten Leberherdes.",
     "Die Lebergefäße sind offen.", "Keine Pfortaderthrombose.", "Kein Galleaufstau.",
     "Normale Nieren und Nebennieren sowie Milz und Pankreas.", "Kein Aszites.",
     "Keine Lymphadenopathie."],
    "Regelrechter Leberbefund.",
    onk=["Keine Lebermetastasen.", "Kein Nachweis eines hypervaskulären HCC."],
    organ="Leber")

reg("MRT|Gallenwege (MRCP)",
    "3 Tesla, MRCP, axiale und koronare HASTE, axiale Diffusion, VIBE nativ und post KM in "
    "mehreren Phasen, koronare VIBE post KM.",
    ["Regelrechte Weite und Konfiguration der intra- und extrahepatischen Gallenwege.",
     "Kein Galleaufstau.", "Keine intraduktalen Konkremente.", "Keine Gangstenose.",
     "Normale Gallenblase ohne Konkrementnachweis.",
     "Regelrechter Ductus pancreaticus ohne Hauptgangbeteiligung.",
     "Homogenes Leberparenchym.", "Normale Milz, Nieren und Nebennieren.",
     "Keine Lymphadenopathie.", "Kein Aszites."],
    "Regelrechte Darstellung der Gallenwege.",
    onk=["Kein Nachweis einer Gangstenose.", "Keine Lebermetastasen."],
    inf=["Keine Cholangitis.", "Keine Cholezystitis.", "Keine Abszedierung."],
    organ="Gallenwege")

reg("MRT|Pankreas",
    "3 Tesla, MRCP, axiale und koronare HASTE, axiale T1, Diffusion, VIBE nativ und post KM "
    "in mehreren Phasen, koronare VIBE post KM.",
    ["Normal konfiguriertes Pankreas mit homogenem Parenchymsignal.",
     "Kein Nachweis einer fokalen Pankreasläsion.", "Keine Diffusionsstörung.",
     "Regelrechter Ductus pancreaticus ohne Kaliberschwankung.", "Kein Galleaufstau.",
     "Freies peripankreatisches Fettgewebe.", "Keine peripankreatische Lymphadenopathie.",
     "Normale Milz, Nieren und Nebennieren.", "Kein Aszites."],
    "Regelrechter Pankreasbefund.",
    onk=["Kein Nachweis eines Pankreastumors.", "Keine Gefäßinfiltration.",
         "Keine Lebermetastasen."],
    inf=["Keine Pankreatitis.", "Keine Pseudozyste.", "Keine Nekrosestraße."],
    organ="Pankreas")

reg("CT|Pankreas",
    "Mehrphasige, kontrastmittelgestützte Spiral-CT des Abdomen, 2D-Rekonstruktionen.",
    ["Normal konfiguriertes Pankreas mit homogener Kontrastierung.",
     "Kein Nachweis einer fokalen Pankreasläsion.", "Regelrechter Ductus pancreaticus.",
     "Kein Galleaufstau.", "Die Pfortader ist offen, wie Konfluens und Vena mesenterica superior.",
     "Freies peripankreatisches Fettgewebe.", "Keine Lymphadenopathie.",
     "Normale Nieren, Nebennieren und Milz.", "Kein Aszites."],
    "Regelrechter Pankreasbefund.",
    onk=["Kein Nachweis eines Pankreastumors.", "Keine Gefäßinfiltration.",
         "Keine Lebermetastasen."],
    inf=["Keine Pankreatitis.", "Keine Nekrose.", "Keine Abszedierung."],
    organ="Pankreas")

reg("MRT|Nieren & Nebennieren",
    "3 Tesla, axiale und koronare HASTE, axiale Diffusion, VIBE nativ und post KM in "
    "mehreren Phasen, koronare VIBE post KM.",
    ["Seitengleich große Nieren mit regelrechter Parenchym-Pyelon-Relation.",
     "Kein Nachweis eines soliden Nierenherdes.", "Keine Diffusionsstörung.",
     "Kein Harnaufstau.", "Unauffällige Nebennieren.",
     "Normale Leber, Milz und Pankreas.", "Keine Lymphadenopathie.", "Kein Aszites."],
    "Regelrechter Befund von Nieren und Nebennieren.",
    onk=["Kein Lokalrezidiv.", "Keine metastasensuspekten Lymphknoten."],
    inf=["Keine Pyelonephritis.", "Keine Abszedierung."],
    organ="Nieren")

reg("CT|Nieren & Nebennieren",
    "Spiral-CT des Abdomen, 2D-Rekonstruktionen.",
    ["Seitengleich große Nieren mit regelrechter Kontrastierung.",
     "Kein Nachweis röntgenschattengebender Konkremente innerhalb von NBKS und ableitenden "
     "Harnwegen beidseits.", "Kein Harnaufstau.", "Unauffällige Nebennieren.",
     "Kein Nachweis eines soliden Nierenherdes.", "Keine Lymphadenopathie.", "Kein Aszites."],
    "Regelrechter Befund von Nieren und ableitenden Harnwegen.",
    inf=["Keine Pyelonephritis.", "Keine Abszedierung."],
    organ="Nieren")

reg("MRT|Dünndarm & Bauchwand",
    "3 Tesla, axiale und koronare HASTE, axiale Diffusion, axiale und koronare VIBE post KM.",
    ["Regelrechte Distension der Dünndarmschlingen.",
     "Keine Darmwandverdickung und keine pathologische Wandkontrastierung.",
     "Keine Stenose und keine prästenotische Dilatation.", "Keine Fisteln.",
     "Keine Abszedierung.", "Keine mesenteriale Lymphadenopathie.", "Kein Aszites.",
     "Intakte Bauchwand ohne Nachweis einer Hernie.",
     "Normale Darstellung der parenchymatösen Oberbauchorgane."],
    "Regelrechter Dünndarmbefund.",
    inf=["Keine entzündliche Aktivität.", "Keine Fistel.", "Keine Sakroiliitis."],
    organ="Dünndarm")

# ================================ BECKEN ===================================
reg("MRT|Prostata",
    "3 Tesla, triplanare T2, axiale T1, Diffusion, Perfusion, Dixon-VIBE post KM, "
    "2D-Rekonstruktionen.",
    ["Alters- und volumengerechte Darstellung der Prostata.",
     "Regelrechte Zonenarchitektur mit abgrenzbarer peripherer Zone.",
     "Kein Nachweis eines suspekten Herdes in der peripheren oder Transitionalzone.",
     "Keine Diffusionsstörung, keine fokale früharterielle Kontrastmittelaufnahme.",
     "Die Prostatakapsel ist intakt.", "Keine Kapselüberschreitung.",
     "Normale Samenblasen.", "Keine Lymphadenopathie.", "Kein Harnaufstau.",
     "Unauffälliges Knochenmark.", "Kein Aszites."],
    "Kein Nachweis eines signifikanten Karzinomherdes. PI-RADS 1.",
    onk=["Kein makroskopisches Lokalrezidiv.", "Keine ossären Metastasen im "
         "Untersuchungsabschnitt."],
    inf=["Keine Prostatitis.", "Kein Abszess."],
    organ="Prostata")

reg("MRT|Gynäkologische Tumoren",
    "3 Tesla, sagittale, axiale und koronare T2, axiale Diffusion und Dixon-VIBE post KM.",
    ["Regelrechte Zonenarchitektur des Uterus mit abgrenzbarer Junktionalzone.",
     "Unauffälliges Endometrium.", "Kein Nachweis einer zervikalen Raumforderung.",
     "Unauffällige Adnexe beidseits.", "Freie Parametrien.",
     "Regelrechte Darstellung von Harnblase und Rektum.", "Keine Lymphadenopathie.",
     "Kein Aszites.", "Kein Harnaufstau.", "Unauffälliges Knochenmark."],
    "Regelrechter Beckenbefund.",
    onk=["Kein Nachweis eines Lokalrezidivs.", "Keine Peritonealkarzinose.",
         "Keine metastasensuspekten pelvinen und paraaortalen Lymphknoten."],
    inf=["Keine Adnexitis.", "Kein Abszess."],
    organ="weibliches Becken")

reg("MRT|Rektum",
    "3 Tesla, sagittale, paraaxiale und parakoronare Dünnschicht-T2, axiale Diffusion und "
    "Dixon-VIBE post KM.",
    ["Regelrechte Wandschichtung des Rektums über die gesamte erfasste Länge.",
     "Kein Nachweis einer Tumorformation.", "Keine Diffusionsstörung.",
     "Freies Mesorektum.", "Keine Bedrohung der mesorektalen Faszie.", "Keine EMVI.",
     "Keine metastatischen Lymphknoten.", "Unauffälliges Knochenmark.",
     "Kein Harnaufstau.", "Kein Aszites."],
    "Regelrechter Rektumbefund.",
    onk=["Kein Nachweis eines Lokalrezidivs.", "Keine Bedrohung des Resektionsrandes."],
    inf=["Keine Proktitis.", "Keine Fistel.", "Kein Abszess."],
    organ="Rektum")

reg("MRT|Perianale Fistel & Beckenboden",
    "3 Tesla, sagittale T2, koronare TIRM, axiale Diffusion und Dixon-VIBE post KM.",
    ["Regelrechte Darstellung des Sphinkterkomplexes.",
     "Kein Nachweis einer anorektalen Fistel.", "Kein Abszess.",
     "Keine entzündliche Infiltration der Fossa ischioanalis.",
     "Kein Nachweis eines Sinus pilonidalis.", "Keine Symphysitis.",
     "Unauffälliges Knochenmark.", "Keine Lymphadenopathie."],
    "Kein Nachweis einer anorektalen Fistel.",
    inf=["Kein Nachweis einer Osteomyelitis.", "Keine Abszedierung."],
    organ="Anorektum")

reg("MRT|Becken",
    "3 Tesla, triplanare T2, axiale T1, Diffusion, Dixon-VIBE post KM, 2D-Rekonstruktionen.",
    ["Regelrechte Darstellung der Beckenorgane.", "Normale Darstellung der Harnblase.",
     "Normales Anorektum.", "Keine Fistel.", "Kein Nachweis einer Hernie.",
     "Unauffällige Darstellung der Muskulatur.", "Keine Lymphadenopathie.",
     "Das Knochenmarksignal ist regulär.", "Kein Aszites.", "Kein Harnaufstau."],
    "Regelrechter Beckenbefund.",
    onk=["Kein Lokalrezidiv.", "Keine metastasensuspekten Lymphknoten."],
    inf=["Keine Abszedierung.", "Keine Symphysitis."],
    organ="Becken")

reg("CT|Becken",
    "Kontrastmittelgestützte Spiral-CT des Beckens, 2D-Rekonstruktionen.",
    ["Regelrechte Darstellung der Beckenorgane.", "Keine Harnstauung.",
     "Regelrechte Darstellung von Harnblase und Rektum.", "Keine Lufteinschlüsse im Gewebe.",
     "Keine Lymphadenopathie.", "Unauffällige Iliosakralfugen.",
     "Regelrechter knöcherner Beckenstatus."],
    "Regelrechter Beckenbefund.",
    onk=["Kein Lokalrezidiv.", "Keine Osteolysen."],
    inf=["Keine Hinweise auf eine Osteitis.",
         "Kein Nachweis einer Weichteilabszedierung oder einer sezernierenden Fistel."],
    organ="Becken")

reg("MRT|Becken knöchern",
    "3 Tesla, koronare TIRM, T1, axiale T1, T2, Dixon-VIBE post KM.",
    ["Reguläres Knochenmarksignal des Beckenskeletts.",
     "Normale Symphyse und Iliosakralfugen.", "Keine Sakroiliitis.", "Keine Symphysitis.",
     "Normale Hüftgelenke.", "Keine Bursitis.", "Keine Enthesitis.",
     "Keine muskuläre Atrophie.", "Keine Lymphadenopathie."],
    "Regelrechter knöcherner Beckenbefund.",
    onk=["Keine ossären Metastasen.", "Kein extraossärer Weichteilanteil."],
    trauma=["Keine Beckenringfraktur.", "Kein Knochenmarködem.", "Kein subkutanes Hämatom."],
    inf=["Keine Osteomyelitis.", "Keine Abszedierung."],
    organ="Beckenskelett")

reg("CT|Becken knöchern",
    "Spiral-CT des Beckens, 2D- und 3D-Rekonstruktionen.",
    ["Intakter Beckenring.", "Intaktes Acetabulum.", "Intakter Femurkopf und Schenkelhals.",
     "Intakte Symphyse.", "Regelrechte Stellung im Hüftgelenk.",
     "Keine freien Knochenfragmente.", "Kein Hämatom."],
    "Regelrechter knöcherner Beckenbefund.",
    onk=["Keine Osteolysen.", "Keine stabilitätsgefährdenden Destruktionen."],
    trauma=["Keine Beckenringfraktur.", "Keine Gelenkstufe.", "Keine Dislokation."],
    organ="Beckenskelett")

reg("MRT|Harnblase & Hoden",
    "3 Tesla, sagittale, axiale und koronare T2, axiale Diffusion und Dixon-VIBE post KM.",
    ["Regelrechte Wandschichtung der Harnblase.",
     "Kein Nachweis einer wandständigen Raumforderung.", "Keine Diffusionsstörung.",
     "Keine Harnstauung.", "Freies perivesikales Fettgewebe.", "Keine Lymphadenopathie.",
     "Das Knochenmarksignal des Beckenskeletts ist normal."],
    "Regelrechter Befund der Beckenorgane.",
    onk=["Kein Nachweis eines Lokalrezidivs.", "Keine metastasensuspekten Lymphknoten."],
    organ="Harnblase")

# ================================ GEFÄSSE ==================================
reg("CT|Aorta",
    "CTA der Aorta, 2D-Rekonstruktionen.",
    ["Normale Durchmesser der Aorta in allen Abschnitten.",
     "Kein murales Hämatom, keine Dissektion, kein PAU.", "Kein Aneurysma.",
     "Normale Darstellung der supraaortalen Gefäßstämme, des Truncus coeliacus, der "
     "Arteria mesenterica superior und inferior, der Nierenarterien und der Beckenarterien "
     "beidseits.", "Keine relevante Stenose.", "Kein Kontrastmittelaustritt.",
     "Keine Lymphadenopathie.", "Kein Aszites."],
    "Regelrechte Darstellung der Aorta.",
    organ="Aorta")

reg("MRT|Aorta",
    "3 Tesla, axiale und koronare HASTE, koronare VIBE post KM in mehreren Phasen, "
    "axiale VIBE post KM als Spätphase.",
    ["Normale Durchmesser der Aorta, der supraaortalen Gefäßstämme, der Viszeralarterien und "
     "der Beckenarterien.", "Keine Dissektion.", "Keine Wandverdickung.",
     "Keine Vaskulitis, insbesondere auch keine Aortitis.", "Keine Pleuraergüsse.",
     "Kein Aszites."],
    "Regelrechte Darstellung der Aorta.",
    organ="Aorta")

reg("MRT|Periphere Gefäße",
    "3 Tesla, QISS-MRA der Becken-Bein-Arterien nativ und TWIST-MRA der Unterschenkel"
    "arterien beidseits mit KM.",
    ["Frei perfundierte Becken- und Beinarterien beidseits.",
     "Keine relevante Stenose und kein Verschluss.", "Regelrechter Dreigefäßanschluss "
     "am Unterschenkel beidseits.", "Kein Aneurysma.", "Keine Dissektion."],
    "Regelrechte Darstellung der Becken-Bein-Arterien.",
    organ="Becken-Bein-Arterien")

# ================================ GELENKE ==================================
reg("MRT|Knie",
    "3 Tesla, sagittale und koronare PDfs, koronare T1, parakoronare T2-Kreuzband, axiale T2fs.",
    ["Intakte Menisken.", "Intakte Kreuzbänder, Kollateralbänder und Retinacula.",
     "Die Knorpelüberzüge der Femurkondylen, des Tibiakopfes und der Patella sind intakt.",
     "Kein Knochenmarködem.", "Kein Gelenkerguss.", "Keine Bursitis.",
     "Normale Signalgebung des Hoffa-Fettkörpers.",
     "Regelrechte Darstellung der Streck- und Beugesehnen."],
    "Kein Kniebinnenschaden.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Kein Hämatomnachweis."],
    inf=["Keine Arthritis.", "Keine Osteomyelitis."],
    organ="Kniegelenk")

reg("CT|Knie",
    "Spiral-CT des Kniegelenks, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Artikulation im Kniegelenk und Femoropatellargelenk.",
     "Keine Fraktur.", "Keine Gelenkstufe.", "Keine freien Gelenkkörper.",
     "Regelrechte Knochenstruktur.", "Keine Weichteilverkalkungen."],
    "Regelrechter knöcherner Befund des Kniegelenks.",
    trauma=["Keine Fraktur.", "Keine Fragmentverschiebung.", "Keine Gelenkstufe."],
    organ="Kniegelenk")

reg("MRT|Schulter",
    "3 Tesla, schräg-koronare TIRM, T1, sagittale T2, axiale T2fs.",
    ["Intakte Rotatorenmanschette.", "Intakte lange Bizepssehne.",
     "Keine Sehnenretraktion.", "Keine muskuläre Atrophie.",
     "Keine Hinweise auf einen Labrumschaden.", "Intaktes ACG.",
     "Regelrechte subakromiale Weite.", "Kein Gelenkerguss.", "Keine Bursitis.",
     "Das Knochenmarksignal ist regulär."],
    "Regelrechter Schulterbefund.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Keine Hill-Sachs-Delle.",
            "Kein Bankart-Defekt."],
    inf=["Keine Arthritis.", "Keine Osteomyelitis."],
    organ="Schultergelenk")

reg("CT|Schulter",
    "Spiral-CT des Schultergelenks, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Artikulation im Schultergelenk und ACG.",
     "Das Glenoid ist intakt, wie die Clavicula und das ACG.", "Keine Fraktur.",
     "Keine Gelenkstufe.", "Keine freien Gelenkkörper.",
     "Keine Atrophie der Rotatorenmanschette."],
    "Regelrechter knöcherner Schulterbefund.",
    trauma=["Keine Fraktur.", "Keine ACG-Sprengung.", "Kein periartikuläres Hämatom."],
    organ="Schultergelenk")

reg("MRT|Oberarm & Bizepssehne",
    "1,5 Tesla, koronare TIRM, sagittale und axiale T2.",
    ["Die lange Bizepssehne ist intakt.", "Die distale Bizepssehne ist intakt.",
     "Keine Sehnenretraktion.", "Keine fettige Muskelatrophie.",
     "Die Signalgebung der Oberarmmuskulatur ist normal.", "Kein Hämatomnachweis.",
     "Unauffälliges Knochenmark.", "Keine knöcherne Beteiligung."],
    "Intakte Bizepssehne.",
    inf=["Kein Nachweis einer Epikondylitis.", "Keine Bursitis."],
    organ="Bizepssehne")

reg("MRT|Ellenbogen",
    "3 Tesla, koronare TIRM, T1, sagittale PDfs, axiale T2.",
    ["Intakte Kollateralbänder.", "Intakte distale Bizepssehne.",
     "Intakte Streck- und Beugesehnen des Unterarmes.",
     "Kein Nachweis einer Epikondylitis.", "Keine Bursitis.", "Kein freier Gelenkkörper.",
     "Kein Gelenkerguss.", "Keine Nervenkompression.", "Das Knochenmarksignal ist regulär."],
    "Regelrechter Befund des Ellenbogengelenks.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Kein Hämatomnachweis."],
    inf=["Keine Arthritis.", "Keine Bursitis olecrani."],
    organ="Ellenbogengelenk")

reg("CT|Ellenbogen",
    "Dünnschicht Spiral-CT des Ellenbogengelenks, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Artikulation im Ellenbogengelenk.", "Intaktes Radiusköpfchen.",
     "Keine Beteiligung des distalen Humerus und der Ulna.", "Keine Gelenkstufe.",
     "Keine knöchernen Begleitverletzungen.", "Kein Flüssigkeitsverhalt im Weichteil."],
    "Regelrechter knöcherner Befund des Ellenbogengelenks.",
    trauma=["Keine Fraktur.", "Keine Dislokation.", "Keine Gelenkstufe."],
    organ="Ellenbogengelenk")

reg("MRT|Handgelenk",
    "3 Tesla, koronare TIRM, T1, MEDIC, axiale PDfs.",
    ["Intakter Discus ulnocarpalis.", "Intaktes SL-Band und LT-Band.",
     "Intakte Streck- und Beugesehnen.", "Keine Sehnenpathologie.",
     "Kein Ganglion.", "Keine knöchernen Verletzungsfolgen.",
     "Regelrechte karpale Artikulation.", "Unauffälliges Knochenmark."],
    "Regelrechter Befund des Handgelenks.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Kein Hämatomnachweis.",
            "Keine karpale Instabilität."],
    inf=["Keine Synovialitis.", "Keine Tendovaginitis.", "Keine Erosionen."],
    organ="Handgelenk")

reg("CT|Handgelenk",
    "Dünnschicht Spiral-CT des Handgelenks, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte karpale Artikulation.", "Keine Gelenkfehlstellung.", "Keine Fraktur.",
     "Keine Gelenkstufe.", "Keine knöchernen Begleitverletzungen.",
     "Das übrige Handskelett ist intakt."],
    "Regelrechter knöcherner Befund des Handgelenks.",
    trauma=["Keine Fraktur.", "Keine Dislokation.", "Keine Gelenkstufe."],
    organ="Handgelenk")

reg("MRT|Hand & Finger",
    "3 Tesla, koronare TIRM, T1, axiale T2.",
    ["Intakte Streck- und Beugesehnen.", "Keine Tendovaginitis.", "Keine Synovialitis.",
     "Keine Erosionen.", "Keine Gelenkfehlstellungen.", "Kein Knochenmarködem.",
     "Kein Ganglion.", "Unauffälliges Knochenmark."],
    "Regelrechter Befund von Hand und Fingern.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Intakte Kollateralbänder."],
    inf=["Keine Synovialitis.", "Keine Erosionen.", "Keine Tenosynovitis."],
    organ="Hand")

reg("MRT|OSG",
    "3 Tesla, sagittale TIRM, T1, koronare PDfs, axiale T2.",
    ["Intakter lateraler und medialer Bandapparat.", "Intakte Syndesmosenbänder.",
     "Intakte Peronealsehnen.", "Intakte Streck- und Beugesehnen.",
     "Intakte Achillessehne.", "Keine Knorpelschäden.", "Keine OD des Talus.",
     "Kein Knochenmarködem.", "Kein Gelenkerguss.", "Keine Bursitis."],
    "Regelrechter Befund des oberen Sprunggelenks.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Kein Hämatomnachweis.", "Kein Meniskoid."],
    inf=["Keine Arthritis.", "Keine Osteomyelitis."],
    organ="oberes Sprunggelenk")

reg("CT|OSG",
    "Spiral-CT des oberen Sprunggelenks und des Fußes, 2D- und 3D-Rekonstruktionen.",
    ["Regelrechte Artikulation im oberen und unteren Sprunggelenk.",
     "Der Außenknöchel ist intakt, wie der Innenknöchel.", "Kein Volkmann-Dreieck.",
     "Keine Gelenkstufe.", "Keine Gelenkfehlstellungen.",
     "Keine Lufteinschlüsse im Weichteil."],
    "Regelrechter knöcherner Befund des Sprunggelenks.",
    trauma=["Keine Fraktur.", "Keine Dislokation.", "Keine Gelenkstufe."],
    organ="oberes Sprunggelenk")

reg("MRT|Fuß",
    "3 Tesla, sagittale und koronare PDfs, koronare T1, axiale T2.",
    ["Intakte Plantarfaszie.", "Intakte Streck- und Beugesehnen.",
     "Kein Morton-Neurom.", "Keine Gelenkfehlstellungen.", "Kein Knochenmarködem.",
     "Keine Knorpelschäden.", "Keine Osteitis.",
     "Normale Signalgebung der kleinen Fußmuskulatur."],
    "Regelrechter Fußbefund.",
    trauma=["Keine knöcherne Verletzungsfolge.", "Kein Hämatomnachweis."],
    inf=["Keine Arthritis.", "Keine Osteitis.", "Keine Abszedierung."],
    organ="Fuß")

reg("MRT|Hüfte",
    "3 Tesla, koronare TIRM, T1, axiale T2.",
    ["Regelrechte Artikulation in den Hüftgelenken.", "Kein Gelenkerguss.",
     "Kein Knochenmarködem.", "Keine Hinweise auf eine Femurkopfnekrose.",
     "Keine Bursitis trochanterica.", "Keine muskuläre Atrophie.",
     "Unauffällige Signalgebung der quergestreiften Muskulatur.",
     "Das Knochenmarksignal des Beckenskeletts ist regulär."],
    "Regelrechter Hüftbefund.",
    trauma=["Keine Schenkelhalsfraktur.", "Kein Knochenmarködem.", "Kein Hämatom."],
    inf=["Keine Coxitis.", "Keine Osteomyelitis."],
    organ="Hüftgelenk")

reg("MRT|ISG",
    "3 Tesla, schräg-koronare TIRM, T1, axiale T2.",
    ["Regelrechte Darstellung der Iliosakralfugen beidseits.", "Keine Sakroiliitis.",
     "Kein subchondrales Knochenmarködem.", "Keine Erosionen.", "Keine Ankylose.",
     "Normale Darstellung der Sakralnerven."],
    "Kein Nachweis einer Sakroiliitis.",
    organ="Iliosakralgelenke")

reg("MRT|Ober- & Unterschenkel / Muskulatur",
    "3 Tesla, koronare TIRM, T1, axiale T2.",
    ["Regelrechte Signalgebung und Konfiguration der Muskulatur.",
     "Kein Muskelödem und keine Muskelatrophie.", "Keine Myositis.",
     "Kein intramuskuläres Hämatom.", "Keine Raumforderung.", "Keine Osteomyelitis.",
     "Das Knochenmarksignal ist normal.", "Keine Lymphadenopathie."],
    "Regelrechter Weichteilbefund.",
    onk=["Keine Raumforderung.", "Keine knöcherne Beteiligung."],
    trauma=["Keine Muskelfaserruptur.", "Kein Hämatomnachweis."],
    inf=["Keine Myositis.", "Keine Abszedierung.", "Keine Fasziitis."],
    organ="Weichteile")

reg("MRT|Arm",
    "1,5 Tesla, koronare TIRM, T1, axiale T2, koronare Dixon-VIBE post KM.",
    ["Regelrechte Signalgebung der Ober- und Unterarmmuskulatur.",
     "Keine Raumforderung.", "Kein Muskelödem.", "Intakte Sehnen.",
     "Keine pathologische Kontrastmittelaufnahme.", "Unauffälliges Knochenmark."],
    "Regelrechter Weichteilbefund des Armes.",
    inf=["Keine Myositis.", "Keine Abszedierung."],
    organ="Arm")

# ============================== GANZKÖRPER =================================
reg("MRT|Ganzkörper",
    "3 Tesla, axiale und koronare HASTE, sagittale und koronare TIRM, axiale Diffusion, "
    "axiale und koronare Dixon-VIBE post KM.",
    ["Regelrechte Signalgebung des supra- und infratentoriellen Hirnparenchyms.",
     "Normale Weite der inneren und äußeren Liquorräume.", "Normale Meningen.",
     "Regelrechte Darstellung von Hals und Schilddrüse.", "Normal großes Herz.",
     "Keine Pleuraergüsse.", "Homogenes Leberparenchym.", "Kein Galleaufstau.",
     "Normale Milz, Pankreas, Nieren und Nebennieren.", "Kein Harnaufstau.",
     "Kein Aszites.", "Keine Lymphadenopathie.",
     "Reguläres Knochenmarksignal des gesamten erfassten Achsenskeletts."],
    "Regelrechter Ganzkörperbefund.",
    onk=["Keine Organmetastasen.", "Keine ossären Metastasen.",
         "Keine metastasensuspekten Lymphknoten."],
    organ="Ganzkörper")

reg("CT|Ganzkörper",
    "Polytraumaspirale, 2D- und 3D-Rekonstruktionen.",
    ["Keine intrakranielle Blutung.", "Intakte Kalotte und Schädelbasis.",
     "Regelrechte Artikulation der Halswirbelsäule ohne Fraktur.",
     "Kein Pneumothorax und kein Hämatothorax.", "Keine Lungenkontusion.",
     "Keine Rippenserienfraktur.", "Keine freie Flüssigkeit im Abdomen.",
     "Keine Organverletzung.", "Intakter Beckenring.",
     "Frei perfundierte Aorta ohne Kontrastmittelaustritt."],
    "Keine Verletzungsfolgen.",
    organ="Ganzkörper")

reg("CT|Sonstige Untersuchung",
    "Kontrastmittelgestützte Spiral-CT, 2D-Rekonstruktionen.",
    ["Regelrechte Darstellung der erfassten Organe.", "Keine Raumforderung.",
     "Keine Lymphadenopathie.", "Kein Aszites.", "Unauffälliges Skelett."],
    "Regelrechter Befund.",
    organ="Untersuchungsgebiet")

reg("MRT|Sonstige Untersuchung",
    "3 Tesla, koronare TIRM, T1, axiale T2, Diffusion, Dixon-VIBE post KM.",
    ["Regelrechte Signalgebung der erfassten Strukturen.", "Keine Raumforderung.",
     "Keine Diffusionsstörung.", "Keine pathologische Kontrastmittelaufnahme.",
     "Keine Lymphadenopathie.", "Unauffälliges Knochenmark."],
    "Regelrechter Befund.",
    organ="Untersuchungsgebiet")
