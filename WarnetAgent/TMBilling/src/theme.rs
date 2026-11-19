use gpui_kit::Rgba;

// Rgba literal so the token table stays a const; gpui::rgb() is not const.
pub const fn c(hex: u32) -> Rgba {
    Rgba {
        r: ((hex >> 16) & 0xFF) as f32 / 255.0,
        g: ((hex >> 8) & 0xFF) as f32 / 255.0,
        b: (hex & 0xFF) as f32 / 255.0,
        a: 1.0,
    }
}

pub struct Tokens {
    pub bg: Rgba,
    pub surface: Rgba,
    pub card: Rgba,
    pub hover: Rgba,
    pub border: Rgba,
    pub border_strong: Rgba,
    pub text: Rgba,
    pub muted: Rgba,
    pub dim: Rgba,
    pub accent: Rgba,
    pub danger: Rgba,
    pub warn: Rgba,
    pub info: Rgba,
    pub radius_sm: f32,
    pub radius_md: f32,
    pub radius_lg: f32,
    pub radius_xl: f32,
}

pub const TM: Tokens = Tokens {
    bg: c(0x050505),
    surface: c(0x0A0A0A),
    card: c(0x0C0C0C),
    hover: c(0x121212),
    border: c(0x1C1C1C),
    border_strong: c(0x2A2A2A),
    text: c(0xE5E5E5),
    muted: c(0xA3A3A3),
    dim: c(0x737373),
    accent: c(0x34D399),
    danger: c(0xF87171),
    warn: c(0xFBBF24),
    info: c(0x60A5FA),
    radius_sm: 4.0,
    radius_md: 6.0,
    radius_lg: 8.0,
    radius_xl: 12.0,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_match_figcraft() {
        assert_eq!(TM.bg, c(0x050505));
        assert_eq!(TM.accent, c(0x34D399));
        assert_eq!(TM.radius_xl, 12.0);
    }
}
