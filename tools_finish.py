#!/usr/bin/env python3
"""Generate a finish variant of a product render from a NEUTRAL one.

Why this exists: the client's Drive folder ships a different set of finishes per
SKU. The polished gold the client asked for ("this is the colour in all the
showers, instead of that typical yellow") is present as a real render for only
four of the twenty-two overhead showers — ST-C1001, C1002, C1008, C1010. The
others carry either no gold at all, or the washed-out `FG` render whose value is
blown to 1.0 with barely any specular range, which is the "typical yellow".

A polished metal render is a neutral luminance field times the metal's own
reflectance, which is exactly how the factory's own finish variants are made
from one master render. So a variant is produced by:

  1. FITTING the range's real gold response off the client's own file: bin its
     pixels by luminance, take the mean colour per bin, smooth and force the
     curve monotonic. That is a 256-entry lookup, luminance -> RGB, measured
     rather than invented.
  2. MATCHING the donor's tonal response to the reference's, by mapping the
     donor's luminance histogram onto the reference's (CDF to CDF). This is not
     cosmetic: several of the neutral renders in the folder are themselves
     washed-out recolours whose luminance sits in a narrow band, and tinting one
     of those directly gives a variant that is too saturated and too dark, with
     the specular gradient flattened out of it. Matched first, the variant
     carries the FINISH's tonal response and the SKU's own structure.
  3. APPLYING the curve to that SKU's own neutral render (its chrome or gun-grey
     photograph), which carries the SKU's true geometry, nozzle grid and
     specular gradient. Alpha is carried through untouched.

Dark detail stays neutral. A nozzle bore and the waterfall slot are steel and
shadow, not gold: in the reference they read grey and near-black, so the gold
tint is faded out below `NEUTRAL_KEEP` luminance instead of colouring them.

The highlight is CAPPED at the metal's own bright tint. Gold reflects far less
blue than red, so even its brightest reflection reads pale warm gold — measured
off the reference, its 99.5th percentile is rgb(254,250,181) and only the single
brightest pixel approaches white. That matters because half of some chrome
donors is a blown-out white reflection of the studio softbox (ST-C1016 is 49%
clipped): mapped against a curve that ends in white, that area stayed a white
blob on a gold plate. Capped at the measured tint, it reads as pale gold, which
is what a polished gold plate reflecting a softbox actually looks like.

The fit is CHECKED, not trusted: `validate` applies the curve to a SKU whose
real gold we already have and reports the error against it (see --check).

  python3 tools_finish.py --check
  python3 tools_finish.py --write
"""
import os, sys, glob, colorsys
from PIL import Image

PROD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "products")
REF = "ST-C1008-gold.png"      # the client's own polished-gold render (matches their reference shot)
BINS = 256
NEUTRAL_KEEP = 0.22            # below this luminance the tint fades out, so bores/slots stay neutral
CEIL_PCTL = 0.995              # the highlight ceiling, as a percentile of the reference's own luminance

