from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from pathlib import Path
from pypdf import PdfReader, PdfWriter
import io, os

def create_label_sheets(png_folder, template_pdf, output_folder="../qr_code_pdfs"):
    page_width, page_height = letter  # 612 x 792 pts

    # Each QR drawn slightly smaller than 1.5" so border shows
    draw_size = 1.44 * 72  # 103.7 pts

    # Center point of each of the 24 labels in pts (x from left, y from BOTTOM)
    # Page is 612 x 792 pts. Rows top-to-bottom, cols left-to-right.
    centers = [
        # Row 1 (top)
        (110.15, 702), (240.75, 702), (371.3, 702), (501.8, 702),
        # Row 2
        (110.15, 579.7), (240.75, 579.7), (371.3, 579.7), (501.8, 579.7),
        # Row 3
        (110.15, 457.25), (240.75, 457.25), (371.3, 457.25), (501.8, 457.25),
        # Row 4
        (110.15, 334.9), (240.75, 334.9), (371.3, 334.9), (501.8, 334.9),
        # Row 5
        (110.15, 212.4), (240.75, 212.4), (371.3, 212.4), (501.8, 212.4),
        # Row 6 (bottom)
        (110.15,  90), (240.75,  90), (371.3,  90), (501.8,  90),
    ]

    os.makedirs(output_folder, exist_ok=True)
    png_files = sorted(Path(png_folder).glob("*.png"))

    labels_per_page = 24
    num_pages = (len(png_files) + labels_per_page - 1) // labels_per_page

    for page_num in range(num_pages):
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)

        page_images = png_files[page_num * labels_per_page:(page_num + 1) * labels_per_page]

        for idx, img_path in enumerate(page_images):
            cx, cy = centers[idx]
            # Draw centered on (cx, cy)
            c.drawImage(str(img_path),
                        cx - draw_size / 2,
                        cy - draw_size / 2,
                        width=draw_size,
                        height=draw_size)

        c.save()
        buf.seek(0)

        writer = PdfWriter()
        bg = PdfReader(template_pdf).pages[0]
        bg.merge_page(PdfReader(buf).pages[0])
        writer.add_page(bg)

        pdf_path = os.path.join(output_folder, f"sheet_{page_num + 1}.pdf")
        with open(pdf_path, "wb") as f:
            writer.write(f)
        print(f"Created {pdf_path}")

    print(f"\nDone: {num_pages} sheets, {len(png_files)} labels")

create_label_sheets(
    png_folder="../qr_with_logo",
    template_pdf="PLS743-1.5x1.5.pdf"
)