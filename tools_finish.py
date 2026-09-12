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

THUMB_W = 220   # the rail, the tool's finish preview and the spec sheet all read
                # assets/products/thumb/ — a finish without thumbnails shows as a
                # broken tile the moment it is a product's default

PROD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "products")
# ---------------------------------------------------------------------------
# ONE REFERENCE PER FINISH. Each is a REAL render out of the client's Drive — a
# photograph of a product the factory actually shot in that colour — never one
# of this script's own outputs. Fitting a curve to a generated file would be
# deriving a derivation, and the error would compound silently.
# Where a choice exists, the reference is a big overhead plate off ONE SKU
# (ST-C1008), so the only thing that differs between these curves is the finish.
# Two are not showers, because no shower in the folder was shot in them: brushed
# gold comes off the wall spout and champagne off the flat overhead panel.
REFS = {
    "chrome":          "ST-C1019-chrome.png",
    "gunGrey":         "ST-C1008-gunGrey.png",
    "gold":            "ST-C1008-gold.png",
    "roseGold":        "ST-C1008-roseGold.png",
    "brushedRoseGold": "ST-C1008-brushedRoseGold.png",
    "matteBlack":      "ST-C1008-matteBlack.png",
    "champagne":       "ST-FDP-champagne.png",
    "brushedGold":     "ST-WM-001-brushedGold.png",
}
REF = REFS["gold"]             # the polished-gold curve, kept as the default
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

# TRUE clipping only. At L>0.90 this caught ordinary bright chrome — a polished
# plate is legitimately 60-80% brighter than 0.90 and has full detail in it — and
# would have switched matching off for renders that need it. Measured at L>0.98
# the two populations separate cleanly: the healthy chrome donors sit at 0.1-5%,
# and the four the studio blew out sit at 22-46%.
CLIP_L = 0.98
CLIP_MAX = 0.15

def clipped_share(path):
    """Fraction of the render's opaque pixels that are blown to near-white."""
    im = Image.open(path).convert("RGBA"); px = im.load(); W, H = im.size
    hot = n = 0
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 200: continue
            n += 1
            if lum(r, g, b) > CLIP_L: hot += 1
    return hot / n if n else 0.0

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

def real_skus(fin):
    """SKUs whose render in `fin` came from the Drive, not from this script."""
    return [s for s, _ in showers() if os.path.exists(f"{s}-{fin}.png") and fin != NEW]

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

def thumb(path):
    """A 220px-wide copy under thumb/, matching the rest of the range."""
    os.makedirs("thumb", exist_ok=True)
    im = Image.open(path).convert("RGBA")
    h = max(1, round(im.height * THUMB_W / im.width))
    t = im.resize((THUMB_W, h), Image.LANCZOS)
    base = os.path.join("thumb", os.path.basename(path).rsplit(".", 1)[0])
    t.save(base + ".png")
    t.save(base + ".webp", quality=92, method=6)

def tone_for(src, ref_cdf):
    """The donor's tone map onto the reference — or None when it must not have one.

    Histogram matching is the right move for a normally-exposed donor: it gives
    the variant the FINISH's tonal response rather than the donor's. It is the
    wrong move for a BLOWN-OUT one. Several chrome renders here are half studio
    softbox — ST-C1016 is 49% clipped — and inside that band the donor holds
    almost no real variation, just render noise. Matching stretches that noise
    across the reference's whole upper range, and out comes a soft pale ellipse
    in the middle of the plate: a stain in no photograph of the product, worst on
    matte black, where it reads as a grey smear on a black plate.
    A clipped donor gets a LINEAR range match instead: its 1st-to-99th percentile
    mapped onto the reference's. Linear is the whole point — every luminance is
    moved by the same rule, so nothing inside the highlight can be stretched into
    detail, while the plate still lands at the level the finish actually sits at.
    Skipping the map entirely was not enough: the curve then reads the blown area
    at its own near-white luminance and returns the finish's brightest tone for
    it, so matte black on the Lumina plates came out a pale sage grey at value
    0.64 against 0.20-0.38 for every matte black the client actually shot. Range
    matched, it lands where it belongs."""
    if clipped_share(src) <= CLIP_MAX:
        return match_map(lum_cdf(src), ref_cdf)
    da, db = pctl_bins(src); ra, rb = pctl_bins_cdf(ref_cdf)
    k = (rb - ra) / max(1, db - da)
    return [min(BINS - 1, max(0, int(round(ra + (i - da) * k)))) for i in range(BINS)]

def pctl_bins_cdf(cdf, lo=0.01, hi=0.99):
    a = next((i for i, c in enumerate(cdf) if c >= lo), 0)
    b = next((i for i, c in enumerate(cdf) if c >= hi), BINS - 1)
    return a, b

def pctl_bins(path, lo=0.01, hi=0.99):
    return pctl_bins_cdf(lum_cdf(path), lo, hi)

