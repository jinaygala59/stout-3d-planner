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
          "RG": "roseGold", "BRG": "brushedRoseGold", "MB": "matteBlack",
          "BG": "brushedGold"}   # the catalogue captions BG "BRUSHED GOLD"

# SKU -> the catalogue pages it spans (PDF page numbers, 1-based)
JOBS = {
    # thermostatic diverter panels
    "ST-D5021": [14, 15], "ST-D5022": [18, 19],
    "ST-D5012": [22, 23], "ST-D5011": [26, 27],
    "ST-D5015": [30, 31], "ST-D5016": [32, 33],
    # deck basin mixers + the pillar tap. The catalogue gives these a code PER
    # FINISH rather than per model (p77-82), so the row carries the first and
    # lists the rest in `variant`; `alias` says which other codes are the same
    # fitting, and the artwork is filed under the row's code.
    "ST-MN-005": [80, 81], "ST-MN-006": [82, 83], "ST-MN-015": [84, 85],
    # wall-mounted basin mixers - already here, but with 2 and 3 of their 8 and
    # 7 finishes
    "ST-WM-001": [88, 89], "ST-WM-002": [90, 91],
    # ABS / brass overhead showers, on the four-up grid pages
    "ST-1012": [100], "ST-3014": [100], "ST-3016": [100],
    "ST-1023": [102], "ST-1031": [102],
    "ST-1022": [105], "ST-1029": [108],
    # taps and valves
    "MN-2W": [130, 131], "ST-QB": [132],
    "MN-AC": [134, 135], "QB-AC": [136, 137],
}

# codes the catalogue prints for the SAME fitting in another finish - the row is
# filed under the first and these are recorded on it
ALIAS = {
    "ST-MN-005": ["ST-MN-007", "ST-MN-009", "ST-MN-011", "ST-MN-001", "ST-MN-003"],
    "ST-MN-006": ["ST-MN-008", "ST-MN-010", "ST-MN-012", "ST-MN-002", "ST-MN-004"],
    "ST-MN-015": ["ST-MN-016", "ST-MN-017", "ST-MN-018", "ST-MN-014", "ST-MN-013",
                  "ST-MN-019"],
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
    "ST-CB":   {"pages": [116, 117], "want": None},
    # p103/104 print no code and p105 prints ST-1029-CP - and it is the SAME
    # square plate in all six: same proportions, same 9x9 jet grid. So the
    # catalogue DOES name this one, and its other five finishes are filed under
    # that code rather than under a placeholder.
    "ST-1029":  {"pages": [106, 107], "want": None},   # BRASS OVER HEAD SHOWER
    "ST-SOH":   {"pages": [109],      "want": None},   # SS 304 OVER HEAD SHOWER
    "ST-CSC":   {"pages": [133],      "want": None},   # CONCEALED STOP COCK, 200mm
    "ST-CWO":   {"pages": [138, 139], "want": None},   # CONCEALED WALL OUT-LET
    "ST-PUW":   {"pages": [140, 141], "want": None},   # POP UP WASTE COUPLING, 125mm
    "ST-BTRAP": {"pages": [142, 143], "want": None},   # BOTTLE TRAP
    "ST-HFSEL": {"pages": [146, 147], "want": None},   # SELORA HEALTH FAUCET
    "ST-HFSQ":  {"pages": [148, 149], "want": None},   # SQUARE HEALTH FAUCET
    "ST-HFEST": {"pages": [150],      "want": None},   # ESTONIA HEALTH FAUCET
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
    """[(x, y, finishId, base)] for the CODE: lines on a page.

    The extractor sometimes carries a stray leading hyphen into the string
    (p133 prints "-QB-AC-RG"), so the base is stripped of it."""
    out = []
    for b in doc[pn - 1].get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                t = " ".join(s["text"].split())
                if t.upper().startswith("CODE:"):
                    c = t.split(":", 1)[1].strip()
                    m = re.match(r"^(.*?)-(CP|GG|BV|FG|RG|BRG|MB|BG)$", c)
                    if m:
                        out.append((s["bbox"][0], s["bbox"][1],
                                    FINMAP[m.group(2)], m.group(1).lstrip("-")))
    return out


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
    """[(x, y, [(xref, smask, rect)])] - one entry per PRODUCT on the page.

    The width window drops the full-bleed silk background, the marble podium
    strip and the 9 px finish bullets; the height guard drops the 226 x 750 pt
    marble column the spout pages hang down the middle.

    A product photographed TWICE is one entry, not two. The health-faucet pages
    draw each finish as a front view and a side view leaning together, and left
    apart they would be counted as two finishes and the captions would not pair.
    The test is not "do they overlap" - the podium spreads overlap at the corners
    too, by as much as a quarter of a rect - it is "are these the same picture
    twice": the same size to within 2%, the same top edge to within 2 pt, and
    centres closer together than one of them is wide. Nothing on a podium page
    passes that, because those are laid out at different heights. Such a pair
    keeps its LEFTMOST member, which on those pages is the view down the spray
    face - the one that reads as a health faucet on a wall."""
    def twin(a, b):
        near = lambda p, q, t: abs(p - q) <= t
        return (near(a.width, b.width, 0.02 * a.width)
                and near(a.height, b.height, 0.02 * a.height)
                and near(a.y0, b.y0, 2)
                and abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2) < a.width)

    pg, rects = doc[pn - 1], []
    for im in pg.get_images(full=True):
        xref, smask = im[0], im[1]
        if not smask:
            continue
        for r in pg.get_image_rects(xref):
            if 40 <= r.width <= 400 and r.height <= 400:
                rects.append((xref, smask, r))
    groups = []
    for xref, smask, r in sorted(rects, key=lambda t: (t[2].x0, t[2].y0)):
        for g in groups:
            if any(twin(r, o[2]) for o in g):
                g.append((xref, smask, r))
                break
        else:
            groups.append([(xref, smask, r)])
    groups = [[min(g, key=lambda o: o[2].x0)] for g in groups]
    out = []
    for g in groups:
        x0 = min(o[2].x0 for o in g)
        y0 = min(o[2].y0 for o in g)
        out.append((x0, y0, g))
    return out


