# -*- coding: utf-8 -*-
"""Sample bag art for the sleep screen.

These sit behind a clock at a quarter opacity, so what has to read is the
shape and the colour, not the writing. Labels are blocks rather than words:
inventing a roastery's name onto a bag would be a small lie told in every
kitchen that has not filled its own wall yet.
"""
import io, os, json, math, random, base64
from PIL import Image, ImageDraw, ImageFilter

W, H = 480, 600
OUT = 'sample/generated'
os.makedirs(OUT, exist_ok=True)

PALETTES = [
    # (背 backdrop, bag, bag shadow, label, accent)
    ((236, 228, 214), (122, 84, 58), (96, 64, 42), (242, 236, 225), (176, 92, 54)),
    ((226, 231, 228), (46, 58, 54), (32, 42, 39), (231, 236, 232), (138, 170, 142)),
    ((240, 232, 220), (198, 176, 140), (170, 148, 114), (250, 246, 238), (120, 92, 66)),
    ((222, 226, 236), (58, 66, 96), (40, 47, 72), (236, 239, 247), (146, 158, 206)),
    ((238, 226, 222), (154, 72, 66), (124, 54, 50), (248, 238, 234), (214, 150, 110)),
    ((228, 234, 232), (84, 110, 104), (62, 84, 79), (240, 244, 242), (196, 158, 96)),
    ((234, 230, 240), (92, 70, 104), (68, 50, 78), (243, 240, 248), (186, 150, 198)),
    ((242, 238, 226), (182, 142, 72), (150, 114, 54), (250, 247, 238), (104, 86, 56)),
]

def grain(img, amount=9):
    n = Image.effect_noise((img.width, img.height), amount).convert('L')
    return Image.blend(img, Image.composite(img, img.point(lambda v: v), n), 0.0) if False else \
           Image.blend(img, Image.merge('RGB', (n, n, n)), 0.045)

def backdrop(d, pal):
    base, _, _, _, accent = pal
    for y in range(H):
        k = y / H
        c = tuple(int(base[i] * (1 - 0.14 * k) ) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)

