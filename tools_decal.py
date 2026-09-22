#!/usr/bin/env python3
"""Cut the SPRAY FACE out of a body-jet photograph and square it up, as a decal.

The three-quarter renders of the jets carry the head's face at an angle. On the
wall the jet is now real geometry (see tools_models.py / MODEL_FOR_SKU), and the
one thing the client's OBJ cannot tell us is what THIS SKU's face looks like —
a rosette, a 4x4 grid, three nozzles, a 25-hole disc. So the face is taken from
the SKU's own photograph: the head's front face is mapped by homography onto a
square, masked to the face's outline, and written to assets/products/face/ as
<CODE>-<finish>.{png,webp}. planner.js lays that square on the head of the model.

Corners are measured once per SKU (they are identical across finishes) off a
labelled pixel grid of the render. TL, TR, BR, BL in source pixels; for the round
jet the four points are the disc's top, right, bottom and left extremes instead,
which the same homography carries onto the circle inscribed in the square.
"""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join("assets", "products", "face")
S = 512    # decal size (square)

JETS = {
    # square head, a straight 4x4 grid of 16 nozzles and NO centre hole. Its
    # finishes are DIFFERENT RENDERS (different camera, different crop), so the
    # face is measured per finish.
    # THE GUN GREY RENDER WAS A DIFFERENT PRODUCT until 2026-09-22 - the DUAL
    # function jet, whose face is ~20 domes in a diagonal lattice around a centre
    # mist pinhole - and chrome, brushed bronze and brushed rose gold had been
    # generated from it by tools_finish.py, so one wrong source render became
    # five, and four of the six decals cut the wrong jet's face. All four now
    # come off the catalogue's own single-function pages; see the note on
    # UNCODED["ST-SF"] in tools_july.py. roseGold and matteBlack were always
    # this jet and are untouched, quads and all.
    # These quads are FITTED, not eyeballed: the 16 nozzles are detected, a
    # homography is solved from grid index to pixel (max residual 0.19 px on the
    # p118 frame, 0.74 px on chrome), and the corners are taken 0.7 of a cell
    # outside the outermost nozzles. 0.85 let the plate's own edge into the
    # decal; 0.55 cropped inside the border the render actually shows.
    "ST-SF": { "mask": "square", "quads": {
        "roseGold":    [(148, 57), (294, 33), (292, 262), (148, 305)],     # 299x317, plate left
        "matteBlack":  [(240, 112), (465, 72), (465, 433), (240, 478)],    # 478x481, plate left, shot from the other side
        "chrome":      [(58, 37), (158, 19), (157, 139), (58, 162)],       # 164x164, p117, plate RIGHT
        # p118 prints these three at one size off one camera - their alpha
        # silhouettes differ by ~130 pixels in 24k - so ONE quad cuts all three.
        "gunGrey":         [(1, 16), (83, 25), (82, 141), (4, 117)],       # 160x149, p118, plate left
        "champagne":       [(1, 16), (83, 25), (82, 141), (4, 117)],
        "brushedRoseGold": [(1, 16), (83, 25), (82, 141), (4, 117)],
    } },
    # rounded-square head, three nozzles. All eight renders are 900x701 off the
    # same camera, so ONE quad cuts them all.
    # ROSE GOLD IS SKIPPED, and it is the only skip in this file. Seven of the
    # eight renders show the face in the SKU's own metal with the nozzle bosses
    # raised in it; the rose gold one alone shows a BLACK face with black
    # nozzles — a different state of the product, not a different finish of the
    # same one. Cut as a decal it put a black square on a rose gold jet, which
    # measured 39 of 255 darker than the trim plate beside it, against +12 for
    # the bare modelled head. That is the single widest colour gap in the range
    # and it is in the artwork, not the renderer. Ask the factory for a rose
    # gold render lit like the other seven and delete this skip.
    "ST-DC":  { "quad": [(648, 90), (893, 47), (882, 625), (650, 668)], "mask": "rounded", "radius": 0.13,
                  "skip": {"roseGold"} },
    # round head: top / right / bottom / left extremes of the disc's ellipse
    "ST-3F":   { "quad": [(95, 52), (250, 228), (152, 409), (2, 235)], "mask": "round" },
}

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tools_deskew import coeffs   # the 8-coefficient homography solver (pure python)


def mask_for(kind, radius):
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    if kind == "square":
        d.rectangle([0, 0, S - 1, S - 1], fill=255)
    elif kind == "rounded":
        r = int(S * radius)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
    else:
        d.ellipse([0, 0, S - 1, S - 1], fill=255)
    # a one-pixel soft edge so the outline does not alias against the metal
    return m.filter(ImageFilter.GaussianBlur(0.7))


def quad_for(spec, src):
    """The face corners for this render, or None if none were measured.

    None used to abort the whole run. That was right when every PNG on disk was
    a finish the range offered; it is not now, because a retired finish leaves
    its renders behind — ST-SF-brushedGold.png sorts first and killed the run
    before any of the finishes that DO need cutting were reached. Skipped and
    reported instead."""
    if "quads" in spec:
        return spec["quads"].get(os.path.basename(src)[:-4].split("-")[-1])
    return spec["quad"]


def cut(src, spec):
    im = Image.open(src).convert("RGBA")
    q = quad_for(spec, src)
    if spec["mask"] == "round":
        top, right, bottom, left = q
        dst = [(S / 2, 0), (S, S / 2), (S / 2, S), (0, S / 2)]
        c = coeffs(dst, [top, right, bottom, left])
    else:
        c = coeffs([(0, 0), (S, 0), (S, S), (0, S)], q)
    out = im.transform((S, S), Image.PERSPECTIVE, c, Image.BICUBIC)
    a = out.split()[3]
    m = mask_for(spec["mask"], spec.get("radius", 0.1))
    from PIL import ImageChops
    out.putalpha(ImageChops.multiply(a, m))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    for code, spec in JETS.items():
        if only and code not in only: continue
        for src in sorted(glob.glob(os.path.join("assets", "products", code + "-*.png"))):
            if os.path.basename(src)[:-4].split("-")[-1] in spec.get("skip", ()):
                print("   skip", os.path.basename(src)[:-4], "(see the note beside its quad)")
                continue
            if quad_for(spec, src) is None:
                print("   skip", os.path.basename(src)[:-4], "(no quad measured)")
                continue
            out = cut(src, spec)
            base = os.path.basename(src)[:-4]
            out.save(os.path.join(OUT, base + ".png"))
            out.save(os.path.join(OUT, base + ".webp"), quality=92, method=6)
            print("  ", base)


if __name__ == "__main__":
    main()
