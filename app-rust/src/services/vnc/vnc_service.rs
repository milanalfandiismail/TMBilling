//! Proxy VNC: WebSocket RFB (browser) ↔ TCP 5900 PC client.
//!
//! Menggantikan websockify Python; token acak per PC, listener tunggal port 8081.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use axum::extract::ws::{Message, WebSocketUpgrade};
use axum::extract::Query;
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use base64::Engine;
use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

pub const LISTEN_PORT: u16 = 8081;
pub const VNC_PORT: u16 = 5900;

#[derive(Clone)]
pub struct Proxy {
    pub port: u16,
    pub token: String,
    pub client_ip: String,
}

#[derive(Default)]
pub struct VncRegistry {
    proxies: Mutex<HashMap<i64, Proxy>>,
    tokens: Mutex<HashMap<String, (String, u16)>>,
    ready: Mutex<HashMap<i64, Result<(), String>>>,
}

impl VncRegistry {
    pub fn get(&self, pc_id: i64) -> Option<Proxy> {
        self.proxies.lock().unwrap().get(&pc_id).cloned()
    }

    pub fn reset(&self, pc_id: i64) {
        self.ready.lock().unwrap().remove(&pc_id);
    }

    pub fn set_ready(&self, pc_id: i64, hasil: Result<(), String>) {
        self.ready.lock().unwrap().insert(pc_id, hasil);
    }

    /// `None` = belum ada kabar, `Some(Ok)` siap, `Some(Err)` gagal di agent.
    pub fn poll(&self, pc_id: i64) -> Option<Result<(), String>> {
        self.ready.lock().unwrap().get(&pc_id).cloned()
    }

    fn daftar_token(&self, token: &str, host: &str, port: u16) {
        self.tokens
            .lock()
            .unwrap()
            .insert(token.to_string(), (host.to_string(), port));
    }

    fn hapus_token(&self, token: &str) {
        self.tokens.lock().unwrap().remove(token);
    }

    fn target(&self, token: &str) -> Option<(String, u16)> {
        self.tokens.lock().unwrap().get(token).cloned()
    }
}

pub fn token_baru() -> String {
    use rand::RngCore;
    let mut buf = [0u8; 24];
    rand::rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

pub fn is_port_open(host: &str, port: u16) -> bool {
    let addr = format!("{host}:{port}");
    std::net::TcpStream::connect_timeout(
        &match addr.parse() {
            Ok(a) => a,
            Err(_) => return false,
        },
        std::time::Duration::from_millis(400),
    )
    .is_ok()
}

/// Daftarkan proxy untuk PC: token baru + listener 8081 (sekali).
pub fn start_proxy(
    st: &Arc<crate::state::AppState>,
    pc_id: i64,
    host: &str,
) -> Result<Proxy, String> {
    if let Some(p) = st.vnc.get(pc_id) {
        return Ok(p);
    }
    let token = token_baru();
    st.vnc.daftar_token(&token, host, VNC_PORT);
    let proxy = Proxy {
        port: LISTEN_PORT,
        token: token.clone(),
        client_ip: host.to_string(),
    };
    st.vnc.proxies.lock().unwrap().insert(pc_id, proxy.clone());
    ensure_listener(st.clone());
    Ok(proxy)
}

pub fn stop_proxy(st: &Arc<crate::state::AppState>, pc_id: i64) {
    if let Some(p) = st.vnc.proxies.lock().unwrap().remove(&pc_id) {
        st.vnc.hapus_token(&p.token);
    }
    st.vnc.reset(pc_id);
}

static LISTENER: OnceLock<()> = OnceLock::new();

/// Listener WebSocket tunggal; token di query string memilih target TCP.
pub fn ensure_listener(st: Arc<crate::state::AppState>) {
    LISTENER.get_or_init(move || {
        tokio::spawn(async move {
            let app = Router::new()
                .route("/", get(ws_handler))
                .with_state(st.clone());
            let addr = std::net::SocketAddr::from(([0, 0, 0, 0], LISTEN_PORT));
            match tokio::net::TcpListener::bind(addr).await {
                Ok(lis) => {
                    tracing::info!("proxy VNC mendengarkan 0.0.0.0:{}", LISTEN_PORT);
                    let _ = axum::serve(lis, app).await;
                }
                Err(e) => tracing::warn!("proxy VNC gagal bind :{}: {e}", LISTEN_PORT),
            }
        });
    });
}

#[derive(Deserialize)]
struct TokenQuery {
    token: Option<String>,
}

async fn ws_handler(
    axum::extract::State(st): axum::extract::State<Arc<crate::state::AppState>>,
    Query(q): Query<TokenQuery>,
    ws: WebSocketUpgrade,
) -> Response {
    let token = q.token.unwrap_or_default();
    ws.on_upgrade(move |socket| relay(st, socket, token))
}

async fn relay(
    st: Arc<crate::state::AppState>,
    mut socket: axum::extract::ws::WebSocket,
    token: String,
) {
    let (host, port) = match st.vnc.target(&token) {
        Some(t) => t,
        None => {
            let _ = socket.send(Message::Close(None)).await;
            return;
        }
    };
    let stream = match TcpStream::connect((host.as_str(), port)).await {
        Ok(s) => s,
        Err(_) => {
            let _ = socket.send(Message::Close(None)).await;
            return;
        }
    };
    let (mut rd, mut wr) = stream.into_split();
    let mut buf = vec![0u8; 16384];
    loop {
        tokio::select! {
            msg = socket.recv() => match msg {
                Some(Ok(Message::Binary(data))) => {
                    if wr.write_all(data.as_ref()).await.is_err() { break; }
                }
                Some(Ok(Message::Close(_))) | None => break,
                Some(Err(_)) => break,
                _ => {}
            },
            n = rd.read(&mut buf) => match n {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if socket.send(Message::Binary(buf[..n].to_vec().into())).await.is_err() { break; }
                }
            },
        }
    }
}
