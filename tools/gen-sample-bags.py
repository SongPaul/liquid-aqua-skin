# -*- coding: utf-8 -*-
"""Sample bag art for the Liquid Aqua sleep screen.

Drawn, not photographed: a real roastery's packaging is their artwork and
their trademark, and this file is redistributed with the skin.

What is copied is the shape language of Korean specialty packaging -- a
flat-bottom pouch with side gussets, a tin tie across the top, a small
centred label on kraft or matte white, one accent colour and a lot of space.
The words on the label are origin, process and weight, which describe a
coffee rather than name a roastery; no brand is invented.
"""
import io, os, json, math, random, base64
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

W, H = 520, 650
SS = 2                      # drawn at twice the size, then reduced: cheap antialiasing
OUT = 'sample/generated'
os.makedirs(OUT, exist_ok=True)

FONT_B = r'C:\Windows\Fonts\malgunbd.ttf'
FONT_R = r'C:\Windows\Fonts\malgun.ttf'
def font(path, size):
    return ImageFont.truetype(path, size * SS)

# paper, not plastic: creams, kraft, charcoal, one accent each
SCHEMES = [
    dict(bg=(231, 227, 219), body=(246, 243, 237), seam=(228, 223, 214),
         ink=(48, 44, 40), accent=(176, 92, 54), tie=(60, 56, 52)),
    dict(bg=(224, 222, 218), body=(198, 166, 122), seam=(180, 148, 106),
         ink=(58, 44, 32), accent=(146, 72, 48), tie=(70, 56, 44)),
    dict(bg=(226, 229, 227), body=(44, 48, 46), seam=(34, 38, 36),
         ink=(238, 236, 230), accent=(190, 158, 92), tie=(24, 27, 26)),
    dict(bg=(235, 231, 226), body=(240, 236, 228), seam=(222, 217, 208),
         ink=(44, 48, 56), accent=(78, 110, 150), tie=(52, 58, 66)),
    dict(bg=(228, 224, 230), body=(72, 62, 86), seam=(58, 49, 70),
         ink=(238, 234, 242), accent=(198, 166, 120), tie=(40, 34, 50)),
    dict(bg=(232, 228, 220), body=(186, 196, 188), seam=(166, 177, 169),
         ink=(40, 48, 44), accent=(168, 92, 66), tie=(56, 64, 60)),
    dict(bg=(222, 226, 230), body=(28, 32, 38), seam=(20, 23, 28),
         ink=(232, 234, 238), accent=(206, 128, 72), tie=(16, 18, 22)),
    dict(bg=(238, 232, 224), body=(214, 196, 168), seam=(196, 177, 148),
         ink=(52, 44, 36), accent=(96, 116, 96), tie=(64, 56, 46)),
]

ORIGINS = ['에티오피아 예가체프', '케냐 니에리', '콜롬비아 우일라', '과테말라 안티구아',
           '파나마 보케테', '르완다 후예', '브라질 세하도', '코스타리카 따라주',
           '엘살바도르 산타아나', '인도네시아 가요', '부룬디 카얀자', '페루 카하마르카']
PROCESS = ['워시드', '내추럴', '허니', '무산소 발효', '워시드', '내추럴']
NOTES   = ['자스민 · 베르가못', '자두 · 흑당', '청사과 · 홍차', '다크초콜릿 · 견과',
           '복숭아 · 꿀', '베리 · 와인', '시트러스 · 꽃', '카라멜 · 아몬드']

def paper(size, seed, strength=0.055):
    """A fibre-ish grain, so a flat fill does not look like a flat fill."""
    rng = random.Random(seed)
    n = Image.effect_noise(size, 26).convert('L')
    n = n.filter(ImageFilter.GaussianBlur(0.6))
    return n, strength

def apply_grain(img, seed, strength=0.055):
    n, s = paper(img.size, seed, strength)
    g = Image.merge('RGB', (n, n, n))
    return Image.blend(img, ImageChops.overlay(img, g), s * 6)

def vshade(d, box, top, bottom):
    """Vertical wash, for the light falling down a bag."""
    x0, y0, x1, y1 = box
    for y in range(int(y0), int(y1)):
        k = (y - y0) / max(1, (y1 - y0))
        c = tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3))
        d.line([(x0, y), (x1, y)], fill=c)

def mul(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)

def contact_shadow(img, box, blur, alpha):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=18 * SS, fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    img.paste(Image.new('RGB', img.size, (0, 0, 0)), (0, 0), m)

