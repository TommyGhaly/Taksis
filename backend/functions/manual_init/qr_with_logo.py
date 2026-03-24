from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import qrcode
import csv
import os
import math

MANIFEST_PATH = '../qr_stickers/manifest.csv'
CROSS_PATH = './coptic_cross.png'
LOGO_PATH = './logo.png'
OUTPUT_DIR = '../qr_with_logo'

STYLE = {
    'size': 1024,
    'dot_scale': 0.38,
    'dot_glow': True,
    'glow_radius': 2,
    'glow_intensity': 0.4,
    'finder_radius': 14,
    'finder_inner_radius': 8,
    'finder_glow': True,
    'bg_color': (18, 18, 22),
    'dot_color': (255, 255, 255),
    'dot_gradient': True,
    'cross_opacity': 0.95,
    'cross_glow': True,
    'vignette': True,
    'vignette_strength': 0.3,
    'logo_scale': 0.18,
    'logo_padding': 12,
    'logo_shadow': True,
    'logo_bg_opacity': 220,
    'logo_circle_bg': True,
}

def is_finder_region(row, col, n):
    regions = [(0, 0), (0, n - 7), (n - 7, 0)]
    for r, c in regions:
        if r <= row < r + 7 and c <= col < c + 7:
            return True
    return False


def is_alignment_pattern(row, col, positions):
    for ar, ac in positions:
        if ar - 2 <= row <= ar + 2 and ac - 2 <= col <= ac + 2:
            return True
    return False


def get_alignment_positions(version):
    if version < 2:
        return []
    table = {
        2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
        7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    }
    if version not in table:
        return []
    pos = table[version]
    n = 17 + version * 4
    coords = []
    for r in pos:
        for c in pos:
            if (r < 9 and c < 9) or (r < 9 and c > n - 9) or (r > n - 9 and c < 9):
                continue
            coords.append((r, c))
    return coords


def is_bottom_right_alignment(row, col, n, positions):
    for ar, ac in positions:
        if ar > n - 15 and ac > n - 15:
            if ar - 2 <= row <= ar + 2 and ac - 2 <= col <= ac + 2:
                return True
    return False


