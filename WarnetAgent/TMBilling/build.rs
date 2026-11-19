fn main() {
    #[cfg(windows)]
    {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("assets/app-icon.ico");
        if let Err(e) = res.compile() {
            println!("cargo:warning=icon resource skipped: {e}");
        }
    }
}
