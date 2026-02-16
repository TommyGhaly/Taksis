from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pathlib import Path
import os

def create_label_sheets(png_folder, output_folder="../qr_code_pdfs"):
    page_width, page_height = letter  # 612 x 792 pts (8.5" x 11")

    # PLS743 / Avery 22805 layout: 4 cols x 6 rows of 1.5" square labels
    cols, rows = 4, 6
    label_size = 1.5 * 72  # 108 pts

    # Derive spacing from the physical sheet geometry:
    #   Horizontal: 0.5" side margins, remaining space split as 3 gaps
    #   Vertical:   center the grid on the page
    # PLS743 layout
    # Horizontal: center grid on page with tight gaps
    h_gap = 0.3 * 72                                              # 0.5" between columns
    total_labels_w = cols * label_size + (cols - 1) * h_gap      # labels + gaps
    left_margin = (page_width - total_labels_w) / 2              # center horizontally

    # Vertical
    top_margin = 0.5 * 72
    v_gap = 0.2 * 72

    os.makedirs(output_folder, exist_ok=True)
    png_files = sorted(Path(png_folder).glob("*.png"))

    labels_per_page = cols * rows
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

            x = left_margin + col * (label_size + h_gap)
            y = page_height - top_margin - (row + 1) * label_size - row * v_gap

            c.drawImage(str(img_path), x, y, width=label_size, height=label_size)

        c.save()
        print(f"Created {pdf_path}")

    print(f"\nTotal: {num_pages} PDF sheets created with {len(png_files)} labels")

create_label_sheets("../qr_with_logo")