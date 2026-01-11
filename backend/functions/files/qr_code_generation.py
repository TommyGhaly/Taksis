import qrcode
import os
import json
import csv
from nanoid import generate

BATCH_SIZE = 300
OUTPUT_DIR = '../qr_stickers'

def generate_batch():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    manifest = []
    
    for i in range(BATCH_SIZE):
        id = f"tk_{generate(size=8)}"
        
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=20,
            border=1
        )
        qr.add_data(id)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(f"{OUTPUT_DIR}/{id}.png")
        
        manifest.append(id)
        print(f"Generated {i + 1}/{BATCH_SIZE}: {id}")
    
    # save manifest as JSON
    with open(f"{OUTPUT_DIR}/manifest.json", 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # save manifest as CSV
    with open(f"{OUTPUT_DIR}/manifest.csv", 'w', newline='') as f:
        writer = csv.writer(f)
        for id in manifest:
            writer.writerow([id])
    
    print(f"\nDone. {BATCH_SIZE} QR codes in {OUTPUT_DIR}/")
    print(os.path.abspath(OUTPUT_DIR))

if __name__ == "__main__":
    generate_batch()

print("Script starting...")
