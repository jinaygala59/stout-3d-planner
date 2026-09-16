#!/usr/bin/env python3
"""Lift product cutouts for the STOUT July 2026 catalogue's missing SKUs.

Source: ~/Downloads/"STOUT July 2026.pdf" (the client's own 2026 edition, W.E.O
1st July 2026). Every product render on those pages is a placed JPEG with a soft
mask, so the cutout is the factory's own studio photography with the factory's
own alpha - nothing is keyed, recoloured or redrawn here.

Pairing a render to a finish is the part that can go wrong, because the page
carries three of each and the text extractor does not read in column order. It
is done by POSITION - the renders and the `CODE: ST-xxxx-YY` lines sit in the
same three columns, so both are sorted by x and zipped - and then CHECKED by
colour against the same finish elsewhere in the range (--check), which is what
catches a swap.

  python3 tools_july.py --list            what is missing, and from which pages
  python3 tools_july.py --extract         write assets/products + thumb (png+webp)
  python3 tools_july.py --check           hue/sat of each new cutout vs the range
"""
import argparse, colorsys, os, re, statistics, sys
import fitz
from PIL import Image

PDF  = os.path.expanduser("~/Downloads/STOUT July 2026.pdf")
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(ROOT, "assets", "products")
THUMB_W = 220

# the factory's finish codes -> the ids this app keys artwork and saved rooms on
FINMAP = {"CP": "chrome", "GG": "gunGrey", "BV": "champagne", "FG": "gold",
          "RG": "roseGold", "BRG": "brushedRoseGold", "MB": "matteBlack"}

# SKU -> the catalogue pages it spans (PDF page numbers, 1-based)
JOBS = {
    "ST-D5021": [14, 15], "ST-D5022": [18, 19],
    "ST-D5012": [22, 23], "ST-D5011": [26, 27],
    "ST-D5015": [30, 31], "ST-D5016": [32, 33],
}

# The body jets and the spouts carry NO code anywhere in the catalogue - the
# pages give a name, a size, a material, the finishes and the price, and that is
# all - so those SKUs cannot be paired to a `CODE:` line and are listed here by
# page instead, with the finish each column carries. `want` narrows a job to the
# finishes this app is still missing; the rest already have the factory's own
# photograph and are left alone.
UNCODED = {
    # the flush recessed jet, 130x120x70.5mm - not the 16-jet panel already here
    # under ST-BJ-01, which has a different face and is not in this catalogue
    "ST-CBJ":   {"pages": [116, 117], "want": None},
    # NOT extracted, deliberately: the catalogue also carries finishes this app
    # does not have for the SINGLE FUNCTION jet (p117/118: chrome, french gold,
    # brushed bronze, brushed rose gold) and the DANCING jet (p119: chrome, matt
    # black). Both render as real geometry wearing a 512 px face decal cut from
    # the photograph (tools_decal.py), and those particular renders are printed
    # 150-230 px wide - a decal upscaled 3x from them is visibly softer than the
    # ones beside it. They go in when a render of that finish arrives at a size
    # worth cutting, not from these.
}

doc = fitz.open(PDF)

FINLABEL = {"CHROME": "chrome", "GUN GREY": "gunGrey", "BRUSHED BRONZE": "champagne",
            "FRENCH GOLD": "gold", "ROSE GOLD": "roseGold",
            "BRUSHED ROSE GOLD": "brushedRoseGold", "MATT BLACK": "matteBlack"}


def codes_on(pn):
    """[(x, finishId, code)] for the CODE: lines on a page, left to right."""
    out = []
    for b in doc[pn - 1].get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                t = " ".join(s["text"].split())
                if t.upper().startswith("CODE:"):
                    c = t.split(":", 1)[1].strip()
                    m = re.match(r"^(.*?)-(CP|GG|BV|FG|RG|BRG|MB)$", c)
                    if m:
                        out.append((s["bbox"][0], FINMAP[m.group(2)], c))
    return sorted(out)


def renders_on(pn):
    """[(x, xref, smask)] for the product photographs, left to right.

    The page also carries a full-bleed silk background, a marble podium strip
    and the 9 px finish bullets; the width window drops all three."""
    pg, out = doc[pn - 1], []
    for im in pg.get_images(full=True):
        xref, smask = im[0], im[1]
        if not smask:
            continue
        for r in pg.get_image_rects(xref):
            if 60 <= r.width <= 400:
                out.append((r.x0, xref, smask))
    return sorted(out)


def labels_on(pn):
    """[(x, y, finishId)] for the finish captions on a page."""
    out = []
    for b in doc[pn - 1].get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                t = " ".join(s["text"].split()).upper()
                if t in FINLABEL:
                    out.append((s["bbox"][0], s["bbox"][1], FINLABEL[t]))
    return out


def renders_xy(pn):
    """[(x, y, xref, smask)] for the product photographs on a page.

    Same width window as renders_on, plus a height guard: the spout pages hang a
    226 x 750 pt marble strip down the middle, which is inside the width band."""
    pg, out = doc[pn - 1], []
    for im in pg.get_images(full=True):
        xref, smask = im[0], im[1]
        if not smask:
            continue
        for r in pg.get_image_rects(xref):
            if 40 <= r.width <= 400 and r.height <= 400:
                out.append((r.x0, r.y0, xref, smask))
    return out


