#!/usr/bin/env python3
"""Export web-weight OBJ meshes from the client's own 3D files.

Source: ~/stout-3d-models/"Stout Product 3D files" (the WhatsApp RAR, extracted).
Those exports are anonymous ("Stout Model.obj"), heavy (up to 61 MB), and carry
Blender part names (Cube.059) plus MTLs pointing at Windows paths. This script
turns the four we have identified against the product photography into named,
light meshes under assets/models/:

  jet-sq.obj      square body jet — plate / neck / head / nubs   (Stout OBJ/New folder (13))
  spout-plain.obj plain square-section wall spout                 (Stout OBJ/New folder (15))
  mixer-wall.obj  wall-mounted basin mixer, plate + spout + lever (Stout OBJ/New folder (3))
  jet-panel.obj   flush 16-jet panel with its rough-in box        (body jets/Bodyjet.obj)
  mixer-deck.obj  tall single-lever deck basin mixer               (Stout OBJ/New folder (2))
                  — re-exported because its body object carries stray `l` polylines,
                  which makes three's OBJLoader build the WHOLE object as lines: the
                  spout and base loaded, the body between them did not.

What it does per part: optional vertex-clustering decimation (grid size as a
fraction of the part's bbox), then crease-aware smooth normals (faces meeting at
more than CREASE degrees stay sharp, so boxes keep their edges and cylinders stay
round), written at 4 decimals with no texture coords. No numpy on this machine —
pure Python, a few seconds per model.

Run from the repo root:  python3 tools_models.py
"""
import math, os, sys
from collections import defaultdict

SRC = os.path.expanduser("~/stout-3d-models/Stout Product 3D files")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "models")
CREASE = math.cos(math.radians(42))

# name -> (source path, [(new part name, [source object names or predicate], grid fraction or 0)])
def m13_parts():
    nubs = ["Cube.%03d" % i for i in range(64, 83)] + ["Cube.062"]
    return [("plate", ["Cube.060"], 0.018), ("neck", ["Cube.063"], 0.04),
            ("head", ["Cube.059"], 0.018), ("nubs", nubs, 0.16)]

JOBS = {
    "jet-sq":      (f"{SRC}/Stout OBJ/New folder (13)/Stout Model.obj", m13_parts()),
    "spout-plain": (f"{SRC}/Stout OBJ/New folder (15)/Stout Model.obj", [("body", ["Cube.098"], 0.011)]),
    "mixer-wall":  (f"{SRC}/Stout OBJ/New folder (3)/Stout Model.obj",
                    [("plate", ["Cube.002"], 0.004), ("spout", ["Cylinder"], 0.02),
                     ("handle", ["Cube.003", "Cube.004", "Sphere", "Cylinder.029"], 0.03)]),
    "jet-panel":   (f"{SRC}/body jets/Bodyjet.obj",
                    [("plate", ["Cube.081"], 0.012), ("nozzles", ["Cylinder.024"], 0.03), ("box", ["Cube.080"], 0.004)]),
    "mixer-deck":  (f"{SRC}/Stout OBJ/New folder (2)/Stout Model.obj",
                    [("base", ["Cube.056"], 0.01), ("body", ["Cube.068"], 0.006), ("aerator", ["Circle"], 0.02),
                     ("lever", ["8A545B1DF4E15BC5C564858356A12A8DEF005354___B8A4396250C5687B.019"], 0.02)]),
}


def parse(path):
    verts, objs, cur = [], defaultdict(list), "(none)"
    with open(path, "rb") as fh:
        for line in fh:
            if line.startswith(b"v "):
                p = line.split(); verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith(b"o ") or line.startswith(b"g "):
                cur = line[2:].strip().decode("utf-8", "replace")
            elif line.startswith(b"f "):
                idx = []
                for t in line.split()[1:]:
                    i = int(t.split(b"/")[0])
                    idx.append(i - 1 if i > 0 else len(verts) + i)
                # fan-triangulate anything that is not a triangle
                for k in range(1, len(idx) - 1):
                    objs[cur].append((idx[0], idx[k], idx[k + 1]))
    return verts, objs


