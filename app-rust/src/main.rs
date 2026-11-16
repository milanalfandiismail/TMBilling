use anyhow::Result;
use tmbilling_server::config::Config;
use tmbilling_server::state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let root = std::env::current_dir()?;

    // Mode penerap pembaruan: tidak membuka listener, hanya menukar berkas.
    if let Some(pos) = args.iter().position(|a| a == "--apply-update") {
        let zip = args.get(pos + 1).map(std::path::PathBuf::from);
        let tujuan = args.get(pos + 2).map(std::path::PathBuf::from);
        match (zip, tujuan) {
            (Some(zip), Some(tujuan)) => tmbilling_server::update::apply(&zip, &tujuan)?,
            _ => anyhow::bail!("pemakaian: --apply-update <zip> <direktori-server>"),
        }
        return Ok(());
    }

    let cfg = Config::load(&root)?;
    let _kunci = tmbilling_server::utils::instance::acquire(&cfg.root)?;
    let state = AppState::new(cfg).await?;

    if args.iter().any(|a| a == "--init") {
        println!(
            "TMBilling {} — direktori server siap di {}",
            state.cfg.version,
            state.cfg.root.display()
        );
        return Ok(());
    }

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(7015);
    let state = std::sync::Arc::new(state);
    tmbilling_server::scheduler::spawn(state.clone());
    tmbilling_server::tray::spawn(state.clone());
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    println!(
        "TMBilling {} — http://localhost:{}",
        state.cfg.version, port
    );
    axum::serve(
        listener,
        tmbilling_server::app::router(state)
            .into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;
    Ok(())
}
