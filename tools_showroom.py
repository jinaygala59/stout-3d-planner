#!/usr/bin/env python3
"""Install the showroom photograph that heads page 1 of the spec sheet.

The About page is already laid out for it: full-bleed across the top, then the
dark STOUT band, then ABOUT STOUT. downloadSpecSheet() looks for

    assets/brand/about-showroom.jpg   (then .png)

and prints the page without it when the file is absent, which is why the sheet
has been going out headerless. This puts the file where it is looked for.

Give it a path, or nothing and it takes the macOS clipboard — the usual case is
a photo that was just pasted or copied:

    python3 tools_showroom.py ~/Downloads/showroom.jpg
    python3 tools_showroom.py                 # from the clipboard

The page is 210 mm wide and the band is 88 mm deep, so the crop that matters is
roughly 2.4:1 out of the middle of the frame. coverDataURL() does that crop at
build time from whatever it is given; this only normalises the file — RGB, no
alpha, long edge 2000 px, quality 88 — so a 6 MB phone photo does not land
whole inside every PDF the client sends out.
"""
import os, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(ROOT, "assets", "brand", "about-showroom.jpg")
LONG = 2000


def from_clipboard():
    """macOS only. Ask the clipboard for TIFF, which it will convert to."""
    tmp = os.path.join(tempfile.mkdtemp(), "clip.tiff")
    script = ('set f to (POSIX file "%s")\n'
              'set d to (the clipboard as «class TIFF»)\n'
              'set h to open for access f with write permission\n'
              'write d to h\nclose access h' % tmp)
    r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if r.returncode or not os.path.exists(tmp):
        raise SystemExit("nothing usable on the clipboard — copy the photo, or "
                         "pass a file path:\n    python3 tools_showroom.py <path>")
    return tmp


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else from_clipboard()
    src = os.path.expanduser(src)
    if not os.path.exists(src):
        raise SystemExit("no such file: " + src)

    im = Image.open(src)
    im = im.convert("RGB")                       # the PDF is placed as JPEG
    w, h = im.size
    if max(w, h) > LONG:
        s = LONG / max(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    im.save(DEST, "JPEG", quality=88, optimize=True, progressive=True)

    ar = im.width / im.height
    print(f"installed {DEST}")
    print(f"  {w}x{h} -> {im.width}x{im.height}, {os.path.getsize(DEST)//1024} KB")
    if ar < 1.6:
        print(f"  note: the frame is {ar:.2f}:1 and the header crops to about "
              f"2.4:1, so the top and bottom of the picture will be cut. A wider "
              f"shot fills the band without losing anything.")
    print("  Download PDF again — the photo heads page 1, above ABOUT STOUT.")


if __name__ == "__main__":
    main()
