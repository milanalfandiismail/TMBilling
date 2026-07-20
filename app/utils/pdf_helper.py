import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm

class PdfHelper:
    """Helper class untuk pembuatan PDF menggunakan ReportLab."""

    @staticmethod
    def create_document_and_buffer(margin_left=1.0, margin_right=1.0, margin_top=1.2, margin_bottom=1.2):
        """Membuat buffer dan instance SimpleDocTemplate."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=margin_right * cm,
            leftMargin=margin_left * cm,
            topMargin=margin_top * cm,
            bottomMargin=margin_bottom * cm
        )
        return doc, buffer

    @staticmethod
    def get_common_styles(base_font_size=8, title_font_size=16):
        """Mengembalikan dictionary berisi style umum yang digunakan untuk laporan."""
        styles = getSampleStyleSheet()
        
        custom_styles = {
            "title": ParagraphStyle(
                name="TitleStyle",
                parent=styles["Heading1"],
                fontName="Helvetica-Bold",
                fontSize=title_font_size,
                textColor=colors.HexColor("#1F2937"),
                alignment=1, # Center
                spaceAfter=6
            ),
            "subtitle": ParagraphStyle(
                name="SubTitleStyle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=10,
                textColor=colors.HexColor("#4B5563"),
                alignment=1, # Center
                spaceAfter=15
            ),
            "section": ParagraphStyle(
                name="SectionStyle",
                parent=styles["Heading3"],
                fontName="Helvetica-Bold",
                fontSize=12,
                textColor=colors.HexColor("#1F2937"),
                spaceBefore=10,
                spaceAfter=6
            ),
            "meta": ParagraphStyle(
                name="MetaStyle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=10,
                textColor=colors.HexColor("#1F2937")
            ),
            "table_header": ParagraphStyle(
                name="TableHeaderStyle",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=base_font_size,
                textColor=colors.white,
                alignment=1 # Center
            ),
            "table_cell": ParagraphStyle(
                name="TableCellStyle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=base_font_size,
                textColor=colors.HexColor("#374151")
            ),
            "table_cell_center": ParagraphStyle(
                name="TableCellCenterStyle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=base_font_size,
                textColor=colors.HexColor("#374151"),
                alignment=1 # Center
            ),
            "table_cell_right": ParagraphStyle(
                name="TableCellRightStyle",
                parent=styles["Normal"],
                fontName="Helvetica",
                fontSize=base_font_size,
                textColor=colors.HexColor("#374151"),
                alignment=2 # Right
            ),
            "total": ParagraphStyle(
                name="TotalStyle",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=base_font_size + 1,
                textColor=colors.HexColor("#1F2937"),
                alignment=2 # Right
            )
        }
        return custom_styles

    @staticmethod
    def get_warnet_header_elements(styles):
        """Mengembalikan elemen-elemen kop surat untuk laporan."""
        from app.repositories import SettingsRepository
        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        return [
            Paragraph(warnet_title, styles["title"]),
            Paragraph(f"{warnet_address} | Telp: {warnet_phone}", styles["subtitle"]),
            Spacer(1, 0.4*cm)
        ]

    @staticmethod
    def get_meta_table(tanggal, kasir_id, styles, col_widths=None):
        """Membuat tabel metadata (Tanggal, Kasir, Waktu Cetak)."""
        if col_widths is None:
            col_widths = [9.5*cm, 9.5*cm]
            
        nama_kasir = "Semua Kasir"
        if kasir_id:
            from app.repositories import UserRepository
            u = UserRepository.get_by_id(kasir_id)
            if u:
                nama_kasir = u.nama_lengkap or u.username

        meta_data = [
            [Paragraph(f"<b>Tanggal Laporan:</b> {tanggal}", styles["meta"]), Paragraph(f"<b>Kasir:</b> {nama_kasir}", styles["meta"])],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["meta"]), Paragraph("", styles["meta"])]
        ]
        meta_table = Table(meta_data, colWidths=col_widths)
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        return meta_table, nama_kasir

    @staticmethod
    def apply_standard_table_style(table, table_data, padding=5):
        """Mengaplikasikan style standar ke objek Table ReportLab."""
        t_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#374151")),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
            ('TOPPADDING', (0,0), (-1,-1), padding),
            ('BOTTOMPADDING', (0,0), (-1,-1), padding),
        ])
        
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                t_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#F9FAFB"))
                
        table.setStyle(t_style)
