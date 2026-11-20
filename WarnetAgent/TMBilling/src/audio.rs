use rodio::{Decoder, OutputStream, Sink};

pub const WARNING_15MIN: &[u8] = include_bytes!("../assets/sounds/warning_15min.mp3");
pub const WARNING_5MIN: &[u8] = include_bytes!("../assets/sounds/warning_5min.mp3");
pub const WARNING_1MIN: &[u8] = include_bytes!("../assets/sounds/warning_1min.mp3");

/// Fire-and-forget warning chime.
// shortcut: volume sistem tidak dipaksa 100% seperti klien Tauri; upgrade bila kasir melaporkan suara tidak terdengar
pub fn play(bytes: &'static [u8]) {
    std::thread::spawn(move || {
        let Ok((_stream, handle)) = OutputStream::try_default() else {
            return;
        };
        let Ok(sink) = Sink::try_new(&handle) else {
            return;
        };
        if let Ok(source) = Decoder::new(std::io::Cursor::new(bytes)) {
            sink.append(source);
            sink.sleep_until_end();
        }
    });
}
