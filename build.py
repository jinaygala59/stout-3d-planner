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
# The favicon is in here for a CACHING reason, not a build one: vercel.json
# serves assets/brand/* as "immutable, max-age=31536000", so a redrawn
# favicon at the same URL would never reach anyone who had already opened
# the planner — the tab would keep the old icon for a year. Stamping the
# href moves it to a new URL whenever the file's bytes change.
STAMPED = ("assets/planner.css", "assets/catalog.js", "assets/planner.js",
           "assets/brand/favicon.svg")


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
            # A SKIP_DIRS name can reach us as a FILE, and it broke the first
            # Vercel build (2026-09-16): _drive is a symlink to a 15 GB scratch
            # folder, so on a machine where that folder exists os.walk sees a
            # directory and the line above prunes it — but Vercel uploads the
            # link without its target, os.path.isdir() is then false, and a
            # broken symlink is listed among `files` instead. It sailed past
            # every filter here and copy2 died on it. Name it in both places.
            if name in SKIP_DIRS:
                continue
            # and a dangling link anywhere else is nothing to copy either
            if os.path.islink(os.path.join(base, name)) and not os.path.exists(os.path.join(base, name)):
                continue
            # the PNG masters stay in the repo; only the WebP copies ship
            if "assets/products" in base.replace(os.sep, "/") and name.endswith(".png"):
                continue
            # vercel.json at the ROOT tells Vercel how to BUILD this repo
            # (python3 build.py -> dist). Copied verbatim into dist it becomes a
            # build config sitting inside the build output, and a prebuilt upload
            # of dist/ then tries to run build.py in a folder that has none. The
            # bundle gets the serving half only — see the write below.
            if base == ROOT and name == "vercel.json":
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

    # the serving half of the root config: caching only, no build instructions,
    # so the bundle is a plain static site for Vercel or any other host
    import json
    with open(os.path.join(ROOT, "vercel.json")) as fh:
        full = json.load(fh)
    with open(os.path.join(DIST, "vercel.json"), "w") as fh:
        json.dump({k: full[k] for k in ("headers", "redirects", "cleanUrls") if k in full}, fh, indent=2)

    # A MANIFEST OF EVERY SHIPPED FILE, so the copy on the company site can keep
    # itself current (2026-09-25). stoutsanitaryware.com/visualizer/ is a static
    # folder on Hostinger that used to be re-uploaded by hand after each push,
    # and it went stale more than once while the Vercel copy was fine. A WPCode
    # snippet on the WordPress side now fetches this file from Vercel, compares
    # each hash with what it has, and downloads only what changed — so a rename
    # of nothing and a re-render under the same name both reach the site. Paths
    # are dist-relative with forward slashes; index.html is listed last so the
    # sync writes it after the files it points at.
    manifest = []
    for base, dirs, files in os.walk(DIST):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            if name.startswith(".") or name in ("manifest.json", "vercel.json"):
                continue
            path = os.path.join(base, name)
            rel = os.path.relpath(path, DIST).replace(os.sep, "/")
            with open(path, "rb") as fh:
                digest = hashlib.sha1(fh.read()).hexdigest()
            manifest.append({"path": rel, "sha1": digest, "size": os.path.getsize(path)})
    manifest.sort(key=lambda m: (m["path"] == "index.html", m["path"]))
    with open(os.path.join(DIST, "manifest.json"), "w") as fh:
        json.dump({"built": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
                   "files": manifest}, fh, separators=(",", ":"))

    print("dist/ ready — %d files, %.1f MB" % (copied, total / 1048576.0))
    print("Upload the contents of dist/ to any static host. No server code needed.")


if __name__ == "__main__":
    main()
