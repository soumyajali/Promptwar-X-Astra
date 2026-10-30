"""Generate a night street illustration (one-point perspective, wet road, warm streetlights).

Used beside the citizen report form and in the Command Center sidebar. Generated, not a photograph.
Run:  python3 frontend/scripts/make_street.py
"""
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 900, 1100
VX, VY = W * 0.5, H * 0.52  # vanishing point
rng = random.Random(11)
np.random.seed(11)
OUT = Path(__file__).resolve().parent.parent / "public" / "img"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    img = Image.new("RGB", (W, H), (12, 18, 16))
    d = ImageDraw.Draw(img)
    # sky: dusk glow at the end of the street
    for y in range(int(VY) + 40):
        t = y / (VY + 40)
        d.line([(0, y), (W, y)], fill=lerp((14, 20, 20), (170, 104, 52), t ** 2.2))
    # far towers at the vanishing point
    for _ in range(26):
        bw = rng.randint(14, 46)
        x = VX + rng.uniform(-170, 170)
        top = VY - rng.randint(60, 300)
        col = lerp((80, 66, 50), (42, 40, 34), rng.random())
        d.rectangle([x - bw / 2, top, x + bw / 2, VY + 6], fill=col)
        for wy in range(int(top) + 6, int(VY), 9):
            for wx in range(int(x - bw / 2) + 3, int(x + bw / 2) - 3, 7):
                if rng.random() < 0.18:
                    d.rectangle([wx, wy, wx + 2, wy + 3], fill=(255, 196, 110))
    # building walls on both sides, receding to the vanishing point
    for side in (-1, 1):
        x_out = 0 if side < 0 else W
        x_in = VX + side * 120
        for k in range(9):
            t0, t1 = k / 9, (k + 1) / 9
            xa = x_out + (x_in - x_out) * t0 ** 0.7
            xb = x_out + (x_in - x_out) * t1 ** 0.7
            top_a = -40 + (VY - 320) * t0 ** 0.7 * 0.9
            top_b = -40 + (VY - 320) * t1 ** 0.7 * 0.9
            bot_a = H * 0.86 + (VY + 10 - H * 0.86) * t0 ** 0.7
            bot_b = H * 0.86 + (VY + 10 - H * 0.86) * t1 ** 0.7
            shade = lerp((26, 34, 30), (44, 42, 36), t0)
            d.polygon([(xa, top_a), (xb, top_b), (xb, bot_b), (xa, bot_a)], fill=shade)
            # lit windows as perspective-scaled rectangles
            rows = 12
            for r in range(rows):
                fy = (r + 0.5) / rows
                for c in range(3):
                    fx = (c + 0.5) / 3
                    if rng.random() < 0.35:
                        x = xa + (xb - xa) * fx
                        ya = top_a + (bot_a - top_a) * fy
                        yb = top_b + (bot_b - top_b) * fy
                        y = ya + (yb - ya) * fx
                        sz = max(2, 9 * (1 - t0))
                        d.rectangle([x - sz * 0.6, y - sz, x + sz * 0.6, y + sz * 0.4], fill=(255, 190, 104) if rng.random() < 0.8 else (220, 226, 210))
    # road (wet) and pavements
    d.polygon([(0, H), (W, H), (VX + 26, VY + 10), (VX - 26, VY + 10)], fill=(20, 24, 22))
    d.polygon([(0, H * 0.9), (0, H), (W * 0.12, H), (VX - 30, VY + 10)], fill=(34, 38, 34))
    d.polygon([(W, H * 0.9), (W, H), (W * 0.88, H), (VX + 30, VY + 10)], fill=(34, 38, 34))
    for i in range(14):  # centre dashes
        t0, t1 = (i / 14) ** 1.8, ((i + 0.5) / 14) ** 1.8
        ya, yb = VY + 10 + (H - VY) * t0, VY + 10 + (H - VY) * t1
        w0, w1 = 1 + 7 * t0, 1 + 7 * t1
        d.polygon([(VX - w0, ya), (VX + w0, ya), (VX + w1, yb), (VX - w1, yb)], fill=(150, 140, 110))
    # streetlights with reflections on the wet road
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    for side in (-1, 1):
        for k in range(6):
            t = (k / 6) ** 1.5
            x = VX + side * (W * 0.46) * (1 - t) + side * 30 * t
            ytop = H * 0.18 + (VY - 80 - H * 0.18) * (1 - (1 - t) ** 1)
            ybase = H * 0.9 + (VY + 8 - H * 0.9) * t
            ytop = ybase - (420 * (1 - t) + 40)
            d.line([(x, ybase), (x, ytop)], fill=(18, 20, 18), width=max(1, int(6 * (1 - t))))
            r = 6 + 22 * (1 - t)
            g.ellipse([x - r * 3, ytop - r * 3, x + r * 3, ytop + r * 3], fill=(255, 170, 70))
            d.ellipse([x - r * 0.35, ytop - r * 0.35, x + r * 0.35, ytop + r * 0.35], fill=(255, 226, 170))
            # reflection streak
            ry = ybase + (ybase - ytop) * 0.25
            g.rectangle([x - r * 0.6 - (VX - x) * 0.1, ybase, x + r * 0.6 - (VX - x) * 0.1, min(H, ry + 120 * (1 - t))], fill=(200, 120, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    arr = np.asarray(img).astype(float) + np.asarray(glow).astype(float) * 0.55
    # wet-road sheen: mirror the upper half faintly onto the road
    upper = np.asarray(img).astype(float)
    for y in range(int(VY) + 12, H):
        sy = int(VY - (y - VY) * 0.9)
        if sy >= 0:
            arr[y] = arr[y] * 0.82 + upper[sy] * 0.18
    yy, xx = np.mgrid[0:H, 0:W]
    v = np.clip(1 - (((xx - W / 2) / (W * 0.8)) ** 2 + ((yy - H / 2) / (H * 0.8)) ** 2), 0, 1) ** 0.6
    arr *= (0.5 + 0.5 * v)[:, :, None]
    arr += np.random.normal(0, 3, arr.shape)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / "street-night.jpg", quality=78, optimize=True, progressive=True)
    print("written", OUT / "street-night.jpg")


if __name__ == "__main__":
    main()
