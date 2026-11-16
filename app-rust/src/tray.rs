//! Ikon tray Windows: buka dashboard di browser dan keluar.
//! shortcut: ikon memakai ikon aplikasi bawaan; `tm.png` belum dikonversi ke HICON.

use std::sync::Arc;

use crate::state::AppState;

#[cfg(windows)]
pub fn spawn(st: Arc<AppState>) {
    let _ = st;
    std::thread::spawn(|| unsafe { win::main_loop() });
}

#[cfg(not(windows))]
pub fn spawn(_st: Arc<AppState>) {}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;
    use std::ptr;

    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteW, Shell_NotifyIconW, NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NIM_DELETE,
        NOTIFYICONDATAW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu,
        DispatchMessageW, GetCursorPos, GetMessageW, LoadCursorW, LoadIconW, PostQuitMessage,
        RegisterClassW, SetForegroundWindow, TrackPopupMenu, TranslateMessage, IDC_ARROW,
        IDI_APPLICATION, MF_SEPARATOR, MF_STRING, MSG, TPM_RIGHTBUTTON, WM_APP, WM_COMMAND,
        WM_LBUTTONUP, WM_NULL, WM_RBUTTONUP, WNDCLASSW,
    };

    const WM_TRAY: u32 = WM_APP + 1;
    const ID_DASH: usize = 1;
    const ID_QUIT: usize = 2;

    fn lebar(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn notifikasi(hwnd: HWND, tambah: bool) {
        let mut data: NOTIFYICONDATAW = std::mem::zeroed();
        data.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
        data.hWnd = hwnd;
        data.uID = 1;
        data.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
        data.uCallbackMessage = WM_TRAY;
        data.hIcon = LoadIconW(ptr::null_mut(), IDI_APPLICATION);
        let tip = lebar("TMBilling");
        data.szTip[..tip.len()].copy_from_slice(&tip[..tip.len().min(127)]);
        let aksi = if tambah { NIM_ADD } else { NIM_DELETE };
        Shell_NotifyIconW(aksi, &data);
    }

    unsafe fn buka_dashboard() {
        let url = lebar("http://localhost:7015/kasir/");
        let verb = lebar("open");
        ShellExecuteW(
            ptr::null_mut(),
            verb.as_ptr(),
            url.as_ptr(),
            ptr::null(),
            ptr::null(),
            1,
        );
    }

    unsafe fn menu(hwnd: HWND) {
        let popup = CreatePopupMenu();
        let dash = lebar("Buka Dashboard");
        let keluar = lebar("Keluar");
        AppendMenuW(popup, MF_STRING, ID_DASH, dash.as_ptr());
        AppendMenuW(popup, MF_SEPARATOR, 0, ptr::null());
        AppendMenuW(popup, MF_STRING, ID_QUIT, keluar.as_ptr());
        let mut pt = POINT { x: 0, y: 0 };
        GetCursorPos(&mut pt);
        SetForegroundWindow(hwnd);
        TrackPopupMenu(popup, TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, ptr::null());
        DestroyMenu(popup);
        windows_sys::Win32::UI::WindowsAndMessaging::PostMessageW(hwnd, WM_NULL, 0, 0);
    }

    unsafe extern "system" fn wndproc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_TRAY => {
                let event = lparam as u32;
                if event == WM_RBUTTONUP {
                    menu(hwnd);
                } else if event == WM_LBUTTONUP {
                    buka_dashboard();
                }
                0
            }
            WM_COMMAND => {
                match wparam & 0xffff {
                    ID_DASH => buka_dashboard(),
                    ID_QUIT => {
                        notifikasi(hwnd, false);
                        std::process::exit(0);
                    }
                    _ => {}
                }
                0
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    pub unsafe fn main_loop() {
        let hinst = GetModuleHandleW(ptr::null());
        let kelas = lebar("TMBillingTray");
        let wc = WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(wndproc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinst,
            hIcon: LoadIconW(ptr::null_mut(), IDI_APPLICATION),
            hCursor: LoadCursorW(ptr::null_mut(), IDC_ARROW),
            hbrBackground: ptr::null_mut(),
            lpszMenuName: ptr::null(),
            lpszClassName: kelas.as_ptr(),
        };
        RegisterClassW(&wc);
        let judul = lebar("TMBilling");
        let hwnd = CreateWindowExW(
            0,
            kelas.as_ptr(),
            judul.as_ptr(),
            0,
            0,
            0,
            0,
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            hinst,
            ptr::null::<c_void>(),
        );
        if hwnd.is_null() {
            return;
        }
        notifikasi(hwnd, true);
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        notifikasi(hwnd, false);
        PostQuitMessage(0);
    }
}