def label(d, box, sch, rng, dark_body):
    x0, y0, x1, y1 = box
    w = x1 - x0
    panel = (250, 247, 241) if dark_body else None
    if panel:
        d.rounded_rectangle(box, radius=4 * SS, fill=panel)
        ink = (46, 42, 38)
    else:
        ink = sch['ink']
    cx = (x0 + x1) / 2
    f_small = font(FONT_R, 11)
    f_big = font(FONT_B, 19)
    f_mid = font(FONT_R, 13)

    d.line([cx - w * 0.16, y0 + 26 * SS, cx + w * 0.16, y0 + 26 * SS], fill=sch['accent'], width=2 * SS)
    t = 'SINGLE ORIGIN'
    d.text((cx, y0 + 42 * SS), t, font=f_small, fill=mul(ink, 1.0), anchor='mt')

    org = getattr(rng, 'origin', None) or rng.choice(ORIGINS)
    parts = org.split(' ')
    y = y0 + 68 * SS
    for p in parts:
        d.text((cx, y), p, font=f_big, fill=ink, anchor='mt')
        y += 30 * SS

    d.text((cx, y + 6 * SS), rng.choice(PROCESS), font=f_mid, fill=sch['accent'], anchor='mt')
    d.text((cx, y + 32 * SS), rng.choice(NOTES), font=f_small, fill=mul(ink, 1.4) if dark_body else mul(ink, 2.2), anchor='mt')

    d.line([cx - w * 0.30, y1 - 40 * SS, cx + w * 0.30, y1 - 40 * SS],
           fill=mul(sch['accent'], 1.0), width=1 * SS)
    d.text((cx, y1 - 32 * SS), '200 g   ROASTED IN SEOUL', font=f_small, fill=mul(ink, 1.2) if dark_body else mul(ink, 1.8), anchor='mt')

def pouch(img, d, sch, rng, gusset=True):
    """Flat-bottom pouch, tin tie across the top, small centred label."""
    x0, x1 = int(W * 0.21 * SS), int(W * 0.79 * SS)
    y0, y1 = int(H * 0.13 * SS), int(H * 0.92 * SS)
    contact_shadow(img, [x0 + 6 * SS, y0 + 16 * SS, x1 + 6 * SS, y1 + 8 * SS], 16 * SS, 78)
    body, seam = sch['body'], sch['seam']
    d.rounded_rectangle([x0, y0, x1, y1], radius=7 * SS, fill=body)
    # light down the face
    vshade(d, [x0 + 1, y0 + 1, x1 - 1, y1 - 1], mul(body, 1.07), mul(body, 0.88))
    if gusset:
        gw = int((x1 - x0) * 0.13)
        vshade(d, [x0, y0, x0 + gw, y1], mul(seam, 1.0), mul(seam, 0.84))
        vshade(d, [x1 - gw, y0, x1, y1], mul(seam, 0.94), mul(seam, 0.78))
    # the tin tie, folded over
    th = int((y1 - y0) * 0.075)
    d.rounded_rectangle([x0 - 3 * SS, y0 - th, x1 + 3 * SS, y0 + th * 0.5],
                        radius=5 * SS, fill=sch['tie'])
    d.line([x0, y0 + th * 0.5, x1, y0 + th * 0.5], fill=mul(sch['tie'], 0.7), width=2 * SS)
    # a one-way valve, the giveaway of a coffee bag
    vx, vy = (x0 + x1) / 2 + (x1 - x0) * 0.22, y1 - (y1 - y0) * 0.17
    d.ellipse([vx - 13 * SS, vy - 13 * SS, vx + 13 * SS, vy + 13 * SS],
              fill=mul(body, 0.86), outline=mul(body, 0.72), width=SS)
    d.ellipse([vx - 4 * SS, vy - 4 * SS, vx + 4 * SS, vy + 4 * SS], fill=mul(body, 0.7))
    dark = sum(body) / 3 < 120
    lw, lh = int((x1 - x0) * 0.70), int((y1 - y0) * 0.52)
    lx = (x0 + x1) / 2 - lw / 2
    ly = y0 + (y1 - y0) * 0.16
    label(d, [lx, ly, lx + lw, ly + lh], sch, rng, dark)

