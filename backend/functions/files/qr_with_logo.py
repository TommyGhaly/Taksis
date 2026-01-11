from PIL import Image
import os

QR_DIR = '../qr_stickers'
LOGO_PATH = './logo.png'
OUTPUT_DIR = '../qr_with_logo'

def overlay_qr_on_logo():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    logo = Image.open(LOGO_PATH).convert("RGBA")
    
    for filename in os.listdir(QR_DIR):
        if not filename.endswith('.png'):
            continue
        
        qr = Image.open(f"{QR_DIR}/{filename}").convert("RGBA")
        qr = qr.resize(logo.size, Image.LANCZOS)
        
        # make white pixels transparent, keep black QR modules
        pixels = qr.getdata()
        new_pixels = []
        for p in pixels:
            if p[0] > 200 and p[1] > 200 and p[2] > 200:  # white
                new_pixels.append((255, 255, 255, 0))  # transparent
            else:  # black QR modules
                new_pixels.append((0, 0, 0, 255))  # solid black
        
        qr.putdata(new_pixels)
        
        # composite: logo as base, QR on top
        combined = Image.alpha_composite(logo.copy(), qr)
        combined.save(f"{OUTPUT_DIR}/{filename}")
        
        print(f"Processed {filename}")
    
    print(f"\nDone. Check {OUTPUT_DIR}/")

overlay_qr_on_logo()