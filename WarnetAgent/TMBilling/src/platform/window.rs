use windows::Win32::Foundation::SYSTEMTIME;
use windows::Win32::System::SystemInformation::GetLocalTime;

/// Jam lokal mesin ini, dipakai baris "Mulai" di kartu overlay.
pub fn local_hhmm() -> String {
    let st: SYSTEMTIME = unsafe { GetLocalTime() };
    format!("{:02}:{:02}", st.wHour, st.wMinute)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OverlayGeometry {
    pub width: f32,
    pub height: f32,
    pub margin: f32,
}

/// Card size measured from the FigCraft overlay exports: 380x268 at 1920,
/// 318x234 for the hand-made compact layout below 1280 wide.
pub fn overlay_geometry(viewport: (f32, f32)) -> OverlayGeometry {
    let (width, height) = if viewport.0 < 1280.0 {
        (318.0, 234.0)
    } else {
        let scale = viewport.0 / 1920.0;
        (380.0 * scale, 268.0 * scale)
    };
    let margin = (8.0 * (width / 380.0)).max(4.0);
    OverlayGeometry { width, height, margin }
}

#[cfg(test)]
mod tests {
    use super::overlay_geometry;

    #[test]
    fn card_is_380_wide_at_1080p() {
        let g = overlay_geometry((1920.0, 1080.0));
        assert_eq!((g.width, g.height), (380.0, 268.0));
    }

    #[test]
    fn card_uses_the_compact_layout_below_1280() {
        let g = overlay_geometry((1024.0, 768.0));
        assert_eq!((g.width, g.height), (318.0, 234.0));
    }

    #[test]
    fn card_scales_down_at_720p() {
        let g = overlay_geometry((1280.0, 720.0));
        assert!(g.width <= 380.0 && g.width > 240.0);
    }

    #[test]
    fn card_never_exceeds_the_viewport() {
        for vp in [(1024.0, 768.0), (1366.0, 768.0), (1920.0, 1080.0), (2560.0, 1440.0), (3840.0, 2160.0)] {
            let g = overlay_geometry(vp);
            assert!(g.width + 2.0 * g.margin <= vp.0);
            assert!(g.height + 2.0 * g.margin <= vp.1);
        }
    }
}
