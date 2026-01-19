import qrcode
import os
import json
import csv
from nanoid import generate

BATCH_SIZE = 500
OUTPUT_DIR = '../qr_stickers'

def generate_batch():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    manifest = []
    
    for i in range(BATCH_SIZE):
        id = f"spsm_church_parking_management_{generate(size=8)}"
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
