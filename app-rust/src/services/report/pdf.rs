//! PDF laporan sederhana (teks satu kolom, A4) memakai font bawaan PDF.

use printpdf::*;

fn tulis(
    doc: &PdfDocumentReference,
    halaman: (PdfPageIndex, PdfLayerIndex),
    font: &IndirectFontRef,
    teks: &str,
    ukuran: f32,
    y: f32,
) {
    doc.get_page(halaman.0)
        .get_layer(halaman.1)
        .use_text(teks, ukuran, Mm(15.0), Mm(y), font);
}

/// Susun PDF dari baris teks. Kosong bila font bawaan tidak tersedia.
pub fn render(judul: &str, subjudul: &str, baris: &[String]) -> Vec<u8> {
    let (doc, halaman_awal, layer_awal) = PdfDocument::new(judul, Mm(210.0), Mm(297.0), "Layer 1");
    let font = match doc.add_builtin_font(BuiltinFont::Helvetica) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let tebal = doc.add_builtin_font(BuiltinFont::HelveticaBold).ok();

    let mut halaman = (halaman_awal, layer_awal);
    let mut y = 275.0_f32;
    tulis(
        &doc,
        halaman,
        tebal.as_ref().unwrap_or(&font),
        judul,
        14.0,
        y,
    );
    y -= 8.0;
    if !subjudul.is_empty() {
        tulis(&doc, halaman, &font, subjudul, 10.0, y);
        y -= 6.0;
    }
    for b in baris {
        if y < 15.0 {
            halaman = doc.add_page(Mm(210.0), Mm(297.0), "Lanjutan");
            y = 275.0;
        }
        tulis(&doc, halaman, &font, b, 9.0, y);
        y -= 5.0;
    }
    doc.save_to_bytes().unwrap_or_default()
}
