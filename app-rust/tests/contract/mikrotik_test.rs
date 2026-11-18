//! Kontrak MikroTik: login RouterOS palsu (trap + CHAP), port kustom, dan hitungan sync.
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{HeaderMap, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tmbilling_server::app::router;
use tmbilling_server::config::Config;
use tmbilling_server::models::user::hash_password;
use tmbilling_server::services::mikrotik::mikrotik_service::{sync_members, Client};
use tmbilling_server::state::AppState;
use tower::ServiceExt;

// ---------- Server RouterOS palsu ----------

fn write_word(sock: &mut TcpStream, word: &str) {
    let b = word.as_bytes();
    let len = b.len();
    assert!(len < 0x80, "kata uji terlalu panjang");
    sock.write_all(&[len as u8]).unwrap();
    sock.write_all(b).unwrap();
}

fn read_word(sock: &mut TcpStream) -> Option<String> {
    let mut first = [0u8; 1];
    sock.read_exact(&mut first).ok()?;
    let c = first[0];
    let len = if c & 0x80 == 0 {
        c as usize
    } else if c & 0xC0 == 0x80 {
        let mut b = [0u8; 1];
        sock.read_exact(&mut b).ok()?;
        (((c & 0x3F) as usize) << 8) | b[0] as usize
    } else {
        let mut b = [0u8; 2];
        sock.read_exact(&mut b).ok()?;
        (((c & 0x1F) as usize) << 16) | ((b[0] as usize) << 8) | b[1] as usize
    };
    if len == 0 {
        return Some(String::new());
    }
    let mut buf = vec![0u8; len];
    sock.read_exact(&mut buf).ok()?;
    Some(String::from_utf8_lossy(&buf).to_string())
}

/// Satu command klien = satu entri `commands`; tiap entri berisi daftar sentence balasan.
fn fake_ros(
    commands: Vec<Vec<Vec<&'static str>>>,
) -> (u16, Arc<Mutex<Vec<Vec<String>>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let hits = Arc::new(Mutex::new(Vec::new()));
    let catat = hits.clone();
    std::thread::spawn(move || {
        let Ok((mut sock, _)) = listener.accept() else {
            return;
        };
        for sentences in commands {
            let mut words = Vec::new();
            loop {
                match read_word(&mut sock) {
                    Some(w) if w.is_empty() => break,
                    Some(w) => words.push(w),
                    None => return,
                }
            }
            catat.lock().unwrap().push(words);
            for sentence in sentences {
                for w in sentence {
                    write_word(&mut sock, w);
                }
                write_word(&mut sock, "");
            }
        }
    });
    (port, hits)
}

// ---------- Test klien ----------

#[test]
fn login_menolak_password_salah() {
    let (port, _) = fake_ros(vec![vec![
        vec!["!trap", "=message=invalid user name or password"],
        vec!["!done"],
    ]]);
    let err = Client::new("127.0.0.1", "admin", "salah", port)
        .login()
        .unwrap_err();
    assert!(err.contains("invalid user name or password"), "{err}");
}

#[test]
fn login_memakai_chap_saat_routeros_mengirim_ret() {
    let (port, hits) = fake_ros(vec![
        vec![vec!["!done", "=ret=00112233445566778899aabbccddeeff"]],
        vec![vec!["!done"]],
    ]);
    Client::new("127.0.0.1", "admin", "secret", port)
        .login()
        .unwrap();
    let kedua = hits.lock().unwrap()[1].clone();
    assert!(
        kedua.contains(&"=response=00c17511d224a5e93170632807d36388aa".to_string()),
        "{kedua:?}"
    );
}

#[test]
fn sync_menghitung_berhasil_dan_gagal() {
    let (port, _) = fake_ros(vec![
        vec![vec!["!done"]],
        vec![vec!["!done"]],
        vec![vec!["!trap", "=message=already have user"], vec!["!done"]],
    ]);
    let mut client = Client::new("127.0.0.1", "admin", "x", port);
    client.login().unwrap();
    let (berhasil, gagal) = sync_members(&mut client, &["a".into(), "b".into()], "default");
    assert_eq!((berhasil, gagal), (1, 1));
}

#[test]
fn get_user_mengembalikan_id_dan_set_remove_memakai_id() {
    let (port, hits) = fake_ros(vec![
        vec![vec!["!done"]],
        vec![vec!["!re", "=.id=*95", "=name=alok"], vec!["!done"]],
        vec![vec!["!done"]],
        vec![vec!["!done"]],
    ]);
    let mut c = Client::new("127.0.0.1", "admin", "x", port);
    c.login().unwrap();
    assert_eq!(c.get_user("alok").unwrap().as_deref(), Some("*95"));
    c.set_user_password("*95", "baru1234").unwrap();
    c.remove_user("*95").unwrap();
    let h = hits.lock().unwrap();
    assert!(h[1].contains(&"?name=alok".to_string()), "{:?}", h[1]);
    assert!(h[2].contains(&"=password=baru1234".to_string()), "{:?}", h[2]);
    assert!(h[3].contains(&"=.id=*95".to_string()), "{:?}", h[3]);
}

// ---------- Test route ----------

const LAN: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 50)),
    5000,
);