def lum(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

def fit(path):
    """256-entry luminance -> (r,g,b) curve, measured off one render's own pixels."""
    im = Image.open(path).convert("RGBA"); px = im.load(); W, H = im.size
    acc = [[0.0, 0.0, 0.0, 0] for _ in range(BINS)]
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200: continue
            i = min(BINS - 1, int(lum(r, g, b) * (BINS - 1)))
            c = acc[i]; c[0] += r; c[1] += g; c[2] += b; c[3] += 1
    # fill empty bins by interpolation between the nearest populated ones
    have = [i for i, c in enumerate(acc) if c[3]]
    if not have: raise SystemExit("no opaque pixels in " + path)
    curve = [None] * BINS
    for i in have:
        c = acc[i]; curve[i] = (c[0] / c[3], c[1] / c[3], c[2] / c[3])
    lo = have[0]; hi = have[-1]
    for i in range(BINS):
        if curve[i]: continue
        if i < lo: curve[i] = curve[lo]
        elif i > hi: curve[i] = curve[hi]
        else:
            a = max(j for j in have if j < i); b = min(j for j in have if j > i)
            t = (i - a) / (b - a)
            curve[i] = tuple(curve[a][k] + (curve[b][k] - curve[a][k]) * t for k in range(3))
    # smooth, then force monotonic — a reflectance curve cannot go back down
    for _ in range(3):
        curve = [tuple(sum(curve[min(BINS - 1, max(0, i + d))][k] for d in (-2, -1, 0, 1, 2)) / 5
                       for k in range(3)) for i in range(BINS)]
    out = [list(curve[0])]
    for i in range(1, BINS):
        out.append([max(out[-1][k], curve[i][k]) for k in range(3)])
    # cap the top at the metal's own bright tint (see the note above)
    ceil = bright_tint(path, CEIL_PCTL)
    for row in out:
        for k in range(3):
            row[k] = min(row[k], ceil[k])
    return out

def bright_tint(path, pctl):
    """The reference's colour at a high luminance percentile — its highlight tint."""
    im = Image.open(path).convert("RGBA"); px = im.load(); W, H = im.size
    vals = []
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200: continue
            vals.append((lum(r, g, b), r, g, b))
    vals.sort()
    L, r, g, b = vals[min(len(vals) - 1, int(pctl * (len(vals) - 1)))]
    return (float(r), float(g), float(b))

def lum_cdf(path):
    """Normalised cumulative histogram of a render's opaque luminance."""
    im = Image.open(path).convert("RGBA"); px = im.load(); W, H = im.size
    hist = [0] * BINS; n = 0
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200: continue
            hist[min(BINS - 1, int(lum(r, g, b) * (BINS - 1)))] += 1; n += 1
    if not n: raise SystemExit("no opaque pixels in " + path)
    cdf = []; run = 0
    for h in hist:
        run += h; cdf.append(run / n)
    return cdf

def match_map(donor_cdf, ref_cdf):
    """donor luminance bin -> reference luminance bin, by equal cumulative share."""
    out = []; j = 0
    for i in range(BINS):
        while j < BINS - 1 and ref_cdf[j] < donor_cdf[i]:
            j += 1
        out.append(j)
    return out

def apply_curve(donor, curve, tone=None):
    im = Image.open(donor).convert("RGBA"); px = im.load(); W, H = im.size
    dst = Image.new("RGBA", (W, H)); dp = dst.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0: dp[x, y] = (0, 0, 0, 0); continue
            i = min(BINS - 1, int(lum(r, g, b) * (BINS - 1)))
            if tone: i = tone[i]
            L = i / (BINS - 1)
            gr, gg, gb = curve[i]
            # fade the tint out in the darks so bores and slots stay steel/shadow
            k = min(1.0, max(0.0, (L - NEUTRAL_KEEP * 0.4) / (NEUTRAL_KEEP * 0.6)))
            base = L * 255.0
            dp[x, y] = (int(round(base + (gr - base) * k)),
                        int(round(base + (gg - base) * k)),
                        int(round(base + (gb - base) * k)), a)
    return dst

def median_hsv(im):
    px = im.convert("RGBA").load(); W, H = im.size
    hs = []; ss = []; vs = []
    for y in range(int(H * .12), int(H * .88), max(1, H // 120)):
        for x in range(int(W * .06), int(W * .94), max(1, W // 120)):
            r, g, b, a = px[x, y]
            if a < 200: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hs.append(h * 360); ss.append(s); vs.append(v)
    hs.sort(); ss.sort(); vs.sort()
    m = lambda L: L[len(L) // 2]
    return m(hs), m(ss), m(vs), vs[-1] - vs[0]

# Four SKUs need nothing generated: the client's own polished-gold render already
# exists for them, and it is what the curve above was fitted from.
HAVE_REAL = ["ST-C1001", "ST-C1002", "ST-C1008", "ST-C1010"]
# Donor preference. Only the donor's LUMINANCE is used — its colour is discarded
# — so any finish of the same SKU can stand in. They are not equally good all
# the same: a polished render carries the sharp specular gradient a polished gold
# should have, and a matte one does not, so the neutral polished finishes come
# first and matte black is the last resort.
DONOR_ORDER = ["chrome", "gunGrey", "champagne", "gold", "brushedRoseGold", "roseGold", "matteBlack"]
NEW = "polishedGold"

def showers():
    """(sku, [finishes]) for every rain-shower row in the catalogue."""
    import re
    cat = open(os.path.join(os.path.dirname(PROD), "catalog.js")).read()
    rows = re.findall(r'\{\s*code:\s*"([^"]+)",\s*cat:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*finishes:\s*\[([^\]]*)\]', cat)
    return [(c, [f.strip().strip(chr(34)) for f in fin.split(",") if f.strip()])
            for c, k, n, fin in rows if k == "rain-shower"]

def donor_for(sku, fins):
    for d in DONOR_ORDER:
        if d in fins and os.path.exists(f"{sku}-{d}.png"):
            return d
    return None

def main():
    os.chdir(PROD)
    curve = fit(REF)
    ref_cdf = lum_cdf(REF)
    toner = lambda src: match_map(lum_cdf(src), ref_cdf)
    if "--check" in sys.argv:
        print("curve fitted from %s" % REF)
        for i in (0, 32, 64, 96, 128, 160, 192, 224, 255):
            print("   L=%3d -> rgb(%3.0f,%3.0f,%3.0f)" % (i, *curve[i]))
        print("\nreproducing the client's OWN gold from that SKU's neutral render:")
        print("  %-10s %-26s %-26s" % ("sku", "generated (h,s,v,range)", "client's own (h,s,v,range)"))
        for sku in HAVE_REAL:
            for d in ("gunGrey", "chrome"):
                if os.path.exists(f"{sku}-{d}.png"): break
            else: continue
            got = median_hsv(apply_curve(f"{sku}-{d}.png", curve, toner(f"{sku}-{d}.png")))
            want = median_hsv(Image.open(f"{sku}-gold.png"))
            print("  %-10s %6.1f %5.3f %5.3f %5.3f   %6.1f %5.3f %5.3f %5.3f   dHue %+.1f dSat %+.3f dVal %+.3f"
                  % (sku, *got, *want, got[0] - want[0], got[1] - want[1], got[2] - want[2]))
        return
    if "--write" not in sys.argv:
        print(__doc__); return
    for sku in HAVE_REAL:
        for ext in ("png", "webp"):
            src, dst = f"{sku}-gold.{ext}", f"{sku}-{NEW}.{ext}"
            Image.open(src).save(dst, **({"quality": 92, "method": 6} if ext == "webp" else {}))
            print("  copied  ", dst)
    for sku, fins in showers():
        if sku in HAVE_REAL: continue
        d = donor_for(sku, fins)
        if not d: print("  !! no donor for", sku); continue
        src = f"{sku}-{d}.png"
        out = apply_curve(src, curve, toner(src))
        out.save(f"{sku}-{NEW}.png")
        out.save(f"{sku}-{NEW}.webp", quality=92, method=6)
        print("  generated %-14s from %s" % (sku + "-" + NEW, d))

if __name__ == "__main__":
    main()
