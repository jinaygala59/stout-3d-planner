#!/usr/bin/env python3
"""Put every catalogue row on the SAME eight finishes, and retire polished gold.

The client asked for one palette across the whole range (2026-09-16). The eight
are the finishes with a measured curve behind them in tools_finish.py, so every
product-finish pair in the catalogue is either a photograph out of the client's
Drive folder or a variant carrying that finish's measured response — never a
guess. tools_uniform.py fills the renders; this rewrites the rows to match.

POLISHED GOLD IS DROPPED, at the client's decision. It had no reference of its
own: the only real polished-gold renders in the folder ARE the French-gold ones
(tools_finish.py builds it by copying `gold` for the four SKUs that have it), so
the two swatches printed the same colour on 12 of the 22 products that carried
both. A second name for one colour is worse than one name, and when genuine
polished-gold photographs arrive a curve can be fitted and a ninth added back.

Idempotent: run it twice and the second run reports nothing to do.

    python3 tools_palette.py            # report
    python3 tools_palette.py --write    # rewrite assets/catalog.js
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(ROOT, "assets", "catalog.js")
PROD = os.path.join(ROOT, "assets", "products")
PALETTE = ["chrome", "gunGrey", "brushedGold", "champagne",
           "gold", "roseGold", "brushedRoseGold", "matteBlack"]
DROP = "polishedGold"
NEW = "[" + ",".join('"%s"' % f for f in PALETTE) + "]"


def main():
    write = "--write" in sys.argv
    src = io.open(CAT, encoding="utf-8").read()
    changed = missing = 0
    report = []

    def row(m):
        nonlocal changed, missing
        head, body = m.group(1), m.group(2)
        code = re.search(r'code:\s*"([^"]+)"', head).group(1)
        art = re.search(r'art:\s*"([^"]+)"', body)
        art = art.group(1) if art else code
        fs = re.search(r'finishes:\s*\[([^\]]*)\]', body)
        if not fs:
            return m.group(0)
        old = [x.strip().strip('"') for x in fs.group(1).split(",") if x.strip()]
        gaps = [f for f in PALETTE if not os.path.exists(os.path.join(PROD, f"{art}-{f}.png"))]
        if gaps:
            # NEVER list a finish with no render — the rail would draw a broken
            # tile and the room would fetch a 404. Leave the row alone and say so.
            missing += 1
            report.append(f"  !! {code:12} kept as-is, no render for: {', '.join(gaps)}")
            return m.group(0)
        if old != PALETTE:
            changed += 1
            report.append(f"     {code:12} {len(old)} -> 8" + (f"  (dropped {DROP})" if DROP in old else ""))
        return m.group(0).replace("[" + fs.group(1) + "]", NEW, 1)

    out = re.sub(r'(\{\s*code:\s*"[^"]+",\s*cat:\s*"[^"]+")(.*?\},)', row, src, flags=re.S)

    # the palette itself
    if write:
        out = re.sub(r'\n\s*%s:\s*\{[^}]*\},?' % DROP, "", out, count=1)

    print("\n".join(report) or "  (nothing to change)")
    print(f"\n{changed} rows on the eight; {missing} left alone for want of a render")
    if not write:
        print("(report only — pass --write)"); return
    io.open(CAT, "w", encoding="utf-8").write(out)
    left = len(re.findall(DROP, io.open(CAT, encoding="utf-8").read()))
    print(f"written. remaining mentions of {DROP} in catalog.js: {left}")


if __name__ == "__main__":
    main()
