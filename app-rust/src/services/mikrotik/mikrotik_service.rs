//! Klien protokol RouterOS API (socket murni) + sinkronisasi member hotspot.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

pub struct Client {
    host: String,
    port: u16,
    username: String,
    password: String,
    sock: Option<TcpStream>,
}

fn encode_len(len: usize) -> Vec<u8> {
    if len < 0x80 {
        vec![len as u8]
    } else if len < 0x4000 {
        let l = len | 0x8000;
        vec![(l >> 8) as u8, l as u8]
    } else if len < 0x20_0000 {
        let l = len | 0xC0_0000;
        vec![(l >> 16) as u8, (l >> 8) as u8, l as u8]
    } else {
        let l = len | 0xE000_0000;
        vec![(l >> 24) as u8, (l >> 16) as u8, (l >> 8) as u8, l as u8]
    }
}

impl Client {
    pub fn new(host: &str, username: &str, password: &str, port: u16) -> Self {
        Self {
            host: host.to_string(),
            port,
            username: username.to_string(),
            password: password.to_string(),
            sock: None,
        }
    }

    fn write_word(sock: &mut TcpStream, word: &str) -> std::io::Result<()> {
        let b = word.as_bytes();
        sock.write_all(&encode_len(b.len()))?;
        sock.write_all(b)
    }

    fn read_len(sock: &mut TcpStream) -> std::io::Result<usize> {
        let mut c = [0u8; 1];
        sock.read_exact(&mut c)?;
        let c = c[0];
        if c & 0x80 == 0 {
            return Ok(c as usize);
        }
        let mut b1 = [0u8; 1];
        if c & 0xC0 == 0x80 {
            sock.read_exact(&mut b1)?;
            return Ok((((c & 0x3F) as usize) << 8) | b1[0] as usize);
        }
        let mut rest = [0u8; 2];
        if c & 0xE0 == 0xC0 {
            sock.read_exact(&mut rest)?;
            return Ok((((c & 0x1F) as usize) << 16)
                | ((rest[0] as usize) << 8)
                | rest[1] as usize);
        }
        let mut rest3 = [0u8; 3];
        sock.read_exact(&mut rest3)?;
        Ok((((c & 0x0F) as usize) << 24)
            | ((rest3[0] as usize) << 16)
            | ((rest3[1] as usize) << 8)
            | rest3[2] as usize)
    }

    fn talk(&mut self, words: &[String]) -> Result<Vec<Vec<String>>, String> {
        let sock = self.sock.as_mut().ok_or("Socket belum terhubung")?;
        for w in words {
            Self::write_word(sock, w).map_err(|e| e.to_string())?;
        }
        sock.write_all(&[0]).map_err(|e| e.to_string())?;
        let mut out: Vec<Vec<String>> = Vec::new();
        loop {
            let mut sentence: Vec<String> = Vec::new();
            loop {
                let len = Self::read_len(sock).map_err(|e| e.to_string())?;
                if len == 0 {
                    break;
                }
                let mut buf = vec![0u8; len];
                sock.read_exact(&mut buf).map_err(|e| e.to_string())?;
                sentence.push(String::from_utf8_lossy(&buf).to_string());
            }
            if sentence.is_empty() {
                break;
            }
            let akhir = sentence[0] == "!done" || sentence[0] == "!fatal";
            out.push(sentence);
            if akhir {
                break;
            }
        }
        Ok(out)
    }

    /// Login RouterOS 6.43+/7 (plain). `shortcut:` CHAP lama (<6.43) tidak didukung.
    pub fn login(&mut self) -> Result<(), String> {
        let sock =
            TcpStream::connect((self.host.as_str(), self.port)).map_err(|e| e.to_string())?;
        sock.set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| e.to_string())?;
        self.sock = Some(sock);
        let res = self.talk(&[
            "/login".into(),
            format!("=name={}", self.username),
            format!("=password={}", self.password),
        ])?;
        if res.last().map(|s| s[0].as_str()) == Some("!done") {
            Ok(())
        } else {
            Err(format!("MikroTik Login failed: {res:?}"))
        }
    }

    pub fn test_connection(&mut self) -> (bool, String) {
        match self.login() {
            Ok(()) => (true, "Koneksi ke MikroTik berhasil!".to_string()),
            Err(e) => (false, format!("Koneksi gagal: {e}")),
        }
    }

    pub fn add_user(
        &mut self,
        username: &str,
        password: &str,
        profile: &str,
    ) -> Result<(), String> {
        let res = self.talk(&[
            "/ip/hotspot/user/add".into(),
            format!("=name={username}"),
            format!("=password={password}"),
            format!("=profile={profile}"),
        ])?;
        match res.last() {
            Some(s) if s[0] == "!done" => Ok(()),
            other => Err(format!("Failed to add user: {other:?}")),
        }
    }
}
