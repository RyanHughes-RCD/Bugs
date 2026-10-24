"""Render every sprites/*.txt into PNGs.
Usage: python render.py [scale]   (default scale 8)
Outputs: png/1x/<name>.png, png/<scale>x/<name>.png, spritesheet.png, spritesheet_<scale>x.png
"""
import sys, glob, os
from PIL import Image

SCALE = int(sys.argv[1]) if len(sys.argv) > 1 else 8
here = os.path.dirname(os.path.abspath(__file__))

pal = {}
for line in open(os.path.join(here, "palette.txt")):
    line = line.strip()
    if not line or line.startswith("#"): continue
    ch, hx = line.split()[:2]
    pal[ch] = tuple(int(hx[i:i+2], 16) for i in (1, 3, 5)) + (255,)

def load(path):
    rows = [r.rstrip("\n") for r in open(path) if r.strip()]
    w = max(len(r) for r in rows)
    img = Image.new("RGBA", (w, len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), pal[ch])
    return img

names, imgs = [], []
for p in sorted(glob.glob(os.path.join(here, "sprites", "*.txt"))):
    names.append(os.path.splitext(os.path.basename(p))[0]); imgs.append(load(p))

for d in ("1x", f"{SCALE}x"): os.makedirs(os.path.join(here, "png", d), exist_ok=True)
for n, im in zip(names, imgs):
    im.save(os.path.join(here, "png", "1x", n + ".png"))
    im.resize((im.width*SCALE, im.height*SCALE), Image.NEAREST).save(os.path.join(here, "png", f"{SCALE}x", n + ".png"))

cols = 4
cw = max(i.width for i in imgs); ch = max(i.height for i in imgs)
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new("RGBA", (cols*cw, rows*ch), (0, 0, 0, 0))
for i, im in enumerate(imgs):
    sheet.paste(im, ((i % cols)*cw, (i // cols)*ch))
sheet.save(os.path.join(here, "spritesheet.png"))
sheet.resize((sheet.width*SCALE, sheet.height*SCALE), Image.NEAREST).save(os.path.join(here, f"spritesheet_{SCALE}x.png"))
print("Rendered:", ", ".join(names))
