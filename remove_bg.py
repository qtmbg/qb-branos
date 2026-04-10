#!/usr/bin/env python3
"""Remove background from specific PNG files by sampling top-left pixel."""
import math
import sys
from pathlib import Path
from PIL import Image

FILES = [
    "persona-01-blank-slate.png",
    "persona-01-blank-slate-alt.png",
    "persona-01-blank-slate-alt2.png",
    "persona-02-doubter.png",
    "persona-02-doubter-alt.png",
    "persona-03-player.png",
    "persona-04-pivot.png",
    "char-guide.png",
    "char-guide-alt.png",
    "char-guide-alt2.png",
    "char-guide-alt3.png",
    "char-guide-alt4.png",
    "char-client.png",
    "char-client-alt.png",
    "char-client-alt2.png",
    "scene-handoff-qbp.png",
]

THRESHOLD = 40
IMAGES_DIR = Path(__file__).parent / "images"


def process(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    br, bg, bb, _ = pixels[0, 0]
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            dr = r - br
            dg = g - bg
            db = b - bb
            if math.sqrt(dr * dr + dg * dg + db * db) <= THRESHOLD:
                pixels[x, y] = (r, g, b, 0)
                changed += 1
    img.save(path, "PNG")
    print(f"{path.name}: bg=({br},{bg},{bb}) transparent_pixels={changed}")


def main() -> None:
    for name in FILES:
        p = IMAGES_DIR / name
        if not p.exists():
            print(f"MISSING: {name}", file=sys.stderr)
            continue
        process(p)


if __name__ == "__main__":
    main()