def pair_by_layout(pn):
    """[(finishId, xref, smask)] for a page that prints no codes.

    The caption and the render it belongs to sit in the same column, so both are
    bucketed by x and then read down the page. The body-jet spreads put three
    podiums across and, where there is a fourth finish, one podium behind and
    higher - which is why the sort is (column, y) and not x alone. The spout and
    shower-arm spreads stack every caption in one left-hand column against a
    stack of renders on the right, and there the column test collapses to a
    plain top-to-bottom pairing."""
    labs, rends = labels_on(pn), renders_xy(pn)
    if len(labs) != len(rends):
        raise SystemExit(f"p{pn}: {len(labs)} captions but {len(rends)} renders")
    col = lambda x: int(x // 150)
    if len({col(l[0]) for l in labs}) == 1:
        key_l, key_r = (lambda l: l[1]), (lambda r: r[1])
    else:
        key_l, key_r = (lambda l: (col(l[0]), l[1])), (lambda r: (col(r[0]), r[1]))
    return [(l[2], r[2], r[3])
            for l, r in zip(sorted(labs, key=key_l), sorted(rends, key=key_r))]


def uncoded_pairs(sku):
    """[(finishId, xref, smask, page)] for a SKU the catalogue gives no code.

    A page that carries two products can caption both the same way - p119 prints
    CHROME twice, once for the dancing jet on the tall podium and once for the 3
    function jet in front of it - so within one page the first render down the
    column wins and the later duplicate is dropped. That is the right one here:
    the second chrome is the other product, which this app already has."""
    job, got, seen = UNCODED[sku], [], set()
    for pn in job["pages"]:
        for fid, xref, smask in pair_by_layout(pn):
            if (pn, fid) in seen:
                continue
            seen.add((pn, fid))
            if job["want"] is None or fid in job["want"]:
                got.append((fid, xref, smask, pn))
    return got


def cutout(xref, smask, tmp):
    """The placed JPEG recombined with its soft mask, trimmed to the alpha."""
    fitz.Pixmap(fitz.Pixmap(doc, xref), fitz.Pixmap(doc, smask)).save(tmp)
    im = Image.open(tmp).convert("RGBA")
    bb = im.split()[-1].getbbox()
    return im.crop(bb) if bb else im


def pairs(sku):
    """[(finishId, xref, smask, page)] for every finish of one SKU."""
    got = []
    for pn in JOBS[sku]:
        cs, rs = codes_on(pn), renders_on(pn)
        if len(cs) != len(rs):
            raise SystemExit(f"p{pn}: {len(cs)} codes but {len(rs)} renders - "
                             "columns do not pair, look at the page")
        for (_, fid, code), (_, xref, smask) in zip(cs, rs):
            if not code.startswith(sku + "-"):
                raise SystemExit(f"p{pn}: expected {sku}, found {code}")
            got.append((fid, xref, smask, pn))
    return got


def band(img, lo=0.40, hi=0.90):
    """Median hue/sat of the metal, over the 40-90% luminance band.

    The same band the on-wall colour calibration uses: it skips the black
    graphics and the blown highlight, and what is left is the finish."""
    im = img.convert("RGBA")
    im.thumbnail((160, 160))
    px = [p for p in im.getdata() if p[3] > 250]
    if not px:
        return None
    px.sort(key=lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2])
    px = px[int(len(px) * lo):max(int(len(px) * hi), int(len(px) * lo) + 1)]
    hs = [colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255) for p in px]
    return (statistics.median(h for h, s, v in hs) * 360,
            statistics.median(s for h, s, v in hs),
            statistics.median(v for h, s, v in hs))


def reference(fid):
    """The finish as the range already shows it - every existing cutout of it."""
    out = []
    for f in sorted(os.listdir(OUT)):
        if f.endswith(f"-{fid}.png") and not f.startswith(tuple(JOBS)):
            b = band(Image.open(os.path.join(OUT, f)))
            if b:
                out.append(b)
    if not out:
        return None
    return (statistics.median(h for h, s, v in out),
            statistics.median(s for h, s, v in out))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    tmp = os.path.join(ROOT, "_t.png")

    everything = ([(s, pairs(s)) for s in JOBS] +
                  [(s, uncoded_pairs(s)) for s in UNCODED])

    if a.list:
        for sku, got in everything:
            pgs = JOBS.get(sku) or UNCODED[sku]["pages"]
            print(sku, "pages", pgs, [f for f, _, _, _ in got])

    if a.extract:
        os.makedirs(os.path.join(OUT, "thumb"), exist_ok=True)
        for sku, got in everything:
            for fid, xref, smask, pn in got:
                im = cutout(xref, smask, tmp)
                base = f"{sku}-{fid}"
                im.save(os.path.join(OUT, base + ".png"))
                im.save(os.path.join(OUT, base + ".webp"), quality=92, method=6)
                th = im.copy()
                th.thumbnail((THUMB_W, 10_000), Image.LANCZOS)
                th.save(os.path.join(OUT, "thumb", base + ".png"))
                th.save(os.path.join(OUT, "thumb", base + ".webp"), quality=90, method=6)
                print(f"{base:34s} {im.size[0]}x{im.size[1]}  p{pn}")
        if os.path.exists(tmp):
            os.remove(tmp)

    if a.check:
        refs = {}
        print(f"{'file':34s} {'hue':>7s} {'sat':>6s}   {'range hue':>9s} {'sat':>6s}   dHue")
        for sku, got in everything:
            for fid, _, _, _ in got:
                p = os.path.join(OUT, f"{sku}-{fid}.png")
                if not os.path.exists(p):
                    continue
                h, s, v = band(Image.open(p))
                if fid not in refs:
                    refs[fid] = reference(fid)
                rh, rs = refs[fid] if refs[fid] else (float("nan"),) * 2
                d = abs(h - rh)
                d = min(d, 360 - d)
                flag = "  <-- CHECK" if d > 25 and s > 0.05 else ""
                print(f"{sku}-{fid:18s} {h:7.1f} {s:6.2f}   {rh:9.1f} {rs:6.2f}   {d:5.1f}{flag}")


if __name__ == "__main__":
    main()