def decimate(verts, tris, frac):
    """Vertex clustering on a grid of `frac` x the part's bbox diagonal."""
    if not tris or frac <= 0:
        return verts, tris
    used = sorted({i for t in tris for i in t})
    mn = [min(verts[i][k] for i in used) for k in range(3)]
    mx = [max(verts[i][k] for i in used) for k in range(3)]
    cell = max(1e-9, math.dist(mn, mx) * frac)
    cells, out_v, remap = {}, [], {}
    for i in used:
        v = verts[i]
        key = tuple(int((v[k] - mn[k]) / cell) for k in range(3))
        if key not in cells:
            cells[key] = [0.0, 0.0, 0.0, 0]
        c = cells[key]; c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; c[3] += 1
        remap[i] = key
    keys = {}
    for key, c in cells.items():
        keys[key] = len(out_v); out_v.append((c[0] / c[3], c[1] / c[3], c[2] / c[3]))
    out_t = []
    for a, b, c in tris:
        ia, ib, ic = keys[remap[a]], keys[remap[b]], keys[remap[c]]
        if ia != ib and ib != ic and ia != ic:
            out_t.append((ia, ib, ic))
    return out_v, out_t


def compact(verts, tris):
    used = sorted({i for t in tris for i in t})
    remap = {i: n for n, i in enumerate(used)}
    return [verts[i] for i in used], [(remap[a], remap[b], remap[c]) for a, b, c in tris]


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def normals(verts, tris):
    """Per face-corner normals: the mean of adjacent face normals within CREASE of this face."""
    fn = []
    for a, b, c in tris:
        n = cross(sub(verts[b], verts[a]), sub(verts[c], verts[a]))
        fn.append((n, norm(n)))            # area-weighted + unit
    adj = defaultdict(list)
    for fi, t in enumerate(tris):
        for vi in t:
            adj[vi].append(fi)
    corner = []
    for fi, t in enumerate(tris):
        me = fn[fi][1]
        row = []
        for vi in t:
            acc = [0.0, 0.0, 0.0]
            for fj in adj[vi]:
                if dot(fn[fj][1], me) >= CREASE:
                    w = fn[fj][0]; acc[0] += w[0]; acc[1] += w[1]; acc[2] += w[2]
            row.append(norm(acc) if any(acc) else me)
        corner.append(row)
    return corner


def export(name, src, parts):
    verts, objs = parse(src)
    lines = ["# %s — exported from the client's own 3D files by tools_models.py" % name]
    v_base = 1; n_base = 1
    total_v = total_f = 0
    for pname, members, frac in parts:
        if not any(objs.get(m) for m in members):
            print("  !! %s: no faces for %s" % (name, pname)); continue
        pv, pt = [], []
        for m in members:                       # each source object on its OWN bbox
            ov, ot = compact(verts, objs.get(m, []))
            if not ot: continue
            ov, ot = decimate(ov, ot, frac)
            ov, ot = compact(ov, ot)
            base = len(pv); pv.extend(ov); pt.extend((a + base, b + base, c + base) for a, b, c in ot)
        cn = normals(pv, pt)
        lines.append("o %s" % pname)
        for v in pv:
            lines.append("v %.4f %.4f %.4f" % v)
        for row in cn:
            for n in row:
                lines.append("vn %.3f %.3f %.3f" % n)
        k = 0
        for a, b, c in pt:
            lines.append("f %d//%d %d//%d %d//%d" % (a + v_base, n_base + k, b + v_base, n_base + k + 1, c + v_base, n_base + k + 2))
            k += 3
        v_base += len(pv); n_base += 3 * len(pt)
        total_v += len(pv); total_f += len(pt)
        print("  %-8s %6d verts %6d faces" % (pname, len(pv), len(pt)))
    out = os.path.join(OUT, name + ".obj")
    with open(out, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("%s: %d verts, %d faces, %.2f MB -> %s" % (name, total_v, total_f, os.path.getsize(out) / 1e6, out))


if __name__ == "__main__":
    only = sys.argv[1:]
    for name, (src, parts) in JOBS.items():
        if only and name not in only: continue
        print("==", name)
        export(name, src, parts)
