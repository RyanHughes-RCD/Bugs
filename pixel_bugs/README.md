# 16x16 Pixel Bugs

14 sprites, 16x16 px, 18-colour palette.

## Editing
**Text (source of truth):** each sprite is a 16x16 grid in `sprites/<name>.txt`.
One character = one pixel. `.` is transparent; every other character maps to a
colour in `palette.txt`. Change a letter, then run:

    pip install pillow
    python render.py        # or: python render.py 4   (choose upscale)

Recolour every sprite at once by changing a hex value in `palette.txt`.
Add new colours by adding a line (any unused single character).
Add new sprites by dropping a new .txt file in `sprites/`.

**Pixel editor:** `png/1x/*.png` are true-size transparent PNGs that open in
Aseprite, LibreSprite, Piskel, Pixelorama, GIMP, etc. (Edits made there won't
flow back into the .txt files.)

## Outputs
- `png/1x/` and `png/8x/` - individual sprites
- `spritesheet.png` - 4 columns, 16x16 cells, alphabetical order
- `spritesheet_8x.png` - upscaled preview