def create_gradient_dot(size, color):
    """Dot with a subtle radial gradient — bright center, gentle falloff"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    center = size // 2
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - center) ** 2 + (y - center) ** 2)
            if dist <= center:
                t = dist / center
                brightness = 1.0 - (t * 0.3)   # keep original gradient feel
                alpha = int(255 * (1 - (t ** 0.5) * 0.15))
                r = min(255, int(color[0] * brightness + 40 * (1 - t)))
                g = min(255, int(color[1] * brightness + 40 * (1 - t)))
                b = min(255, int(color[2] * brightness + 40 * (1 - t)))
                img.putpixel((x, y), (r, g, b, alpha))
    return img


def create_glow_layer(base_img, radius, intensity):
    glow = base_img.copy()
    glow = glow.filter(ImageFilter.GaussianBlur(radius=radius))
    enhancer = ImageEnhance.Brightness(glow)
    glow = enhancer.enhance(1 + intensity)
    return glow


def create_vignette(size, strength):
    vignette = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    center = size // 2
    max_dist = math.sqrt(2) * center
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - center) ** 2 + (y - center) ** 2)
            t = dist / max_dist
            alpha = int(255 * strength * (t ** 2))
            vignette.putpixel((x, y), (0, 0, 0, alpha))
    return vignette


def draw_rounded_rect(draw, bbox, radius, fill):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill)


def draw_stylized_finder(output, x, y, m, color, bg_color):
    """Plain solid white finder pattern — no gradients, no transparency."""
    size = int(7 * m)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    white = (255, 255, 255, 255)
    bg    = (*bg_color, 255)

    # Outer white ring (full 7x7)
    draw.rectangle([0, 0, size - 1, size - 1], fill=white)
    # Dark gap (5x5 inset by 1 module)
    gap = int(m)
    draw.rectangle([gap, gap, size - gap - 1, size - gap - 1], fill=bg)
    # Inner white square (3x3 inset by 2 modules)
    inner = int(2 * m)
    draw.rectangle([inner, inner, size - inner - 1, size - inner - 1], fill=white)

    output.paste(img, (int(x), int(y)), img)


def draw_alignment_pattern(draw, cx, cy, m, color):
    r = m * 0.35
    draw_rounded_rect(draw, [cx - 2.5*m, cy - 2.5*m, cx + 2.5*m, cy + 2.5*m], r, color)
    draw_rounded_rect(draw, [cx - 1.5*m, cy - 1.5*m, cx + 1.5*m, cy + 1.5*m], r, STYLE['bg_color'])
    draw.ellipse([cx - 0.55*m, cy - 0.55*m, cx + 0.55*m, cy + 0.55*m], fill=color)


def create_styled_qr(data, cross_path, logo_path, output_path):
    size = STYLE['size']

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=0)
    qr.add_data(data)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    n = len(matrix)
    version = (n - 17) // 4
    m = size / n
    alignment_pos = get_alignment_positions(version)

    output = Image.new('RGBA', (size, size), STYLE['bg_color'])

    cross = Image.open(cross_path).convert('RGBA').resize((size, size), Image.LANCZOS)

    if STYLE['cross_glow']:
        cross_glow = create_glow_layer(cross, radius=8, intensity=0.2)
        output = Image.alpha_composite(output, cross_glow)

    cross_with_opacity = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cross_with_opacity = Image.blend(cross_with_opacity, cross, STYLE['cross_opacity'])
    output = Image.alpha_composite(output, cross_with_opacity)

    dot_size = int(m * STYLE['dot_scale'] * 2) + 4
    if STYLE['dot_gradient']:
        dot_template = create_gradient_dot(dot_size, STYLE['dot_color'])
    else:
        dot_template = Image.new('RGBA', (dot_size, dot_size), (0, 0, 0, 0))
        d = ImageDraw.Draw(dot_template)
        d.ellipse([0, 0, dot_size-1, dot_size-1], fill=STYLE['dot_color'])

    qr_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(qr_layer)

    dot_r = m * STYLE['dot_scale']

    for row in range(n):
        for col in range(n):
            if is_finder_region(row, col, n):
                continue
            if is_alignment_pattern(row, col, alignment_pos) and not is_bottom_right_alignment(row, col, n, alignment_pos):
                continue

            cx = (col + 0.5) * m
            cy = (row + 0.5) * m

            if matrix[row][col]:
                px = int(cx - dot_size // 2)
                py = int(cy - dot_size // 2)
                qr_layer.paste(dot_template, (px, py), dot_template)
            else:
                small_r = dot_r * 0.6
                draw.ellipse(
                    [cx - small_r, cy - small_r, cx + small_r, cy + small_r],
                    fill=(*STYLE['bg_color'], 160)
                )

    # Finder patterns — pure blazing white
    for (fr, fc) in [(0, 0), (0, n-7), (n-7, 0)]:
        draw_stylized_finder(qr_layer, fc * m, fr * m, m, STYLE['dot_color'], STYLE['bg_color'])

    # Alignment patterns (skip bottom-right for logo)
    for ar, ac in alignment_pos:
        if ar > n - 15 and ac > n - 15:
            continue
        draw_alignment_pattern(draw, (ac + 0.5) * m, (ar + 0.5) * m, m, STYLE['dot_color'])

    if STYLE['dot_glow']:
        glow_layer = create_glow_layer(qr_layer, STYLE['glow_radius'], STYLE['glow_intensity'])
        output = Image.alpha_composite(output, glow_layer)

    output = Image.alpha_composite(output, qr_layer)

    if STYLE['vignette']:
        vignette = create_vignette(size, STYLE['vignette_strength'])
        output = Image.alpha_composite(output, vignette)

    logo = Image.open(logo_path).convert('RGBA')
    logo_size = int(size * STYLE['logo_scale'])
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

    pad = STYLE['logo_padding']
    bg_size = logo_size + 2 * pad

    logo_bg = Image.new('RGBA', (bg_size, bg_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(logo_bg)
    bg_draw.ellipse([0, 0, bg_size - 1, bg_size - 1],
                    fill=(255, 255, 255, STYLE['logo_bg_opacity']))

    if STYLE['logo_shadow']:
        shadow = Image.new('RGBA', (bg_size + 8, bg_size + 8), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.ellipse([4, 4, bg_size + 4, bg_size + 4], fill=(0, 0, 0, 60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=4))
        pos = size - bg_size - int(m * 1.5)
        output.paste(shadow, (pos - 2, pos - 2), shadow)

    pos = size - bg_size - int(m * 1.5)
    output.paste(logo_bg, (pos, pos), logo_bg)
    output.paste(logo, (pos + pad, pos + pad), logo)

    output.convert('RGB').save(output_path, quality=95)


def process_manifest():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(MANIFEST_PATH, 'r') as f:
        reader = csv.reader(f)
        strings = [row[0].strip() for row in reader if row and row[0].strip()]

    if STYLE['vignette']:
        print("Generating vignette...")
        global _vignette_cache
        _vignette_cache = create_vignette(STYLE['size'], STYLE['vignette_strength'])

    total = len(strings)
    for i, data in enumerate(strings, 1):
        if '/' in data:
            suffix = data.split('/')[-1]
        else:
            suffix = data[-8:]
        safe_suffix = "".join(c if c.isalnum() or c in '-_' else '' for c in suffix)
        output_path = f"{OUTPUT_DIR}/tk_{safe_suffix}.png"
        create_styled_qr(data, CROSS_PATH, LOGO_PATH, output_path)
        print(f"[{i}/{total}] {data}")

    print(f"\nDone. {total} QR codes saved to {OUTPUT_DIR}/")


if __name__ == '__main__':
    process_manifest()