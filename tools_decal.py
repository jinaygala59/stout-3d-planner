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
    # square head, 4x4 nub grid. Its four finishes are FOUR DIFFERENT RENDERS
    # (different camera, different crop), so the face is measured per finish.
    "ST-BJ-02": { "mask": "square", "quads": {
        "roseGold":    [(148, 57), (294, 33), (292, 262), (148, 305)],     # 299x317, plate left
        "brushedGold": [(139, 54), (275, 31), (273, 246), (139, 287)],     # 280x298, same render, smaller
        "gunGrey":     [(8, 108), (505, 205), (500, 858), (32, 676)],      # 900x861, seen from above-left, plate right
        "matteBlack":  [(240, 112), (465, 72), (465, 433), (240, 478)],    # 478x481, plate left, shot from the other side
    } },
    # rounded-square head, three nozzles on a black face
    "ST-BJ3F":  { "quad": [(648, 90), (893, 47), (882, 625), (650, 668)], "mask": "rounded", "radius": 0.13 },
    # round head: top / right / bottom / left extremes of the disc's ellipse
    "ST-J06":   { "quad": [(95, 52), (250, 228), (152, 409), (2, 235)], "mask": "round" },
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
    if "quads" in spec:
        fin = os.path.basename(src)[:-4].split("-")[-1]
        if fin not in spec["quads"]:
            raise SystemExit("no face quad measured for %s" % src)
        return spec["quads"][fin]
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
            out = cut(src, spec)
            base = os.path.basename(src)[:-4]
            out.save(os.path.join(OUT, base + ".png"))
            out.save(os.path.join(OUT, base + ".webp"), quality=92, method=6)
            print("  ", base)


if __name__ == "__main__":
    main()
