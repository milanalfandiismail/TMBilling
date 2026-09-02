# app/utils/helpers.py

"""Fungsi utilitas umum untuk aplikasi TMBilling.

Module ini berisi fungsi-fungsi pembantu yang digunakan di berbagai
bagian aplikasi, termasuk validasi dan formatting nominal/durasi.
"""

import re


def validate_ip(ip):
    """Memvalidasi format alamat IP (IPv4).
    
    Args:
        ip (str): String alamat IP yang akan divalidasi.
        
    Returns:
        bool: True jika format valid atau ip kosong/None, False jika format salah.
        
    Example:
        >>> validate_ip("192.168.1.1")
        True
        >>> validate_ip("999.999.999.999")
        True  # Hanya cek format, bukan range
        >>> validate_ip("abc")
        False
    """
    if not ip:
        return True
    return re.match(r'^(\d{1,3}\.){3}\d{1,3}$', ip) is not None


def format_duration(menit):
    """Memformat durasi menit ke format yang mudah dibaca.
    
    Args:
        menit (int): Jumlah menit yang akan diformat.
        
    Returns:
        str: String durasi yang sudah diformat.
        
    Example:
        >>> format_duration(0)
        'Habis'
        >>> format_duration(45)
        '45 Menit'
        >>> format_duration(120)
        '2 Jam'
        >>> format_duration(150)
        '2 Jam 30M'
    """
    if menit <= 0:
        return "Habis"
    
    jam = menit // 60
    sisa = menit % 60
    
    if jam == 0:
        return f"{sisa} Menit"
    elif sisa == 0:
        return f"{jam} Jam"
    else:
        return f"{jam} Jam {sisa}M"


def format_rupiah(nominal):
    """Memformat angka nominal ke format Rupiah Indonesia.

    Args:
        nominal (int): Nominal dalam satuan Rupiah.

    Returns:
        str: String dengan format 'Rp10.000' (standar EYD/PUEBI tanpa spasi).
    """
    if nominal is None:
        nominal = 0
    formatted = f"{int(nominal):,}".replace(",", ".")
    return f"Rp{formatted}"


from html.parser import HTMLParser


class SafeHTMLParser(HTMLParser):
    """Parser untuk memfilter HTML dan mencegah XSS."""
    ALLOWED_TAGS = {
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'a', 'span', 'div', 'hr',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'img', 'figure', 'figcaption'
    }

    ALLOWED_ATTRS = {
        'a': {'href', 'target', 'rel', 'title', 'class'},
        'img': {'src', 'alt', 'title', 'width', 'height', 'class', 'style'},
        '*': {'class', 'style', 'id', 'align'}
    }

    DISALLOWED_PROTOCOLS = ('javascript:', 'data:text/html', 'vbscript:')
    DANGEROUS_TAGS = {'script', 'style', 'iframe', 'embed', 'object', 'applet', 'form', 'input', 'button', 'select', 'textarea'}

    def __init__(self):
        super().__init__()
        self.result = []
        self.in_dangerous_tag = False

    def handle_starttag(self, tag, attrs):
        tag_lower = tag.lower()
        if tag_lower in self.DANGEROUS_TAGS:
            self.in_dangerous_tag = True
            return
        if self.in_dangerous_tag:
            return
        if tag_lower in self.ALLOWED_TAGS:
            cleaned_attrs = []
            for attr_name, attr_val in attrs:
                attr_name_lower = attr_name.lower()
                if attr_name_lower.startswith('on'):
                    continue
                tag_allowed = self.ALLOWED_ATTRS.get(tag_lower, set()) | self.ALLOWED_ATTRS.get('*', set())
                if attr_name_lower in tag_allowed:
                    if attr_name_lower in ('href', 'src'):
                        attr_val_clean = (attr_val or '').strip().lower()
                        if any(attr_val_clean.startswith(proto) for proto in self.DISALLOWED_PROTOCOLS):
                            continue
                    if attr_name_lower == 'style':
                        style_clean = (attr_val or '').lower()
                        if any(danger in style_clean for danger in ('expression', 'behavior', 'javascript:', '-moz-binding', 'url(')):
                            continue
                    cleaned_attrs.append((attr_name, attr_val))

            attrs_str = "".join(f' {k}="{v}"' for k, v in cleaned_attrs) if cleaned_attrs else ""
            if tag_lower in ('br', 'hr', 'img'):
                self.result.append(f"<{tag_lower}{attrs_str} />")
            else:
                self.result.append(f"<{tag_lower}{attrs_str}>")

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in self.DANGEROUS_TAGS:
            self.in_dangerous_tag = False
            return
        if self.in_dangerous_tag:
            return
        if tag_lower in self.ALLOWED_TAGS and tag_lower not in ('br', 'hr', 'img'):
            self.result.append(f"</{tag_lower}>")

    def handle_data(self, data):
        if not self.in_dangerous_tag:
            self.result.append(data)

    def handle_entityref(self, name):
        if not self.in_dangerous_tag:
            self.result.append(f"&{name};")

    def handle_charref(self, name):
        if not self.in_dangerous_tag:
            self.result.append(f"&#{name};")


def sanitize_html(html_content):
    """Membersihkan string HTML dari tag dan atribut berbahaya (XSS Protection)."""
    if not html_content or not isinstance(html_content, str):
        return "" if html_content is None else str(html_content)

    if "<" not in html_content and ">" not in html_content:
        return html_content

    parser = SafeHTMLParser()
    parser.feed(html_content)
    return "".join(parser.result)