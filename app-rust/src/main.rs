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

    println!("TMBilling {} — fondasi siap (server HTTP menyusul di Task 3)", state.cfg.version);
    Ok(())
}
