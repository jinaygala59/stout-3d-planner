#!/usr/bin/env python3
"""Give EVERY product the same eight finishes.

Why this exists. The client's Drive folder ships a different set of finishes per
SKU — 31 of the 105 products arrived with exactly one — so the rail offered a
different palette depending on what you tapped, and a room locked to, say,
brushed gold simply could not show most of the range. The client asked for one
palette across the whole catalogue.

The eight are the finishes with a MEASURED curve in tools_finish.py: chrome,
gun grey, brushed gold, champagne, French gold, rose gold, brushed rose gold and
matt black. Each curve is fitted to a real photograph out of the client's own
folder, so a generated variant carries that FINISH's measured response over the
SKU's own structure. Polished gold is not among them and cannot be: its only
reference is the same ST-C1008 gold render the French-gold curve is fitted to,
so generating it would print a second swatch that is French gold under another
name — see the note in tools_finish.py.

WHAT THIS DOES NOT DO. It never overwrites a render that came from the folder.
A real photograph beats a generated variant every time, so a SKU that already
ships a finish keeps it; only the gaps are filled. Re-running is therefore safe
and idempotent, and a new Drive drop overwrites generated files simply by
landing on disk before this runs again.

The eight curves are fitted ONCE and reused across all 105 products. Fitting is
the expensive half (a 256-bin pass over a reference render), and tools_finish.py
refits per SKU because it was written to do one product at a time; at catalogue
scale that is 350 identical fits.

    python3 tools_uniform.py            # report what is missing
    python3 tools_uniform.py --write    # fill it in
"""
import os, re, io, sys, importlib.util

spec = importlib.util.spec_from_file_location("tf", os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools_finish.py"))
tf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tf)

# The eight, in the order the rail shows them.
PALETTE = ["chrome", "gunGrey", "brushedGold", "champagne",
           "gold", "roseGold", "brushedRoseGold", "matteBlack"]
ROOT = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(ROOT, "assets", "catalog.js")


def rows():
    """(code, cat, artwork-code, finishes) for every live catalogue row."""
    s = io.open(CAT, encoding="utf-8").read()
    s = "\n".join(l for l in s.split("\n") if not l.strip().startswith("//"))
    out = []
    for m in re.finditer(r'\{\s*code:\s*"([^"]+)",\s*cat:\s*"([^"]+)"(.*?)\},', s, re.S):
        art = re.search(r'art:\s*"([^"]+)"', m.group(3))
        fs = re.search(r'finishes:\s*\[([^\]]*)\]', m.group(3))
        fl = [x.strip().strip('"') for x in (fs.group(1) if fs else "").split(",") if x.strip()]
        out.append((m.group(1), m.group(2), art.group(1) if art else m.group(1), fl))
    return out


def main():
    write = "--write" in sys.argv
    os.chdir(tf.PROD)

    print("fitting the eight curves once …")
    curves, cdfs = {}, {}
    for f in PALETTE:
        ref = tf.REFS[f]
        curves[f] = tf.fit(ref)
        cdfs[f] = tf.lum_cdf(ref)
        print(f"   {f:18} from {ref}")

    made = skipped = 0
    for code, cat, art, fl in rows():
        # A finish is REAL when its file is on disk; that is what must not be
        # touched. The catalogue list is what the client is offered, and the two
        # are allowed to differ — a folder render the row does not list still
        # counts as real and is reused rather than regenerated over.
        have = [f for f in PALETTE if os.path.exists(f"{art}-{f}.png")]
        gaps = [f for f in PALETTE if f not in have]
        if not gaps:
            skipped += 1
            continue
        donor = next((d for d in tf.DONOR_ORDER if d in have), None)
        if donor is None:
            print(f"   !! {code}: no usable donor, skipped")
            continue
        if not write:
            print(f"   {code:12} {cat:14} donor {donor:16} needs {', '.join(gaps)}")
            made += len(gaps)
            continue
        for f in gaps:
            out = tf.apply_curve(f"{art}-{donor}.png", curves[f], tf.tone_for(f"{art}-{donor}.png", cdfs[f]))
            out.save(f"{art}-{f}.png")
            out.save(f"{art}-{f}.webp", quality=92, method=6)
            tf.thumb(f"{art}-{f}.png")
            made += 1
        print(f"   {code:12} +{len(gaps)} from {donor}")

    print(f"\n{'generated' if write else 'would generate'} {made} renders; "
          f"{skipped} products already complete")
    if not write:
        print("(report only — pass --write)")


if __name__ == "__main__":
    main()