def soft_shadow(img, box, blur=18, alpha=70):
    sh = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sh).rounded_rectangle(box, radius=16, fill=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    black = Image.new('RGB', (W, H), (0, 0, 0))
    img.paste(black, (0, 0), sh)

def label_block(d, x0, y0, x1, y1, pal, rng):
    _, _, _, lab, accent = pal
    d.rounded_rectangle([x0, y0, x1, y1], radius=8, fill=lab)
    w = x1 - x0
    y = y0 + int((y1 - y0) * 0.16)
    d.rounded_rectangle([x0 + w * 0.12, y, x0 + w * 0.62, y + 13], radius=6, fill=accent)
    y += 28
    for i in range(rng.randint(2, 4)):
        wid = rng.uniform(0.34, 0.76)
        d.rounded_rectangle([x0 + w * 0.12, y, x0 + w * (0.12 + wid * 0.74), y + 7],
                            radius=3, fill=tuple(int(v * 0.55) for v in lab))
        y += 17
    d.line([x0 + w * 0.12, y + 8, x1 - w * 0.12, y + 8], fill=accent, width=2)

def pouch(img, d, pal, rng):
    bag, shade = pal[1], pal[2]
    x0, x1 = int(W * 0.17), int(W * 0.83)
    y0, y1 = int(H * 0.14), int(H * 0.90)
    soft_shadow(img, [x0 + 8, y0 + 14, x1 + 8, y1 + 10])
    d.rounded_rectangle([x0, y0, x1, y1], radius=14, fill=bag)
    for xx in range(x0, x1):
        k = abs((xx - (x0 + x1) / 2) / ((x1 - x0) / 2))
        f = 1.0 + 0.16 * (1 - k * k) - 0.12 * k
        d.line([(xx, y0 + 4), (xx, y1 - 2)],
               fill=tuple(min(255, int(v * f)) for v in bag))
    d.rounded_rectangle([x0, y0, x1, y1], radius=14, outline=shade, width=2)
    # the folded top
    d.rounded_rectangle([x0 - 6, y0 - 16, x1 + 6, y0 + 22], radius=8, fill=shade)
    # a seam of light down one side
    d.rectangle([x0 + 10, y0 + 26, x0 + 26, y1 - 10],
                fill=tuple(min(255, int(v * 1.14)) for v in bag))
    label_block(d, int(W * 0.25), int(H * 0.34), int(W * 0.75), int(H * 0.68), pal, rng)
    if rng.random() < 0.5:
        d.ellipse([W * 0.37, H * 0.76, W * 0.63, H * 0.84],
                  outline=tuple(int(v * 0.8) for v in bag), width=3)

def sack(img, d, pal, rng):
    bag, shade = pal[1], pal[2]
    x0, x1 = int(W * 0.10), int(W * 0.90)
    y0, y1 = int(H * 0.22), int(H * 0.93)
    soft_shadow(img, [x0 + 6, y0 + 16, x1 + 6, y1 + 8])
    d.rounded_rectangle([x0, y0, x1, y1], radius=22, fill=bag)
    # burlap weave
    step = 7
    warp = tuple(int(v * 0.90) for v in bag)
    for x in range(x0, x1, step):
        d.line([(x, y0), (x, y1)], fill=warp, width=2)
    for y in range(y0, y1, step):
        d.line([(x0, y), (x1, y)], fill=warp, width=1)
    # the gathered mouth
    d.rounded_rectangle([x0 + 20, y0 - 28, x1 - 20, y0 + 16], radius=14, fill=shade)
    label_block(d, int(W * 0.24), int(H * 0.42), int(W * 0.76), int(H * 0.74), pal, rng)

def tin(img, d, pal, rng):
    bag, shade, accent = pal[1], pal[2], pal[4]
    x0, x1 = int(W * 0.20), int(W * 0.80)
    y0, y1 = int(H * 0.20), int(H * 0.86)
    soft_shadow(img, [x0 + 8, y0 + 14, x1 + 8, y1 + 8])
    d.rounded_rectangle([x0, y0, x1, y1], radius=20, fill=bag)
    d.ellipse([x0, y0 - 18, x1, y0 + 26], fill=shade)
    for k in (0.30, 0.74):
        yy = y0 + (y1 - y0) * k
        d.rectangle([x0, yy, x1, yy + 12], fill=accent)
    label_block(d, int(W * 0.27), int(H * 0.40), int(W * 0.73), int(H * 0.66), pal, rng)

def beans(img, d, pal, rng):
    """A tray of roasted beans. Elongated, turned every which way, each with
    the crease down its middle -- round blobs read as confetti."""
    ROAST = [(74, 46, 30), (92, 58, 36), (110, 70, 44), (58, 36, 24),
             (128, 84, 52), (84, 52, 32)]
    for y in range(H):
        k = y / H
        d.line([(0, y), (W, y)], fill=(int(34 + 16 * k), int(22 + 11 * k), int(15 + 8 * k)))
    bean = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for _ in range(rng.randint(150, 200)):
        bw = rng.uniform(34, 50)
        bh = bw * rng.uniform(0.60, 0.70)
        c = ROAST[rng.randrange(len(ROAST))]
        c = tuple(min(255, int(v * rng.uniform(0.85, 1.25))) for v in c)
        tile = Image.new('RGBA', (int(bw) + 8, int(bh) + 8), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile)
        td.ellipse([4, 4, 4 + bw, 4 + bh], fill=c + (255,))
        # the lighter top edge, then the crease
        td.arc([4, 4, 4 + bw, 4 + bh], 190, 350,
               fill=tuple(min(255, int(v * 1.5)) for v in c) + (255,), width=3)
        td.line([4 + bw * 0.14, 4 + bh / 2, 4 + bw * 0.86, 4 + bh / 2],
                fill=tuple(int(v * 0.45) for v in c) + (255,), width=3)
        tile = tile.rotate(rng.uniform(0, 360), expand=True,
                           resample=Image.BICUBIC)
        bean.alpha_composite(tile, (int(rng.uniform(-30, W)), int(rng.uniform(-30, H))))
    img.paste(bean, (0, 0), bean)

SHAPES = [pouch, pouch, sack, tin, beans]

def make(i):
    rng = random.Random(1000 + i * 37)
    pal = PALETTES[i % len(PALETTES)]
    img = Image.new('RGB', (W, H), pal[0])
    d = ImageDraw.Draw(img)
    backdrop(d, pal)
    SHAPES[i % len(SHAPES)](img, d, pal, rng)
    img = grain(img)
    return img.filter(ImageFilter.GaussianBlur(0.4))

BUDGET = 60 * 1024
out = []
for i in range(12):
    im = make(i)
    data = None
    for q in range(72, 29, -6):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
        d64 = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode('ascii')
        if len(d64) <= BUDGET:
            data = d64; break
    im.save('%s/%02d.jpg' % (OUT, i), 'JPEG', quality=86)
    out.append({'d': data, 't': 'generated-%02d' % i})
    print('%02d  %-7s  %4d KB' % (i, SHAPES[i % len(SHAPES)].__name__, len(data) // 1024))

io.open('sample/sample-bags.json', 'w', encoding='utf-8').write(
    json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print()
print('%d장, 파일 %d KB' % (len(out), os.path.getsize('sample/sample-bags.json') // 1024))
