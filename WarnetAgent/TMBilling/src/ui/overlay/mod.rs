use gpui_kit::*;

pub mod card;
pub mod panels;

use std::rc::Rc;

pub type ActFn = Rc<dyn Fn(&mut Window, &mut App)>;
pub type TabFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;

#[derive(Clone)]
pub struct OverlayActions {
    pub minimize: ActFn,
    pub afk: ActFn,
    pub logout: ActFn,
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

pub type ToolFn = Rc<dyn Fn(ToolId, &mut Window, &mut App)>;
