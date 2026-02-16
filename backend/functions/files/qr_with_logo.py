from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import qrcode
import csv
import os
import math

MANIFEST_PATH = '../qr_stickers/manifest.csv'
CROSS_PATH = './coptic_cross.png'
LOGO_PATH = './logo.png'
OUTPUT_DIR = '../qr_with_logo'

# Premium style configuration
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
    'logo_scale': 0.18,             # Was 0.18 — ~44% larger
    'logo_padding': 12,             # Was 12 — more breathing room
    'logo_shadow': True,
    'logo_bg_opacity': 220,         # Was 140 — much more opaque white circle
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
            # Skip if overlapping with any finder pattern (all 3 corners)
            if (r < 9 and c < 9) or (r < 9 and c > n - 9) or (r > n - 9 and c < 9):
                continue
            coords.append((r, c))
    return coords


def is_bottom_right_alignment(row, col, n, positions):
    """Check if this is the bottom-right alignment pattern (we want to skip drawing it)"""
    for ar, ac in positions:
        if ar > n - 15 and ac > n - 15:  # Bottom-right region
            if ar - 2 <= row <= ar + 2 and ac - 2 <= col <= ac + 2:
                return True
    return False


def create_gradient_dot(size, color):
    """Create a dot with radial gradient for 3D effect"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    center = size // 2
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - center) ** 2 + (y - center) ** 2)
            if dist <= center:
                # Gradient from bright center to edge
                t = dist / center
                brightness = 1.0 - (t * 0.3)  # Subtle gradient
                alpha = int(255 * (1 - (t ** 0.5) * 0.15))
                r = min(255, int(color[0] * brightness + 40 * (1 - t)))
                g = min(255, int(color[1] * brightness + 40 * (1 - t)))
                b = min(255, int(color[2] * brightness + 40 * (1 - t)))
                img.putpixel((x, y), (r, g, b, alpha))
    return img


def create_glow_layer(base_img, radius, intensity):
    """Create a glow effect layer"""
    glow = base_img.copy()
    glow = glow.filter(ImageFilter.GaussianBlur(radius=radius))
    enhancer = ImageEnhance.Brightness(glow)
    glow = enhancer.enhance(1 + intensity)
    return glow


def create_vignette(size, strength):
    """Create a vignette overlay"""
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


def create_gradient_rounded_rect(size_w, size_h, radius, color):
    """Create a rounded rectangle with radial gradient for 3D effect"""
    img = Image.new('RGBA', (size_w, size_h), (0, 0, 0, 0))
    center_x, center_y = size_w // 2, size_h // 2
    max_dist = math.sqrt(center_x ** 2 + center_y ** 2)
    
    for y in range(size_h):
        for x in range(size_w):
            # Check if inside rounded rect
            in_rect = False
            # Main body
            if radius <= x <= size_w - radius and 0 <= y <= size_h:
                in_rect = True
            elif radius <= y <= size_h - radius and 0 <= x <= size_w:
                in_rect = True
            # Corners
            elif x < radius and y < radius:
                if (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2:
                    in_rect = True
            elif x >= size_w - radius and y < radius:
                if (x - (size_w - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2:
                    in_rect = True
            elif x < radius and y >= size_h - radius:
                if (x - radius) ** 2 + (y - (size_h - radius)) ** 2 <= radius ** 2:
                    in_rect = True
            elif x >= size_w - radius and y >= size_h - radius:
                if (x - (size_w - radius)) ** 2 + (y - (size_h - radius)) ** 2 <= radius ** 2:
                    in_rect = True
            
            if in_rect:
                dist = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
                t = dist / max_dist
                brightness = 1.0 - (t * 0.3)
                alpha = int(255 * (1 - (t ** 0.5) * 0.15))
                r = min(255, int(color[0] * brightness + 40 * (1 - t)))
                g = min(255, int(color[1] * brightness + 40 * (1 - t)))
                b = min(255, int(color[2] * brightness + 40 * (1 - t)))
                img.putpixel((x, y), (r, g, b, alpha))
    return img


def draw_stylized_finder(output, x, y, m, color, bg_color):
    """Draw a stylized finder pattern with 3D gradient effect - scanner optimized"""
    size = int(7 * m)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Use standard QR finder pattern ratios: 1:1:3:1:1
    # Outer black: 7 modules, white gap: 5 modules, inner black: 3 modules
    
    outer_r = int(m * 0.8)  # Less rounded for better scanning
    inner_r = int(m * 0.6)
    center_r = int(m * 0.5)
    
    center_x, center_y = size // 2, size // 2
    max_dist = math.sqrt(center_x ** 2 + center_y ** 2)
    
    for py in range(size):
        for px in range(size):
            # Determine which zone this pixel is in
            # Convert to module coordinates from center
            mx = px / m - 3.5
            my = py / m - 3.5
            dist_from_center = max(abs(mx), abs(my))  # Chebyshev distance
            
            in_outer = dist_from_center <= 3.5
            in_middle = dist_from_center <= 2.5
            in_center = dist_from_center <= 1.5
            
            # Determine if this should be filled (black/white pattern)
            should_fill = (in_outer and not in_middle) or in_center
            
            if should_fill:
                # Apply 3D gradient
                dist = math.sqrt((px - center_x) ** 2 + (py - center_y) ** 2)
                t = dist / max_dist
                brightness = 1.0 - (t * 0.25)
                alpha = int(255 * (1 - (t ** 0.5) * 0.1))
                r = min(255, int(color[0] * brightness + 30 * (1 - t)))
                g = min(255, int(color[1] * brightness + 30 * (1 - t)))
                b = min(255, int(color[2] * brightness + 30 * (1 - t)))
                img.putpixel((px, py), (r, g, b, alpha))
            elif in_middle and not in_center:
                # Background/gap area
                img.putpixel((px, py), (*bg_color, 255))
    
    output.paste(img, (int(x), int(y)), img)


def draw_alignment_pattern(draw, cx, cy, m, color):
    """Draw premium alignment pattern"""
    r = m * 0.35
    draw_rounded_rect(draw, [cx - 2.5*m, cy - 2.5*m, cx + 2.5*m, cy + 2.5*m], r, color)
    draw_rounded_rect(draw, [cx - 1.5*m, cy - 1.5*m, cx + 1.5*m, cy + 1.5*m], r, STYLE['bg_color'])
    draw.ellipse([cx - 0.55*m, cy - 0.55*m, cx + 0.55*m, cy + 0.55*m], fill=color)


def create_styled_qr(data, cross_path, logo_path, output_path):
    size = STYLE['size']
    
    # Generate QR
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=0)
    qr.add_data(data)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    n = len(matrix)
    version = (n - 17) // 4
    m = size / n
    alignment_pos = get_alignment_positions(version)
    
    # Base layer with background color
    output = Image.new('RGBA', (size, size), STYLE['bg_color'])
    
    # Load and enhance cross
    cross = Image.open(cross_path).convert('RGBA').resize((size, size), Image.LANCZOS)
    
    # Apply cross glow if enabled
    if STYLE['cross_glow']:
        cross_glow = create_glow_layer(cross, radius=8, intensity=0.2)
        output = Image.alpha_composite(output, cross_glow)
    
    # Blend cross with adjusted opacity
    cross_with_opacity = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cross_with_opacity = Image.blend(cross_with_opacity, cross, STYLE['cross_opacity'])
    output = Image.alpha_composite(output, cross_with_opacity)
    
    # Create dot template with gradient
    dot_size = int(m * STYLE['dot_scale'] * 2) + 4
    if STYLE['dot_gradient']:
        dot_template = create_gradient_dot(dot_size, STYLE['dot_color'])
    else:
        dot_template = Image.new('RGBA', (dot_size, dot_size), (0, 0, 0, 0))
        d = ImageDraw.Draw(dot_template)
        d.ellipse([0, 0, dot_size-1, dot_size-1], fill=STYLE['dot_color'])
    
    # QR elements layer
    qr_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(qr_layer)
    
    dot_r = m * STYLE['dot_scale']
    
    # Draw dots (skip finder regions now that we have stylized finders)
    for row in range(n):
        for col in range(n):
            # Skip finder regions
            if is_finder_region(row, col, n):
                continue
            # Skip non-bottom-right alignment patterns only
            if is_alignment_pattern(row, col, alignment_pos) and not is_bottom_right_alignment(row, col, n, alignment_pos):
                continue
            
            cx = (col + 0.5) * m
            cy = (row + 0.5) * m
            
            if matrix[row][col]:
                # Paste gradient dot
                px = int(cx - dot_size // 2)
                py = int(cy - dot_size // 2)
                qr_layer.paste(dot_template, (px, py), dot_template)
            else:
                # Subtle background dot
                small_r = dot_r * 0.6
                draw.ellipse(
                    [cx - small_r, cy - small_r, cx + small_r, cy + small_r],
                    fill=(*STYLE['bg_color'], 160)
                )
    
    # No finder patterns - just dots everywhere
    
    # Draw stylized finder patterns with 3D effect (3 corners only)
    for (fr, fc) in [(0, 0), (0, n-7), (n-7, 0)]:
        draw_stylized_finder(qr_layer, fc * m, fr * m, m, STYLE['dot_color'], STYLE['bg_color'])
    
    # Draw alignment patterns (skip bottom-right one where logo goes)
    for ar, ac in alignment_pos:
        # Skip bottom-right alignment pattern
        if ar > n - 15 and ac > n - 15:
            continue
        draw_alignment_pattern(draw, (ac + 0.5) * m, (ar + 0.5) * m, m, STYLE['dot_color'])
    
    # Apply glow to QR elements
    if STYLE['dot_glow']:
        glow_layer = create_glow_layer(qr_layer, STYLE['glow_radius'], STYLE['glow_intensity'])
        output = Image.alpha_composite(output, glow_layer)
    
    # Composite QR layer
    output = Image.alpha_composite(output, qr_layer)
    
    # Add vignette
    if STYLE['vignette']:
        vignette = create_vignette(size, STYLE['vignette_strength'])
        output = Image.alpha_composite(output, vignette)
    
    # Add logo with circular background
    logo = Image.open(logo_path).convert('RGBA')
    logo_size = int(size * STYLE['logo_scale'])
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    
    pad = STYLE['logo_padding']
    bg_size = logo_size + 2 * pad
    
    # Circular logo background
    logo_bg = Image.new('RGBA', (bg_size, bg_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(logo_bg)
    bg_draw.ellipse([0, 0, bg_size - 1, bg_size - 1], 
                    fill=(255, 255, 255, STYLE['logo_bg_opacity']))
    
    # Shadow for circle
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
    
    # Final output
    output.convert('RGB').save(output_path, quality=95)


def process_manifest():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(MANIFEST_PATH, 'r') as f:
        reader = csv.reader(f)
        strings = [row[0].strip() for row in reader if row and row[0].strip()]
    
    # Pre-generate vignette (expensive operation)
    if STYLE['vignette']:
        print("Generating vignette...")
        global _vignette_cache
        _vignette_cache = create_vignette(STYLE['size'], STYLE['vignette_strength'])
    
    total = len(strings)
    for i, data in enumerate(strings, 1):
        # Extract last segment after final slash/delimiter, or last 8 chars
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