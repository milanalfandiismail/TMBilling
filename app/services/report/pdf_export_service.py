# app/services/report/pdf_export_service.py

"""Service khusus ekspor PDF laporan billing, laba rugi, kantin, dan audit log.

Modul ini memisahkan logika pembuatan dokumen PDF berbasis ReportLab
agar ReportService tetap ringan dan terfokus pada data aggregation.
"""

import io
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.repositories import SettingsRepository
from app.utils.pdf_helper import PdfHelper


class PdfExportService:
    """Service untuk ekspor laporan ke format dokumen PDF."""

    @staticmethod
    def export_billing_pdf(data):
        """Mengekspor laporan billing harian ke PDF."""
        tanggal = data["tanggal"]
        kasir_id = data.get("kasir_id")

        doc, buffer = PdfHelper.create_document_and_buffer(margin_left=1.0, margin_right=1.0)
        styles = PdfHelper.get_common_styles(base_font_size=8)

        story = []
        story.extend(PdfHelper.get_warnet_header_elements(styles))
        story.append(Paragraph("LAPORAN OMZET BILLING", styles["section"]))
        story.append(Spacer(1, 0.2 * cm))

        meta_table, nama_kasir = PdfHelper.get_meta_table(tanggal, kasir_id, styles, col_widths=[9.5 * cm, 9.5 * cm])
        story.append(meta_table)
        story.append(Spacer(1, 0.5 * cm))

        history_struk = data.get("history_struk", [])

        headers = [
            Paragraph("No", styles["table_header"]),
            Paragraph("Waktu", styles["table_header"]),
            Paragraph("No. Nota", styles["table_header"]),
            Paragraph("Pelanggan", styles["table_header"]),
            Paragraph("PC", styles["table_header"]),
            Paragraph("Keterangan", styles["table_header"]),
            Paragraph("Metode", styles["table_header"]),
            Paragraph("Jumlah", styles["table_header"])
        ]

        table_data = [headers]

        for idx, t in enumerate(history_struk, 1):
            waktu = t.get("waktu", "-")
            no_nota = t.get("no_nota", "-")
            nama_p = t.get("nama_pelanggan", "-")
            pc = t.get("pc_kode", "-")
            ket = t.get("keterangan", "-")
            metode = t.get("metode_pembayaran", "Tunai") or "Tunai"
            jumlah_raw = t.get("jumlah", 0)
            jumlah = f"Rp {jumlah_raw:,.0f}"

            row = [
                Paragraph(str(idx), styles["table_cell_center"]),
                Paragraph(waktu, styles["table_cell_center"]),
                Paragraph(no_nota, styles["table_cell_center"]),
                Paragraph(nama_p, styles["table_cell"]),
                Paragraph(pc, styles["table_cell_center"]),
                Paragraph(ket, styles["table_cell"]),
                Paragraph(metode, styles["table_cell_center"]),
                Paragraph(jumlah, styles["table_cell_right"])
            ]
            table_data.append(row)

        col_widths = [0.8 * cm, 2.5 * cm, 2.3 * cm, 3.2 * cm, 1.0 * cm, 4.5 * cm, 2.2 * cm, 2.5 * cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        PdfHelper.apply_standard_table_style(data_table, table_data)
        story.append(data_table)
        story.append(Spacer(1, 0.4 * cm))

        total_omzet_raw = data.get("total_pendapatan_billing", 0)
        total_omzet = f"Rp {total_omzet_raw:,.0f}"

        total_data = [
            ["", "", Paragraph("<b>TOTAL OMZET BILLING:</b>", styles["total"]), Paragraph(total_omzet, styles["total"])]
        ]
        total_col_widths = [1.0 * cm, 9.7 * cm, 5.5 * cm, 2.8 * cm]
        total_table = Table(total_data, colWidths=total_col_widths)
        total_table.setStyle(TableStyle([
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (2, 0), (3, 0), 1, colors.HexColor("#1F2937")),
            ('BACKGROUND', (2, 0), (3, 0), colors.HexColor("#F3F4F6")),
        ]))
        story.append(total_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()

        filename = f"Laporan_Billing_{tanggal}_{nama_kasir.replace(' ', '_')}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_pnl_pdf(data):
        """Mengekspor laporan Laba Rugi (P&L) harian ke PDF."""
        tanggal = data["tanggal"]

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2.0 * cm,
            leftMargin=2.0 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm
        )

        styles = getSampleStyleSheet()

        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1,
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1,
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=colors.white,
            alignment=1
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_bold = ParagraphStyle(
            name="TableCellBoldStyle",
            parent=style_table_cell,
            fontName="Helvetica-Bold"
        )
        style_table_cell_right = ParagraphStyle(
            name="TableCellRightStyle",
            parent=style_table_cell,
            alignment=2
        )
        style_table_cell_right_bold = ParagraphStyle(
            name="TableCellRightBoldStyle",
            parent=style_table_cell_bold,
            alignment=2
        )
        style_table_cell_profit = ParagraphStyle(
            name="TableCellProfitStyle",
            parent=style_table_cell_bold,
            textColor=colors.HexColor("#047857")
        )
        style_table_cell_profit_right = ParagraphStyle(
            name="TableCellProfitRightStyle",
            parent=style_table_cell_profit,
            alignment=2
        )

        story = []
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.5 * cm))

        story.append(Paragraph("LAPORAN LABA RUGI (PROFIT & LOSS)", style_section))
        story.append(Spacer(1, 0.2 * cm))

        meta_data = [
            [Paragraph(f"<b>Tanggal Laporan:</b> {tanggal}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[17.0 * cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.6 * cm))

        billing_rev = int(data.get("total_pendapatan_billing_gross", 0))
        canteen_rev = int(data.get("total_pendapatan_menu", 0))
        total_rev = billing_rev + canteen_rev
        refund_val = int(data.get("total_refund", 0))
        net_profit = total_rev - refund_val

        table_data = [
            [Paragraph("Deskripsi", style_table_header), Paragraph("Rincian", style_table_header), Paragraph("Total", style_table_header)],
            [Paragraph("<b>1. PENDAPATAN (INFLOW)</b>", style_table_cell_bold), "", ""],
            [Paragraph("   Pendapatan Billing", style_table_cell), Paragraph(f"Rp {billing_rev:,.0f}", style_table_cell_right), ""],
            [Paragraph("   Pendapatan Kantin / F&B", style_table_cell), Paragraph(f"Rp {canteen_rev:,.0f}", style_table_cell_right), ""],
            [Paragraph("<b>Total Pendapatan</b>", style_table_cell_bold), "", Paragraph(f"Rp {total_rev:,.0f}", style_table_cell_right_bold)],
            [Paragraph("<b>2. PENGURANG / REFUND (OUTFLOW)</b>", style_table_cell_bold), "", ""],
            [Paragraph("   Total Refund / Pembatalan Sesi", style_table_cell), Paragraph(f"Rp {refund_val:,.0f}", style_table_cell_right), ""],
            [Paragraph("<b>Total Pengurangan</b>", style_table_cell_bold), "", Paragraph(f"Rp {refund_val:,.0f}", style_table_cell_right_bold)],
            [Paragraph("<b>LABA / RUGI BERSIH (NET PROFIT)</b>", style_table_cell_profit), "", Paragraph(f"Rp {net_profit:,.0f}", style_table_cell_profit_right)]
        ]

        col_widths = [9.0 * cm, 4.0 * cm, 4.0 * cm]
        pnl_table = Table(table_data, colWidths=col_widths)

        t_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1F2937")),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('SPAN', (0, 1), (2, 1)),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F3F4F6")),
            ('SPAN', (0, 5), (2, 5)),
            ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor("#F3F4F6")),
            ('SPAN', (0, 4), (1, 4)),
            ('SPAN', (0, 7), (1, 7)),
            ('SPAN', (0, 8), (1, 8)),
            ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor("#D1FAE5")),
            ('LINEABOVE', (0, 8), (-1, 8), 1.5, colors.HexColor("#047857")),
            ('LINEBELOW', (0, 8), (-1, 8), 1.5, colors.HexColor("#047857")),
        ])

        pnl_table.setStyle(t_style)
        story.append(pnl_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()

        filename = f"Laporan_PnL_{tanggal}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_kantin_pdf(data, kasir_id=None):
        """Mengekspor laporan omzet kantin ke PDF."""
        tanggal = data["tanggal"]

        doc, buffer = PdfHelper.create_document_and_buffer(margin_left=1.5, margin_right=1.5, margin_top=1.5, margin_bottom=1.5)
        styles = PdfHelper.get_common_styles(base_font_size=9)

        story = []
        story.extend(PdfHelper.get_warnet_header_elements(styles))

        story.append(Paragraph("LAPORAN OMZET KANTIN / F&B", styles["section"]))
        story.append(Spacer(1, 0.2 * cm))

        meta_table, nama_kasir = PdfHelper.get_meta_table(tanggal, kasir_id, styles, col_widths=[9 * cm, 9 * cm])
        story.append(meta_table)
        story.append(Spacer(1, 0.6 * cm))

        history_menu = data.get("history_menu", [])

        headers = [
            Paragraph("Waktu", styles["table_header"]),
            Paragraph("No. Nota", styles["table_header"]),
            Paragraph("Item Menu", styles["table_header"]),
            Paragraph("Qty", styles["table_header"]),
            Paragraph("Total Harga", styles["table_header"]),
            Paragraph("Metode", styles["table_header"]),
            Paragraph("Pemesanan", styles["table_header"]),
            Paragraph("Kasir", styles["table_header"])
        ]

        table_data = [headers]

        for idx, tm in enumerate(history_menu, 1):
            waktu = tm.get("waktu", "-")
            no_nota = tm.get("no_nota", "-")
            menu_nama = tm.get("menu_nama", "-")
            jumlah = str(tm.get("jumlah", 0))

            total_harga_raw = tm.get("total_harga", 0)
            total_harga = f"Rp {total_harga_raw:,.0f}"

            metode = tm.get("metode_pembayaran", "Tunai") or "Tunai"
            pc_kode = tm.get("pc_kode", "-")
            pemesanan = "Take Away" if pc_kode != "Tempat" else "Makan di Tempat"
            kasir_nama = tm.get("kasir_nama", "-")

            row = [
                Paragraph(waktu, styles["table_cell_center"]),
                Paragraph(no_nota, styles["table_cell_center"]),
                Paragraph(menu_nama, styles["table_cell"]),
                Paragraph(jumlah, styles["table_cell_center"]),
                Paragraph(total_harga, styles["table_cell_right"]),
                Paragraph(metode, styles["table_cell_center"]),
                Paragraph(pemesanan, styles["table_cell_center"]),
                Paragraph(kasir_nama, styles["table_cell_center"])
            ]
            table_data.append(row)

        col_widths = [2.5 * cm, 2.3 * cm, 3.5 * cm, 0.8 * cm, 2.5 * cm, 2.2 * cm, 2.5 * cm, 1.7 * cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        PdfHelper.apply_standard_table_style(data_table, table_data, padding=6)
        story.append(data_table)
        story.append(Spacer(1, 0.4 * cm))

        total_omzet_raw = data.get("total_pendapatan_menu", 0)
        total_omzet = f"Rp {total_omzet_raw:,.0f}"

        total_data = [
            ["", "", "", Paragraph("<b>TOTAL OMZET KANTIN:</b>", styles["total"]), Paragraph(total_omzet, styles["total"])]
        ]
        total_col_widths = [2.7 * cm, 2.5 * cm, 4.0 * cm, 3.8 * cm, 5.0 * cm]
        total_table = Table(total_data, colWidths=total_col_widths)
        total_table.setStyle(TableStyle([
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (3, 0), (4, 0), 1, colors.HexColor("#1F2937")),
            ('BACKGROUND', (3, 0), (4, 0), colors.HexColor("#F3F4F6")),
        ]))
        story.append(total_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()

        filename = f"Laporan_Kantin_{tanggal}_{nama_kasir.replace(' ', '_')}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_audit_pdf(logs, filter_text=""):
        """Mengekspor audit log / system logs ke PDF terstruktur."""
        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.0 * cm,
            leftMargin=1.0 * cm,
            topMargin=1.2 * cm,
            bottomMargin=1.2 * cm
        )

        styles = getSampleStyleSheet()

        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1,
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1,
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=colors.white,
            alignment=1
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_center = ParagraphStyle(
            name="TableCellCenterStyle",
            parent=style_table_cell,
            alignment=1
        )

        story = []
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.4 * cm))

        story.append(Paragraph("AUDIT LOG / AKTIVITAS SISTEM", style_section))
        story.append(Spacer(1, 0.2 * cm))

        meta_data = [
            [Paragraph(f"<b>Filter Pencarian:</b> {filter_text or 'Semua Logs'}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[19.0 * cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.5 * cm))

        headers = [
            Paragraph("Timestamp", style_table_header),
            Paragraph("User", style_table_header),
            Paragraph("Kategori", style_table_header),
            Paragraph("Aksi / Event", style_table_header),
            Paragraph("Detail", style_table_header)
        ]

        table_data = [headers]

        for log in logs:
            import json
            detail_str = log.get("detail", "")

            ip = log.get("ip_address", "-")
            if ip and ip != "-":
                detail_str += f"<br/><b>IP:</b> {ip}"

            agent = log.get("browser_agent", "-")
            if agent and agent != "-":
                agent_short = agent[:50] + ("..." if len(agent) > 50 else "")
                detail_str += f"<br/><b>Agent:</b> {agent_short}"

            det_json = log.get("detail_json")
            if det_json:
                try:
                    import json
                    if isinstance(det_json, str):
                        try:
                            data = json.loads(det_json)
                        except Exception:
                            data = det_json
                    else:
                        data = det_json

                    def format_val(k, v):
                        if v is None:
                            return "-"
                        kl = k.lower()
                        if any(x in kl for x in ["jumlah", "harga", "amount", "modal", "total", "saldo"]):
                            try:
                                return f"Rp {int(v):,}".replace(",", ".")
                            except ValueError:
                                try:
                                    return f"Rp {float(v):,}".replace(",", ".")
                                except Exception:
                                    return str(v)
                        if any(x in kl for x in ["durasi", "menit"]):
                            try:
                                return f"{int(v)} Menit"
                            except Exception:
                                return f"{v} Menit"
                        return str(v)

                    def format_key(k):
                        parts = k.replace("_", " ").split()
                        return " ".join([p.capitalize() for p in parts])

                    html_lines = []
                    act = log.get("action", "").upper()

                    if isinstance(data, dict):
                        if "REFUND" in act:
                            order = [
                                ("no_nota_refund", "No. Nota Refund"),
                                ("no_nota_original", "No. Nota Asal"),
                                ("jumlah_refund", "Jumlah Refund"),
                                ("saldo_sebelum", "Saldo/Durasi Sebelum"),
                                ("saldo_sesudah", "Saldo/Durasi Sesudah"),
                                ("durasi_beli_sebelum", "Durasi Sebelum"),
                                ("durasi_beli_sesudah", "Durasi Sesudah"),
                                ("durasi_dikurangi", "Durasi Dikurangi"),
                                ("username", "Username Member"),
                                ("nama_guest", "Nama Guest")
                            ]
                            for key_id, label in order:
                                if key_id in data and data[key_id] is not None:
                                    html_lines.append(f"<b>{label}:</b> {format_val(key_id, data[key_id])}")
                            for k, v in data.items():
                                if not any(x[0] == k for x in order):
                                    html_lines.append(f"<b>{format_key(k)}:</b> {format_val(k, v)}")
                        elif "DELETE_STRUK" in act:
                            order = [
                                ("no_nota", "No. Nota"),
                                ("jenis", "Jenis Transaksi"),
                                ("jumlah", "Jumlah / Nominal"),
                                ("tanggal", "Tanggal Transaksi"),
                                ("keterangan", "Keterangan")
                            ]
                            for key_id, label in order:
                                if key_id in data and data[key_id] is not None:
                                    html_lines.append(f"<b>{label}:</b> {format_val(key_id, data[key_id])}")
                            for k, v in data.items():
                                if not any(x[0] == k for x in order):
                                    html_lines.append(f"<b>{format_key(k)}:</b> {format_val(k, v)}")
                        elif "EDIT_PAKET" in act:
                            for k, v in data.items():
                                label = format_key(k)
                                if isinstance(v, dict) and "old" in v and "new" in v:
                                    old_v = format_val(k, v["old"])
                                    new_v = format_val(k, v["new"])
                                    html_lines.append(f"<b>{label}:</b> {old_v} &rarr; {new_v}")
                                else:
                                    html_lines.append(f"<b>{label}:</b> {format_val(k, v)}")
                        else:
                            for k, v in data.items():
                                label = format_key(k)
                                if isinstance(v, dict):
                                    html_lines.append(f"<b>{label}:</b>")
                                    for sub_k, sub_v in v.items():
                                        html_lines.append(f"&nbsp;&nbsp;&nbsp;&nbsp;&bull; {format_key(sub_k)}: {format_val(sub_k, sub_v)}")
                                elif isinstance(v, list):
                                    items_str = ", ".join([str(item) for item in v])
                                    html_lines.append(f"<b>{label}:</b> {items_str}")
                                else:
                                    html_lines.append(f"<b>{label}:</b> {format_val(k, v)}")
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                sub_lines = []
                                for k, v in item.items():
                                    sub_lines.append(f"{format_key(k)}: {format_val(k, v)}")
                                html_lines.append("&bull; " + ", ".join(sub_lines))
                            else:
                                html_lines.append(f"&bull; {item}")
                    else:
                        html_lines.append(str(data))

                    if html_lines:
                        detail_str += "<br/><b>Data:</b><br/>" + "<br/>".join(html_lines)
                except Exception:
                    detail_str += f"<br/><b>Data (Raw):</b> {str(det_json)}"

            row = [
                Paragraph(log.get("timestamp", ""), style_table_cell_center),
                Paragraph(log.get("user", ""), style_table_cell_center),
                Paragraph(log.get("category", ""), style_table_cell_center),
                Paragraph(log.get("action", ""), style_table_cell_center),
                Paragraph(detail_str, style_table_cell)
            ]
            table_data.append(row)

        col_widths = [3.2 * cm, 1.8 * cm, 1.8 * cm, 3.2 * cm, 9.0 * cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)

        t_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#374151")),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ])

        for i in range(1, len(table_data)):
            if i % 2 == 0:
                t_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#F9FAFB"))

        data_table.setStyle(t_style)
        story.append(data_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"Audit_Log_{timestamp}.pdf"
        return pdf_bytes, filename
