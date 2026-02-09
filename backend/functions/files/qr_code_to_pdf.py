from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pathlib import Path
import os

def create_label_sheets(png_folder, output_folder="../qr_code_pdfs"):
    # Page and label dimensions (in points: 1 inch = 72 points)
    page_width, page_height = letter  # 8.5" x 11"
    
    # Margins
    top_margin = 0.5 * 72
    bottom_margin = 0.5 * 72
    left_margin = 0.5 * 72
    right_margin = 0.5 * 72
    
    # Label dimensions
    label_size = 1.5 * 72  # 1.5" square
    
    # Gaps
    vertical_gap = 0.25 * 72
    horizontal_gap = 0.5 * 72
    
    # Calculate grid layout
    cols = 4  # 24 labels / 6 rows = 4 columns
    rows = 6
    
    # Create output folder
    os.makedirs(output_folder, exist_ok=True)
    
    # Get all PNG files
    png_files = sorted(Path(png_folder).glob("*.png"))
    
    # Process images in batches of 24
    labels_per_page = 24
    num_pages = (len(png_files) + labels_per_page - 1) // labels_per_page
    
    for page_num in range(num_pages):
        pdf_path = os.path.join(output_folder, f"sheet_{page_num + 1}.pdf")
        c = canvas.Canvas(pdf_path, pagesize=letter)
        
        start_idx = page_num * labels_per_page
        end_idx = min(start_idx + labels_per_page, len(png_files))
        page_images = png_files[start_idx:end_idx]
        
        for idx, img_path in enumerate(page_images):
            row = idx // cols
            col = idx % cols
            
            # Calculate position (from bottom-left of page)
            x = left_margin + col * (label_size + horizontal_gap)
            y = page_height - top_margin - (row + 1) * label_size - row * vertical_gap
            
            # Draw image
            c.drawImage(str(img_path), x, y, width=label_size, height=label_size)
        
        c.save()
        print(f"Created {pdf_path}")
    
    print(f"\nTotal: {num_pages} PDF sheets created with {len(png_files)} labels")

# Usage
create_label_sheets("../qr_with_logo")