def run_finish(fin, write):
    """Fit `fin`'s curve off its real reference, validate it against every shower
       the client DID shoot in it, then fill in the ones they did not."""
    ref = REFS[fin]
    if not os.path.exists(ref):
        print(f"  !! no reference render for {fin} ({ref}) — skipped"); return
    curve = fit(ref); ref_cdf = lum_cdf(ref)
    toner = lambda src: match_map(lum_cdf(src), ref_cdf)
    real = real_skus(fin)
    print(f"\n=== {fin}  (curve off {ref})")
    # VALIDATE FIRST, and against held-out SKUs: regenerate the finish for the
    # ones whose real render we already have and measure the error against it.
    errs = []
    for sku in real:
        fins = dict(showers()).get(sku, [])
        d = donor_for(sku, [f for f in fins if f != fin])
        if not d: continue
        got = median_hsv(apply_curve(f"{sku}-{d}.png", curve, tone_for(f"{sku}-{d}.png", ref_cdf)))
        want = median_hsv(Image.open(f"{sku}-{fin}.png"))
        dh = (got[0] - want[0] + 180) % 360 - 180
        errs.append((sku, d, dh, got[1] - want[1], got[2] - want[2]))
    if errs:
        for sku, d, dh, ds, dv in errs:
            print(f"    check {sku:10} from {d:16} dHue {dh:+6.1f}  dSat {ds:+.3f}  dVal {dv:+.3f}")
        n = len(errs)
        print(f"    mean |dHue| {sum(abs(e[2]) for e in errs)/n:.1f}  "
              f"|dSat| {sum(abs(e[3]) for e in errs)/n:.3f}  |dVal| {sum(abs(e[4]) for e in errs)/n:.3f}")
    else:
        print("    (no held-out SKU to check against — this finish has one reference only)")
    if not write: return
    made = 0
    for sku, fins in showers():
        if os.path.exists(f"{sku}-{fin}.png"): continue      # the client's own render wins
        d = donor_for(sku, fins)
        if not d: print(f"    !! no donor for {sku}"); continue
        src = f"{sku}-{d}.png"
        out = apply_curve(src, curve, tone_for(src, ref_cdf))
        out.save(f"{sku}-{fin}.png"); out.save(f"{sku}-{fin}.webp", quality=92, method=6)
        thumb(f"{sku}-{fin}.png"); made += 1
        print(f"    made {sku}-{fin:16} from {d}")
    print(f"    {made} generated")

# =============================================================================
# ONE SPOUT, IN THE WHOLE PALETTE
# -----------------------------------------------------------------------------
# The range offers a single bath spout, ST-PLAIN, and the Drive folder ships it
# in three finishes only — gun grey, champagne and brushed rose gold. So in a
# room whose finish is locked to any of the other five the spout card greys out
# with "Not made in Matte Black" and the client cannot place a spout at all.
#
# The reference for each finish is ST-2513, the single-lever wall mixer: same
# Axis family, same square section, same studio set-up, and the folder ships it
# in seven of the eight. Brushed gold comes off ST-WM-001, the twin-lever wall
# tap, for the same reason. The donor is the spout's OWN gun-grey render.
#
# This is checkable on the SKU itself: ST-2513 also has the three finishes the
# spout really ships, so generating those and comparing them against the spout's
# own photographs says how far the method is off for THIS product, not for a
# stand-in. `--spout-check` prints exactly that.
# =============================================================================
SPOUT = "ST-PLAIN"
SPOUT_DONOR = "ST-PLAIN-gunGrey.png"
SPOUT_REF = {
    "chrome":          "ST-2513-chrome.png",
    "gold":            "ST-2513-gold.png",
    "roseGold":        "ST-2513-roseGold.png",
    "matteBlack":      "ST-2513-matteBlack.png",
    "brushedGold":     "ST-WM-001-brushedGold.png",
    # the three the folder ships for the spout itself — used only to CHECK
    "gunGrey":         "ST-2513-gunGrey.png",
    "champagne":       "ST-2513-champagne.png",
    "brushedRoseGold": "ST-2513-brushedRoseGold.png",
}
SPOUT_REAL = ("gunGrey", "champagne", "brushedRoseGold")

def spout_variant(finish):
    ref = SPOUT_REF[finish]
    curve = fit(ref)
    tone = match_map(lum_cdf(SPOUT_DONOR), lum_cdf(ref))
    return apply_curve(SPOUT_DONOR, curve, tone)

