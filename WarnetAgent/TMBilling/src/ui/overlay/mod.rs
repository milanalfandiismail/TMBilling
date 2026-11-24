use gpui_kit::*;

pub mod card;
pub mod modals;
pub mod panels;

use std::rc::Rc;

pub type ActFn = Rc<dyn Fn(&mut Window, &mut App)>;
pub type TabFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;

pub type LaunchFn = Rc<dyn Fn(String, Option<String>, &mut Window, &mut App)>;

#[derive(Clone)]
pub struct OverlayActions {
    pub open: ModalFn,
    pub close: ActFn,
    pub page_prev: ActFn,
    pub page_next: ActFn,
    pub pin_submit: ActFn,
    pub admin_submit: ActFn,
    pub minimize: ActFn,
    pub afk: ActFn,
    pub logout: ActFn,
    pub logout_confirm: ActFn,
    pub tab: TabFn,
    pub tool: ToolFn,
    pub power_confirm: PowerConfirmFn,
    pub focus_pin: ActFn,
    pub focus_admin: FocusFn,
    pub launcher_tab: TabFn,
    pub launcher_launch: LaunchFn,
    pub open_launcher: ActFn,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ToolId {
    Lock = 0,
    Volume = 1,
    Mouse = 2,
    Keyboard = 3,
    Menu = 4,
    Paket = 5,
}

/// Alat Cepat membuka applet Windows, sama seperti klien Tauri.
pub fn tool_command(tool: ToolId) -> Option<(&'static str, &'static [&'static str])> {
    match tool {
        ToolId::Volume => Some(("sndvol.exe", &[])),
        ToolId::Mouse => Some(("control.exe", &["main.cpl"])),
        ToolId::Keyboard => Some(("control.exe", &["keyboard"])),
        ToolId::Lock | ToolId::Menu | ToolId::Paket => None,
    }
}

pub type ModalFn = Rc<dyn Fn(crate::state::Modal, &mut Window, &mut App)>;
pub type ToolFn = Rc<dyn Fn(ToolId, &mut Window, &mut App)>;
pub type PowerConfirmFn = Rc<dyn Fn(crate::state::PowerAction, &mut Window, &mut App)>;
pub type FocusFn = Rc<dyn Fn(crate::state::LoginField, &mut Window, &mut App)>;