def _zip_by_column(anchors, rends, pn):
    """Pair captions-or-codes to renders down each column of the page.

    Both sit in the same columns, so both are bucketed by x and then read top to
    bottom. The spreads put three podiums across and, where there is a fourth
    product, one behind and higher - which is why the sort is (column, y) and not
    x alone. The health-faucet and stop-cock spreads stack every caption in one
    left-hand column against a stack of renders on the right, and there the
    column test collapses to a plain top-to-bottom pairing."""
    if len(anchors) != len(rends):
        raise SystemExit(f"p{pn}: {len(anchors)} captions but {len(rends)} renders")
    col = lambda x: int(x // 150)
    if len({col(a[0]) for a in anchors}) == 1:
        key_a, key_r = (lambda a: a[1]), (lambda r: r[1])
    else:
        key_a, key_r = (lambda a: (col(a[0]), a[1])), (lambda r: (col(r[0]), r[1]))
    return list(zip(sorted(anchors, key=key_a), sorted(rends, key=key_r)))


def pairs(sku):
    """[(finishId, group, page)] for every finish of one CODED SKU.

    A page can carry four different products - p97 and p99 are four-up grids of
    overhead showers - so every code on the page is paired to its render first
    and the result is then filtered to this SKU. Pairing before filtering is the
    point: the columns only line up when all of them are present."""
    own = {sku, *ALIAS.get(sku, [])}
    got = []
    for pn in JOBS[sku]:
        for (ax, ay, fid, base), (rx, ry, grp) in _zip_by_column(
                codes_on(pn), renders_xy(pn), pn):
            if base in own:
                got.append((fid, grp, pn))
    if not got:
        raise SystemExit(f"{sku}: no code on pages {JOBS[sku]} matched")
    return got


def uncoded_pairs(sku):
    """[(finishId, group, page)] for a SKU the catalogue gives no code.

    A page that carries two products can caption both the same way - p119 prints
    CHROME twice, once for the dancing jet on the tall podium and once for the 3
    function jet in front of it - so within one page the first render down the
    column wins and the later duplicate is dropped. That is the right one here:
    the second chrome is the other product, which this app already has."""
    job, got, seen = UNCODED[sku], [], set()
    for pn in job["pages"]:
        for (ax, ay, fid), (rx, ry, grp) in _zip_by_column(
                labels_on(pn), renders_xy(pn), pn):
            if (pn, fid) in seen:
                continue
            seen.add((pn, fid))
            if job["want"] is None or fid in job["want"]:
                got.append((fid, grp, pn))
    return got


def cutout(group, tmp):
    """One product, as the factory drew it: each placed JPEG recombined with its
    own soft mask, laid out at the scale and offset the PAGE gives it, then
    trimmed to the alpha. A single-image product is the ordinary case; a group of
    two is a faucet drawn beside its hook."""
    x0 = min(o[2].x0 for o in group); y0 = min(o[2].y0 for o in group)
    x1 = max(o[2].x1 for o in group); y1 = max(o[2].y1 for o in group)
    # page points -> pixels at the densest source in the group, so nothing is
    # resampled down to the coarsest one
    ppp = max(doc.extract_image(o[0])["width"] / o[2].width for o in group)
    W, H = max(1, round((x1 - x0) * ppp)), max(1, round((y1 - y0) * ppp))
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for xref, smask, r in group:
        fitz.Pixmap(fitz.Pixmap(doc, xref), fitz.Pixmap(doc, smask)).save(tmp)
        im = Image.open(tmp).convert("RGBA")
        w, h = max(1, round(r.width * ppp)), max(1, round(r.height * ppp))
        sheet.alpha_composite(im.resize((w, h), Image.LANCZOS),
                              (round((r.x0 - x0) * ppp), round((r.y0 - y0) * ppp)))
    bb = sheet.split()[-1].getbbox()
    return sheet.crop(bb) if bb else sheet


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
    # per-process, because the cutout path round-trips each image through it:
    # two copies of this script running at once raced on a shared name and wrote
    # one SKU's pixels under another SKU's filename
    tmp = os.path.join(ROOT, f"_t{os.getpid()}.png")

    everything = ([(s, pairs(s)) for s in JOBS] +
                  [(s, uncoded_pairs(s)) for s in UNCODED])

    if a.list:
        for sku, got in everything:
            pgs = JOBS.get(sku) or UNCODED[sku]["pages"]
            print(sku, "pages", pgs, [f for f, _, _ in got])

    if a.extract:
        os.makedirs(os.path.join(OUT, "thumb"), exist_ok=True)
        for sku, got in everything:
            for fid, grp, pn in got:
                im = cutout(grp, tmp)
                base = f"{sku}-{fid}"
                im.save(os.path.join(OUT, base + ".png"))
                im.save(os.path.join(OUT, base + ".webp"), quality=92, method=4)
                th = im.copy()
                th.thumbnail((THUMB_W, 10_000), Image.LANCZOS)
                th.save(os.path.join(OUT, "thumb", base + ".png"))
                th.save(os.path.join(OUT, "thumb", base + ".webp"), quality=90, method=4)
                print(f"{base:34s} {im.size[0]}x{im.size[1]}  p{pn}")
        if os.path.exists(tmp):
            os.remove(tmp)

    if a.check:
        refs = {}
        print(f"{'file':34s} {'hue':>7s} {'sat':>6s}   {'range hue':>9s} {'sat':>6s}   dHue")
        for sku, got in everything:
            for fid, _, _ in got:
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
