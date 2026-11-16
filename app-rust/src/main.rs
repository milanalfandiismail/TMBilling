use anyhow::Result;
use tmbilling_server::config::Config;
use tmbilling_server::state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    let root = std::env::current_dir()?;
    let cfg = Config::load(&root)?;
    let state = AppState::new(cfg).await?;

    if std::env::args().any(|a| a == "--init") {
        println!("TMBilling {} — direktori server siap di {}", state.cfg.version, state.cfg.root.display());
        return Ok(());
    }

    let port = std::env::var("PORT").ok().and_then(|p| p.parse::<u16>().ok()).unwrap_or(7015);
    let state = std::sync::Arc::new(state);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    println!("TMBilling {} — http://localhost:{}", state.cfg.version, port);
    axum::serve(
        listener,
        tmbilling_server::app::router(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;
    Ok(())
}
