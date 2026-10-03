#!/usr/bin/env python3
"""Generate the Re-Shell desktop source icon (1024x1024 PNG).

The mark is a shell prompt glyph (a chevron plus a cursor underscore) drawn in
the dashboard's signal-lime accent on the dark mission-control canvas. Colors
are the dashboard's published hex tokens (packages/ui/src/styles/globals.css).

    python3 generate_icon.py icon.png

Then produce every platform size (png/ico/icns) with the Tauri CLI, run from
apps/web:

    pnpm tauri icon src-tauri/icon-source/icon.png

Requires Pillow (pip install Pillow). The output is deterministic.
"""
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE = 1024
SS = 2  # supersampling factor for smooth edges
SIGNAL = (196, 240, 66)  # --signal  #c4f042
BG_TOP = (28, 32, 40)  # --bg-2     #1c2028
BG_BOTTOM = (12, 14, 18)  # --bg-0     #0c0e12


def s(v):
    return int(round(v * SS))


def lerp(a, b, t):
    return tuple(int(round(x + (y - x) * t)) for x, y in zip(a, b))


def rounded_mask(size, inset, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, size - inset, size - inset), radius=radius, fill=255
    )
    return mask


def build():
    n = s(SIZE)

    # Dark vertical-gradient tile.
    tile = Image.new("RGB", (n, n))
    px = ImageDraw.Draw(tile)
    for y in range(n):
        px.line([(0, y), (n, y)], fill=lerp(BG_TOP, BG_BOTTOM, y / (n - 1)))

    canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    mask = rounded_mask(n, s(64), s(210))
    canvas.paste(tile, (0, 0), mask)

    # Hairline inner border in the accent (low alpha) for definition.
    border = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle(
        (s(64), s(64), s(SIZE - 64), s(SIZE - 64)),
        radius=s(210),
        outline=SIGNAL + (70,),
        width=s(6),
    )
    canvas = Image.alpha_composite(canvas, border)

    # Glyph layer: chevron + cursor underscore.
    glyph = Image.new("L", (n, n), 0)
    gd = ImageDraw.Draw(glyph)
    stroke = s(104)
    pts = [(s(292), s(330)), (s(536), s(512)), (s(292), s(694))]
    gd.line(pts, fill=255, width=stroke, joint="curve")
    for p in pts:  # round caps at both ends and a round join at the tip
        r = stroke / 2
        gd.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=255)
    gd.rounded_rectangle((s(596), s(646), s(776), s(726)), radius=s(40), fill=255)

    # Soft glow under the glyph, clipped to the tile.
    glow_alpha = glyph.filter(ImageFilter.GaussianBlur(s(34))).point(lambda v: int(v * 0.55))
    glow_alpha = ImageChops.multiply(glow_alpha, mask)
    glow = Image.new("RGBA", (n, n), SIGNAL + (0,))
    glow.putalpha(glow_alpha)
    canvas = Image.alpha_composite(canvas, glow)

    solid = Image.new("RGBA", (n, n), SIGNAL + (255,))
    solid.putalpha(glyph)
    canvas = Image.alpha_composite(canvas, solid)

    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "icon.png"
    build().save(out, "PNG", optimize=True)
    print(f"wrote {out} ({SIZE}x{SIZE})")
