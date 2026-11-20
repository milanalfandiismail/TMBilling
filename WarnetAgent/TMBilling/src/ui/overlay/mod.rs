use gpui_kit::*;

pub mod card;
pub mod modals;
pub mod panels;

use std::rc::Rc;

pub type ActFn = Rc<dyn Fn(&mut Window, &mut App)>;
pub type TabFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;

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
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ToolId {
    Restart = 0,
    Shutdown = 1,
    Lock = 2,
    Volume = 3,
    Mouse = 4,
    Keyboard = 5,
}

pub type ModalFn = Rc<dyn Fn(crate::state::Modal, &mut Window, &mut App)>;
pub type ToolFn = Rc<dyn Fn(ToolId, &mut Window, &mut App)>;
