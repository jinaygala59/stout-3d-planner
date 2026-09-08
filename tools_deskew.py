"""De-skew a FLAT trim plate's studio render into a face-on rectangle.

Why this exists. Every product render in the range is a three-quarter studio
shot. For a piece that PROJECTS out of the wall that is a feature — the neck and
head really are at an angle, and the photograph is the only record of it. For a
flat PLATE it is a defect: the plate is parallel to the wall in reality, so any
slope or taper in the picture reads as a fixture screwed on crooked, and no
rotation can fix it because the distortion is projective, not angular. The three
wide thermostatic bars measure a top edge running -4 deg, a bottom edge running
-6.5 deg, and a right side 14% shorter than the left. That is a homography.

The plate's own alpha silhouette gives the four corners, so the correction is
measured off each render rather than typed. Output is the same plate mapped onto
an axis-aligned rectangle: long edge horizontal, zero roll, zero taper.

    python3 tools_deskew.py            # writes assets/products/face/<code>-<finish>.{png,webp}

Only run this on FLAT plates. See the body-jet note in planner.js for what it
does to a protruding fitting.
"""
import glob, math, os, sys
from PIL import Image

FLAT_PLATES = ["ST-D5018", "ST-D5019", "ST-D5020"]
OUT = os.path.join("assets", "products", "face")


def solve8(rows, rhs):
    """Gaussian elimination with partial pivoting — no numpy on this machine."""
    n = len(rhs)
    m = [list(rows[i]) + [rhs[i]] for i in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[piv][col]) < 1e-12:
            raise ValueError("singular")
        m[col], m[piv] = m[piv], m[col]
        d = m[col][col]
        m[col] = [v / d for v in m[col]]
        for r in range(n):
            if r == col:
                continue
            f = m[r][col]
            if f:
                m[r] = [a - f * b for a, b in zip(m[r], m[col])]
    return [m[i][n] for i in range(n)]


def coeffs(dst, src):
    """PIL PERSPECTIVE wants the map OUTPUT -> INPUT, so dst is the rectangle."""
    rows, rhs = [], []
    for (dx, dy), (sx, sy) in zip(dst, src):
        rows.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); rhs.append(sx)
        rows.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); rhs.append(sy)
    return solve8(rows, rhs)


def quad(im):
    """The plate's four corners, from its own alpha."""
    w, h = im.size
    a = im.load()
    pts = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2) if a[x, y][3] > 140]
    if not pts:
        return None
    tl = min(pts, key=lambda p: p[0] + p[1]); br = max(pts, key=lambda p: p[0] + p[1])
    tr = max(pts, key=lambda p: p[0] - p[1]); bl = min(pts, key=lambda p: p[0] - p[1])
    return [tl, tr, br, bl]


def deskew(path):
    im = Image.open(path).convert("RGBA")
    q = quad(im)
    if not q:
        return None
    tl, tr, br, bl = q
    W = round(max(math.dist(tl, tr), math.dist(bl, br)))
    H = round(max(math.dist(tl, bl), math.dist(tr, br)))
    rect = [(0, 0), (W, 0), (W, H), (0, H)]
    c = coeffs(rect, q)
    out = im.transform((W, H), Image.PERSPECTIVE, c, Image.BICUBIC)
    return out, q, (W, H)


def main():
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for code in FLAT_PLATES:
        for src in sorted(glob.glob(os.path.join("assets", "products", code + "-*.png"))):
            r = deskew(src)
            if not r:
                print("  skip (no alpha):", src); continue
            out, q, (W, H) = r
            base = os.path.basename(src)[:-4]
            out.save(os.path.join(OUT, base + ".png"))
            out.save(os.path.join(OUT, base + ".webp"), quality=92, method=6)
            n += 1
            print(f"  {base}  quad{q} -> {W}x{H}")
    print(f"de-skewed {n} renders into {OUT}")


if __name__ == "__main__":
    main()
