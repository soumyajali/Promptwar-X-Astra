"""Generate the CivicPulse hero image: a dusk cityscape with a river, painted procedurally.

No stock photography is used (the build environment cannot download images, and generated art
avoids licensing questions). Re-run to regenerate:  python3 frontend/scripts/make_hero.py
Replace frontend/public/img/hero-city.jpg with a real photo at any time; the CSS keeps working.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 2400, 1350
HORIZON = int(H * 0.56)
rng = random.Random(7)
np.random.seed(7)
OUT = Path(__file__).resolve().parent.parent / "public" / "img"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def noise(w, h, scale, octaves=4):
    """Smooth value noise in 0..1."""
    acc = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale / (2 ** o)))
        g = np.random.rand(h // s + 2, w // s + 2)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w + s * 2, h + s * 2), Image.BICUBIC)
        acc += amp * np.asarray(img, dtype=float)[:h, :w] / 255
        total += amp
        amp *= 0.5
    return acc / total


def sky():
    top, mid, low, glow = (24, 36, 36), (68, 78, 70), (176, 146, 102), (232, 196, 140)
    y = np.linspace(0, 1, HORIZON)[:, None]
    img = np.zeros((HORIZON, W, 3))
    for c in range(3):
        a = np.where(y < 0.55, top[c] + (mid[c] - top[c]) * (y / 0.55), mid[c] + (low[c] - mid[c]) * ((y - 0.55) / 0.45))
        img[:, :, c] = a
    # sun glow, right of centre, just above the horizon
    yy, xx = np.mgrid[0:HORIZON, 0:W]
    d = np.sqrt(((xx - W * 0.66) / (W * 0.42)) ** 2 + ((yy - HORIZON * 0.98) / (HORIZON * 0.55)) ** 2)
    g = np.clip(1 - d, 0, 1) ** 2.2
    for c in range(3):
        img[:, :, c] = img[:, :, c] * (1 - g * 0.75) + glow[c] * g * 0.75
    # soft cloud banks
    n = noise(W, HORIZON, 260)
    band = np.exp(-((yy / HORIZON - 0.42) ** 2) / 0.03)
    cl = np.clip((n - 0.52) * 3.2, 0, 1) * band
    for c, col in enumerate((122, 118, 100)):
        img[:, :, c] = img[:, :, c] * (1 - cl * 0.45) + col * cl * 0.45
    return img


def skyline(draw: ImageDraw.ImageDraw, base_y, count, hmin, hmax, colour, window_p, window_col, x_bias=None, wmin=40, wmax=120):
    x = -40
    while x < W + 40:
        bw = rng.randint(wmin, wmax)
        cx = (x + bw / 2) / W
        tall = 1.0
        if x_bias:
            for centre, spread, boost in x_bias:
                tall += boost * math.exp(-((cx - centre) ** 2) / spread)
        bh = int(rng.uniform(hmin, hmax) * tall)
        top = base_y - bh
        draw.rectangle([x, top, x + bw, base_y], fill=colour)
        # occasional setback crown / spire
        if bh > hmax * 1.2 and rng.random() < 0.6:
            sw = bw * rng.uniform(0.35, 0.6)
            sh = rng.randint(20, 70)
            draw.rectangle([x + (bw - sw) / 2, top - sh, x + (bw + sw) / 2, top], fill=colour)
            if rng.random() < 0.5:
                draw.line([x + bw / 2, top - sh, x + bw / 2, top - sh - rng.randint(30, 90)], fill=colour, width=3)
        if window_p:
            for wy in range(top + 10, base_y - 6, rng.choice([11, 13, 15])):
                for wx in range(x + 6, x + bw - 6, rng.choice([9, 11, 13])):
                    if rng.random() < window_p:
                        draw.rectangle([wx, wy, wx + 3, wy + 4], fill=window_col if rng.random() < 0.8 else (230, 214, 170))
        x += bw + rng.randint(-6, 14)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H))
    img.paste(Image.fromarray(sky().astype(np.uint8)), (0, 0))

    # far city: hazy, light, many towers, taller cluster right of centre
    far = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    skyline(ImageDraw.Draw(far), HORIZON + 4, 0, 40, 150, (120, 120, 104, 255), 0.04, (214, 186, 128, 255),
            x_bias=[(0.72, 0.004, 2.6), (0.55, 0.01, 0.8)], wmin=26, wmax=70)
    img.paste(far.filter(ImageFilter.GaussianBlur(1.6)), (0, 0), far.filter(ImageFilter.GaussianBlur(1.6)))

    # mid city: darker, lit windows
    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    skyline(ImageDraw.Draw(mid), HORIZON + 24, 0, 60, 230, (58, 66, 58, 255), 0.10, (238, 196, 120, 255),
            x_bias=[(0.78, 0.003, 2.4), (0.92, 0.002, 1.6), (0.12, 0.004, 0.8)], wmin=36, wmax=110)
    img.paste(mid.filter(ImageFilter.GaussianBlur(0.6)), (0, 0), mid.filter(ImageFilter.GaussianBlur(0.6)))

    # haze over the horizon
    haze = np.zeros((H, W, 4), dtype=np.uint8)
    yy = np.arange(H)[:, None]
    a = np.clip(1 - np.abs(yy - HORIZON) / 120, 0, 1) * 70
    haze[:, :, 0], haze[:, :, 1], haze[:, :, 2], haze[:, :, 3] = 196, 170, 126, a.astype(np.uint8)
    img.paste(Image.fromarray(haze, "RGBA"), (0, 0), Image.fromarray(haze, "RGBA"))

    def river_edges(y):
        t = (y - HORIZON - 20) / (H - HORIZON - 20)
        centre = W * (0.60 - 0.42 * t ** 1.3)
        half = W * (0.03 + 0.30 * t ** 1.6)
        return t, centre - half, centre + half

    # ground: hazy olive at the horizon, darkening toward the viewer, mottled by tree canopy
    arr = np.asarray(img).astype(float)
    ys = np.arange(HORIZON + 4, H)
    tt = ((ys - HORIZON) / (H - HORIZON))[:, None, None]
    near, farc = np.array([20, 28, 23]), np.array([92, 92, 76])
    ground = farc * (1 - tt ** 0.55) + near * tt ** 0.55
    canopy = noise(W, len(ys), 70, 5)[:, :, None]
    trees = np.clip((canopy - 0.5) * 4, 0, 1)
    tree_col = np.array([34, 50, 36]) * (1 - tt ** 0.5) + np.array([16, 28, 20]) * tt ** 0.5
    ground = ground * (1 - trees * 0.7) + tree_col * trees * 0.7
    arr[HORIZON + 4:] = ground * (0.9 + 0.2 * noise(W, len(ys), 12, 2)[:, :, None])

    # river reflecting the sky, with ripples and a warm sun streak
    for y in range(HORIZON + 20, H):
        t, x0f, x1f = river_edges(y)
        x0, x1 = int(max(0, x0f)), int(min(W, x1f))
        if x1 <= x0:
            continue
        src_y = max(0, HORIZON - (y - HORIZON) // 2 - 1)
        xs = np.arange(x0, x1)
        ripple = np.sin(xs * (0.03 + 0.02 * t) + y * 0.7) * 0.5 + 0.5
        refl = arr[src_y, x0:x1] * (0.58 + 0.14 * ripple[:, None])
        streak = np.exp(-((xs - W * 0.66 + (y - HORIZON) * 0.15) / (40 + 160 * t)) ** 2)[:, None] * (1 - t) * 60
        arr[y, x0:x1] = refl * 0.88 + np.array([26, 36, 34]) * 0.12 + streak * np.array([1, .8, .5])
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    # city blocks in perspective rows, drawn far to near; skip the river
    d = ImageDraw.Draw(img)
    y = HORIZON + 26
    while y < H + 40:
        t, le, re = river_edges(min(y, H - 1))
        step = 5 + 36 * t
        x = rng.uniform(-40, 0)
        while x < W:
            bw = (10 + 70 * t) * rng.uniform(0.5, 1.4)
            if (x + bw > le - 8 - 30 * t) and (x < re + 8 + 30 * t):
                x = re + 8 + 30 * t + rng.uniform(0, 20)
                continue
            if rng.random() < 0.22:  # gap: trees / open ground
                x += bw * rng.uniform(0.6, 1.6)
                continue
            bh = (5 + 60 * t) * rng.uniform(0.4, 1.3) * (2.2 if rng.random() < 0.06 else 1)
            roof_h = (3 + 14 * t) * rng.uniform(0.6, 1.0)
            base = lerp((86, 86, 72), (26, 34, 29), t ** 0.6)
            front = tuple(int(c * rng.uniform(0.82, 1.0)) for c in base)
            roof = tuple(min(255, int(c * 1.32 + 6)) for c in front)
            d.rectangle([x, y - bh, x + bw, y], fill=front)
            d.polygon([(x, y - bh), (x + bw, y - bh), (x + bw - roof_h * .6, y - bh - roof_h), (x + roof_h * .4, y - bh - roof_h)], fill=roof)
            if t > 0.15 and rng.random() < 0.55:
                ww = max(2, int(2 + 3 * t))
                for wy in np.arange(y - bh + 4 * (1 + t), y - 3, 6 + 7 * t):
                    for wx in np.arange(x + 3, x + bw - ww, 5 + 8 * t):
                        if rng.random() < 0.16:
                            d.rectangle([wx, wy, wx + ww, wy + ww * 1.3], fill=(236, 190, 116))
            x += bw + rng.uniform(2, 10 + 20 * t)
        y += step

    # embankments: a lit promenade line and a tree band along both banks
    for side in (0, 1):
        pts = []
        for yy in range(HORIZON + 22, H, 3):
            t, le, re = river_edges(yy)
            pts.append((re + 4 if side else le - 4, yy))
        d.line(pts, fill=(150, 136, 104), width=2)
        for (px, py) in pts[::2]:
            t = (py - HORIZON) / (H - HORIZON)
            r = 3 + 16 * t
            for _ in range(2):
                ox = (rng.uniform(4, 30) * (1 + 2 * t)) * (1 if side else -1)
                d.ellipse([px + ox - r, py - r * 1.4, px + ox + r, py + r * 0.3], fill=lerp((54, 70, 48), (20, 34, 24), t ** 0.6))
            if rng.random() < 0.06:
                d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(246, 206, 132))

    # small boats on the river
    for _ in range(8):
        yy = rng.randint(HORIZON + 90, H - 160)
        t, le, re = river_edges(yy)
        x = rng.uniform(le + (re - le) * 0.2, re - (re - le) * 0.2)
        sz = 5 + 20 * t
        d.polygon([(x - sz, yy), (x + sz, yy), (x + sz * 0.7, yy + sz * 0.35), (x - sz * 0.7, yy + sz * 0.35)], fill=(28, 32, 28))
        d.line([(x - sz * 1.8, yy + sz * 0.7), (x + sz * 1.8, yy + sz * 0.7)], fill=(140, 126, 96), width=1)

    # grade: bloom, cool shadows / warm highlights, vignette, grain
    bloom = img.filter(ImageFilter.GaussianBlur(18))
    arr = np.asarray(img).astype(float) * 0.86 + np.asarray(bloom).astype(float) * 0.22
    lum = arr.mean(axis=2, keepdims=True) / 255
    arr = arr * (1 - 0.18 * (1 - lum)) + np.array([8, 14, 12]) * (1 - lum) * 0.4
    yy, xx = np.mgrid[0:H, 0:W]
    v = np.clip(1 - (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2), 0, 1) ** 0.55
    arr *= (0.55 + 0.45 * v)[:, :, None]
    arr += np.random.normal(0, 3.2, arr.shape)
    final = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    final.save(OUT / "hero-city.jpg", quality=80, optimize=True, progressive=True)
    final.resize((1200, 675), Image.LANCZOS).save(OUT / "hero-city-sm.jpg", quality=78, optimize=True, progressive=True)
    print("written", OUT)


if __name__ == "__main__":
    main()
