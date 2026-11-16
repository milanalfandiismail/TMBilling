//! Single instance: kunci eksklusif pada `instance/server.lock`.

use std::fs::{File, OpenOptions};
use std::path::Path;

use anyhow::{anyhow, Result};
use fs2::FileExt;

pub fn acquire(root: &Path) -> Result<File> {
    let dir = root.join("instance");
    std::fs::create_dir_all(&dir)?;
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(dir.join("server.lock"))?;
    file.try_lock_exclusive()
        .map_err(|_| anyhow!("TMBilling sudah berjalan di komputer ini."))?;
    Ok(file)
}