struct TempDir(PathBuf);
impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_mikrotik_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn state(tag: &str) -> (TempDir, Arc<AppState>) {
    let dir = TempDir::new(tag);
    let cfg = Config::load(&dir.0).unwrap();
    let st = Arc::new(AppState::new(cfg).await.unwrap());
    tmbilling_server::services::settings::settings_service::set(
        &st,
        "ip_whitelist_enabled",
        "false",
    )
    .await
    .unwrap();
    sqlx::query("UPDATE user SET password_hash = ? WHERE username = 'admin'")
        .bind(hash_password("rahasia123"))
        .execute(&st.pool)
        .await
        .unwrap();
    (dir, st)
}

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

fn cookie_of(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find(|c| c.starts_with(&format!("{name}=")))
        .and_then(|c| c.split(';').next())
        .map(|c| {
            c.split_once('=')
                .map(|(_, v)| v.to_string())
                .unwrap_or_default()
        })
}

async fn send(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    cookies: &str,
    csrf: Option<&str>,
    body: Option<Value>,
) -> Reply {
    let mut builder = Request::builder().method(method).uri(uri);
    if !cookies.is_empty() {
        builder = builder.header("cookie", cookies);
    }
    if let Some(token) = csrf {
        builder = builder.header("x-csrftoken", token);
    }
    let payload = match body {
        Some(v) => {
            builder = builder.header("content-type", "application/json");
            serde_json::to_vec(&v).unwrap()
        }
        None => Vec::new(),
    };
    let mut req = builder.body(Body::from(payload)).unwrap();
    req.extensions_mut().insert(ConnectInfo(LAN));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    Reply {
        status,
        headers,
        body: String::from_utf8_lossy(&body).to_string(),
    }
}

async fn csrf_token(st: Arc<AppState>) -> String {
    let reply = send(st, "GET", "/kasir/login", "", None, None).await;
    cookie_of(&reply.headers, "csrf_token").expect("cookie csrf dari halaman login")
}

async fn login(st: Arc<AppState>, username: &str, password: &str) -> Reply {
    let token = csrf_token(st.clone()).await;
    send(
        st,
        "POST",
        "/api/v1/kasir/auth/login",
        &format!("csrf_token={token}"),
        Some(&token),
        Some(json!({"username": username, "password": password})),
    )
    .await
}

#[tokio::test]
async fn test_koneksi_memakai_port_kustom() {
    let (port, _) = fake_ros(vec![vec![vec!["!done"]]]);
    let (_dir, st) = state("port").await;
    let admin = login(st.clone(), "admin", "rahasia123").await;
    assert_eq!(admin.status, StatusCode::OK, "{}", admin.body);
    let session = cookie_of(&admin.headers, "tm_session").unwrap();
    let csrf = cookie_of(&admin.headers, "csrf_token").unwrap();
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/mikrotik/test",
        &format!("tm_session={session}; csrf_token={csrf}"),
        Some(&csrf),
        Some(json!({
            "host": "127.0.0.1",
            "port": port.to_string(),
            "username": "admin",
            "password": "x",
        })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
}
