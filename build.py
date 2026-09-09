"""Produce a deployable copy of the planner in ./dist.

The dev server rewrites `?v=DEV` in flight; a static host can't, so this bakes the
same content hashes into index.html and leaves out everything a visitor shouldn't
download (the dev pages, the git history, backups).

    python3 build.py        # → dist/, ready to upload to any static host
"""
import hashlib, os, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
# Dot-directories are tooling, not the site: .claude carries the dev-server
# config and .vercel the deploy link, and both were being copied into dist/ and
# uploaded with the bundle. _drive is a symlink to a 15 GB scratch folder — both
# it and _quarantine are gitignored, so a clean checkout never sees them, but
# anyone building locally would have shipped them.
SKIP_DIRS = {".git", "dist", "_dev", "__pycache__", "_quarantine", "_drive"}
SKIP_EXT = (".py", ".log")
STAMPED = ("assets/planner.css", "assets/catalog.js", "assets/planner.js")


def stamp(rel):
    with open(os.path.join(ROOT, rel), "rb") as fh:
        return hashlib.sha1(fh.read()).hexdigest()[:10]


def main():
    if os.path.isdir(DIST):
        # keep the host's project link — a rebuild that drops it makes the next
        # `vercel deploy` create a brand-new project called "dist".
        keep = os.path.join(DIST, ".vercel")
        stash = os.path.join(ROOT, ".vercel-link-stash")
        had_link = os.path.isdir(keep)
        if had_link:
            if os.path.isdir(stash):
                shutil.rmtree(stash)
            shutil.move(keep, stash)
        shutil.rmtree(DIST)
        if had_link:
            os.makedirs(DIST, exist_ok=True)
            shutil.move(stash, keep)
    copied = total = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for name in files:
            if name.endswith(SKIP_EXT) or name.startswith(".") or ".bak-" in name:
                continue
            # the PNG masters stay in the repo; only the WebP copies ship
            if "assets/products" in base.replace(os.sep, "/") and name.endswith(".png"):
                continue
            src = os.path.join(base, name)
            rel = os.path.relpath(src, ROOT)
            dst = os.path.join(DIST, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            copied += 1
            total += os.path.getsize(src)

    index = os.path.join(DIST, "index.html")
    with open(index, encoding="utf-8") as fh:
        html = fh.read()
    for rel in STAMPED:
        html = html.replace(rel + "?v=DEV", "%s?v=%s" % (rel, stamp(rel)))
    with open(index, "w", encoding="utf-8") as fh:
        fh.write(html)

    print("dist/ ready — %d files, %.1f MB" % (copied, total / 1048576.0))
    print("Upload the contents of dist/ to any static host. No server code needed.")


if __name__ == "__main__":
    main()