def kraft_block(img, d, sch, rng):
    """A squarer kraft box-pouch, label set high."""
    x0, x1 = int(W * 0.16 * SS), int(W * 0.84 * SS)
    y0, y1 = int(H * 0.20 * SS), int(H * 0.88 * SS)
    contact_shadow(img, [x0 + 5 * SS, y0 + 14 * SS, x1 + 5 * SS, y1 + 8 * SS], 14 * SS, 72)
    body = sch['body']
    d.rounded_rectangle([x0, y0, x1, y1], radius=4 * SS, fill=body)
    vshade(d, [x0 + 1, y0 + 1, x1 - 1, y1 - 1], mul(body, 1.05), mul(body, 0.9))
    # the kraft weave, very faint
    for x in range(x0, x1, 5 * SS):
        d.line([(x, y0), (x, y1)], fill=mul(body, 0.975))
    # folded top corners
    d.polygon([(x0, y0), (x0 + 42 * SS, y0), (x0, y0 + 30 * SS)], fill=mul(body, 0.86))
    d.polygon([(x1, y0), (x1 - 42 * SS, y0), (x1, y0 + 30 * SS)], fill=mul(body, 0.86))
    dark = sum(body) / 3 < 120
    lw, lh = int((x1 - x0) * 0.62), int((y1 - y0) * 0.56)
    lx = (x0 + x1) / 2 - lw / 2
    ly = y0 + (y1 - y0) * 0.14
    label(d, [lx, ly, lx + lw, ly + lh], sch, rng, dark)

def beans(img, d, sch, rng):
    """A tray of roasted beans: elongated, turned every way, creased."""
    ROAST = [(58, 36, 24), (70, 44, 28), (84, 54, 34), (48, 30, 20), (96, 62, 38)]
    vshade(d, [0, 0, W * SS, H * SS], (34, 24, 17), (18, 13, 9))
    layer = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    for _ in range(rng.randint(230, 290)):
        bw = rng.uniform(30, 44) * SS
        bh = bw * rng.uniform(0.60, 0.70)
        c = mul(ROAST[rng.randrange(len(ROAST))], rng.uniform(0.85, 1.25))
        tile = Image.new('RGBA', (int(bw) + 10, int(bh) + 10), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile)
        td.ellipse([5, 5, 5 + bw, 5 + bh], fill=c + (255,))
        td.arc([5, 5, 5 + bw, 5 + bh], 195, 345, fill=mul(c, 1.35) + (255,), width=int(2 * SS))
        td.line([5 + bw * 0.15, 5 + bh / 2, 5 + bw * 0.85, 5 + bh / 2],
                fill=mul(c, 0.45) + (255,), width=int(2.5 * SS))
        tile = tile.rotate(rng.uniform(0, 360), expand=True, resample=Image.BICUBIC)
        layer.alpha_composite(tile, (int(rng.uniform(-40, W * SS)), int(rng.uniform(-40, H * SS))))
    img.paste(layer, (0, 0), layer)

SHAPES = [pouch, pouch, kraft_block, pouch, beans, pouch, kraft_block, pouch,
          pouch, beans, kraft_block, pouch]

def vignette(img, strength=0.22):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse([-img.width * 0.22, -img.height * 0.18,
                               img.width * 1.22, img.height * 1.18], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(img.width * 0.12)).point(
        lambda v: int(255 - (255 - v) * strength))
    black = Image.new('RGB', img.size, (0, 0, 0))
    return Image.composite(img, black, m)

_ORDER = None
def origin_for(i):
    global _ORDER
    if _ORDER is None:
        _ORDER = ORIGINS[:]
        random.Random(7).shuffle(_ORDER)
    return _ORDER[i % len(_ORDER)]

def make(i):
    rng = random.Random(4000 + i * 101)
    rng.origin = origin_for(i)
    sch = SCHEMES[i % len(SCHEMES)]
    big = Image.new('RGB', (W * SS, H * SS), sch['bg'])
    d = ImageDraw.Draw(big)
    vshade(d, [0, 0, W * SS, H * SS], mul(sch['bg'], 1.03), mul(sch['bg'], 0.9))
    SHAPES[i % len(SHAPES)](big, d, sch, rng)
    img = big.resize((W, H), Image.LANCZOS)
    img = apply_grain(img, i)
    img = vignette(img)
    return img

BUDGET = 64 * 1024
out = []
for i in range(12):
    im = make(i)
    data = None
    for q in range(76, 29, -5):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
        d64 = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode('ascii')
        if len(d64) <= BUDGET:
            data = d64; break
    im.save('%s/%02d.jpg' % (OUT, i), 'JPEG', quality=88)
    out.append({'d': data, 't': 'bag-%02d' % i})
    print('%02d  %-12s %4d KB' % (i, SHAPES[i % len(SHAPES)].__name__, len(data) // 1024))

io.open('sample/sample-bags.json', 'w', encoding='utf-8').write(
    json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print()
print('%d장, 파일 %d KB' % (len(out), os.path.getsize('sample/sample-bags.json') // 1024))