def spout_main(write):
    os.chdir(PROD)
    if not write:
        print("reproducing the spout's OWN photographs from its gun-grey render:")
        print("  %-16s %-28s %-28s" % ("finish", "generated (h,s,v,range)", "the folder's own"))
        for f in SPOUT_REAL:
            got = median_hsv(spout_variant(f))
            want = median_hsv(Image.open(f"{SPOUT}-{f}.png"))
            print("  %-16s %6.1f %5.3f %5.3f %5.3f   %6.1f %5.3f %5.3f %5.3f   dHue %+6.1f dSat %+.3f dVal %+.3f"
                  % (f, *got, *want, got[0] - want[0], got[1] - want[1], got[2] - want[2]))
        return
    for f in SPOUT_REF:
        if f in SPOUT_REAL:
            continue                      # the folder's own photograph stands
        out = spout_variant(f)
        out.save(f"{SPOUT}-{f}.png")
        out.save(f"{SPOUT}-{f}.webp", quality=92, method=6)
        thumb(f"{SPOUT}-{f}.png")
        print("  generated %-26s from %s" % (f"{SPOUT}-{f}", SPOUT_REF[f]))

# =============================================================================
# ONE SKU, EVERY FINISH.
# The shower path above walks the rain-shower rows and the spout path is pinned
# to ST-PLAIN; neither helps when a single product elsewhere in the range needs
# filling out. This does it for any code: take that SKU's most neutral real
# render as the donor, and run each finish's own measured curve over it.
# The error is reported for THAT PRODUCT before anything is written — the SKU's
# own real renders are regenerated from a DIFFERENT donor and compared against
# the photographs, so "close enough" is a number off this product, not a promise
# borrowed from the showers.
#
#   python3 tools_finish.py --sku ST-2FBJ            # report only
#   python3 tools_finish.py --sku ST-2FBJ --write    # fill in the missing finishes
# =============================================================================
def sku_finishes(sku):
    """The finishes this SKU has a REAL render for, in donor-preference order."""
    return [f for f in DONOR_ORDER + [f for f in REFS if f not in DONOR_ORDER]
            if os.path.exists(f"{sku}-{f}.png")]

def sku_variant(sku, finish, donor):
    ref = REFS[finish]
    curve = fit(ref)
    src = f"{sku}-{donor}.png"
    return apply_curve(src, curve, tone_for(src, lum_cdf(ref)))

def sku_main(sku, write):
    os.chdir(PROD)
    real = sku_finishes(sku)
    if not real:
        print(f"  !! no render of any finish for {sku}"); return
    donor = real[0]
    print(f"{sku}: donor {donor}, real renders {', '.join(real)}")

    # CHECK FIRST — regenerate the ones we can already see, from another donor
    others = [f for f in real if f != donor]
    print("\n  reproducing this product's OWN photographs:")
    print("    %-16s %-28s %-28s" % ("finish", "generated (h,s,v,range)", "the folder's own"))
    for f in others:
        alt = next((d for d in real if d != f), donor)
        got = median_hsv(sku_variant(sku, f, alt))
        want = median_hsv(Image.open(f"{sku}-{f}.png"))
        dh = (got[0] - want[0] + 180) % 360 - 180
        print("    %-16s %6.1f %5.3f %5.3f %5.3f   %6.1f %5.3f %5.3f %5.3f   dHue %+6.1f dSat %+.3f dVal %+.3f"
              % (f, *got, *want, dh, got[1] - want[1], got[2] - want[2]))
    if not others:
        print("    (only one real render — nothing to check against)")

    missing = [f for f in REFS if f not in real]
    print("\n  missing: %s" % (", ".join(missing) or "none"))
    if not write:
        print("  (report only — pass --write to generate)"); return
    for f in missing:
        if not os.path.exists(REFS[f]):
            print(f"    !! no reference render for {f} — skipped"); continue
        out = sku_variant(sku, f, donor)
        out.save(f"{sku}-{f}.png")
        out.save(f"{sku}-{f}.webp", quality=92, method=6)
        thumb(f"{sku}-{f}.png")
        print("    generated %-24s from %s via %s" % (f"{sku}-{f}", donor, REFS[f]))

def main():
    if "--sku" in sys.argv:
        i = sys.argv.index("--sku")
        if i + 1 >= len(sys.argv): raise SystemExit("--sku needs a product code")
        return sku_main(sys.argv[i + 1], "--write" in sys.argv)
    if "--spout-check" in sys.argv: return spout_main(False)
    if "--spout-write" in sys.argv: return spout_main(True)
    os.chdir(PROD)
    if "--all" in sys.argv:
        write = "--write" in sys.argv
        for fin in REFS: run_finish(fin, write)
        return
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
        thumb(f"{sku}-{NEW}.png")
    for sku, fins in showers():
        if sku in HAVE_REAL: continue
        d = donor_for(sku, fins)
        if not d: print("  !! no donor for", sku); continue
        src = f"{sku}-{d}.png"
        out = apply_curve(src, curve, toner(src))
        out.save(f"{sku}-{NEW}.png")
        out.save(f"{sku}-{NEW}.webp", quality=92, method=6)
        thumb(f"{sku}-{NEW}.png")
        print("  generated %-14s from %s" % (sku + "-" + NEW, d))

if __name__ == "__main__":
    main()
