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


import urllib.parse


def parse_google_maps_info(gmaps_input, warnet_address=""):
    """Menganalisis dan mengekstrak info Google Maps secara aman (multi-format).

    Mendukung:
    1. HTML Iframe Embed (<iframe src="https://www.google.com/maps/embed?..."></iframe>)
    2. Direct Embed URL (https://www.google.com/maps/embed?...)
    3. Share Link / Shortlink (https://maps.app.goo.gl/... atau https://goo.gl/maps/...)
    4. Regular Maps URL (https://www.google.com/maps/place/...)

    Args:
        gmaps_input (str): Input dari admin/kasir.
        warnet_address (str): Alamat warnet untuk fallback tujuan navigasi.

    Returns:
        dict: {
            "raw": str,
            "embed_url": str | None,
            "nav_url": str | None,
            "is_valid": bool
        }
    """
    if not gmaps_input or not isinstance(gmaps_input, str):
        return {"raw": "", "embed_url": None, "nav_url": None, "is_valid": False}

    raw = gmaps_input.strip()
    if not raw:
        return {"raw": "", "embed_url": None, "nav_url": None, "is_valid": False}

    embed_url = None
    nav_url = None

    def build_direction_url(src_url):
        # Ekstrak koordinat latitude dan longitude dari parameter pb (!3d<lat>!2d<lng>)
        lat_m = re.search(r'!3d(-?\d+(?:\.\d+)?)', src_url)
        lng_m = re.search(r'!2d(-?\d+(?:\.\d+)?)', src_url)
        if lat_m and lng_m:
            return f"https://www.google.com/maps/dir/?api=1&destination={lat_m.group(1)},{lng_m.group(1)}"
        if warnet_address and str(warnet_address).strip():
            return f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(str(warnet_address).strip())}"
        return "https://www.google.com/maps"

    # 1. Cek jika input berupa tag <iframe>
    if "<iframe" in raw.lower():
        match = re.search(r'src=["\']([^"\']+)["\']', raw, re.IGNORECASE)
        if match:
            src_val = match.group(1).strip()
            # Validasi bahwa src adalah Google Maps URL aman
            if src_val.startswith("https://www.google.com/maps/embed") or src_val.startswith("http://www.google.com/maps/embed"):
                embed_url = src_val
                nav_url = build_direction_url(src_val)
            elif ("google.com/maps" in src_val or "maps.google.com" in src_val) and (src_val.startswith("http://") or src_val.startswith("https://")):
                embed_url = src_val
                nav_url = src_val
        else:
            return {"raw": raw, "embed_url": None, "nav_url": None, "is_valid": False}

    # 2. Cek jika input adalah URL embed langsung
    elif raw.startswith("https://www.google.com/maps/embed") or raw.startswith("http://www.google.com/maps/embed"):
        embed_url = raw
        nav_url = build_direction_url(raw)

    # 3. Cek jika input adalah share link / shortlink Google Maps
    elif raw.startswith("https://maps.app.goo.gl/") or raw.startswith("http://maps.app.goo.gl/") or raw.startswith("https://goo.gl/maps/") or raw.startswith("http://goo.gl/maps/"):
        nav_url = raw
        embed_url = None

    # 4. Cek jika input adalah URL Google Maps standar (place / search / dir)
    elif ("google.com/maps" in raw or "maps.google.com" in raw) and (raw.startswith("http://") or raw.startswith("https://")):
        nav_url = raw
        if "output=embed" in raw:
            embed_url = raw
        else:
            embed_url = None

    is_valid = bool(embed_url or nav_url)
    return {
        "raw": raw,
        "embed_url": embed_url,
        "nav_url": nav_url,
        "is_valid": is_valid
    }
