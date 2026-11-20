use gpui_kit::*;

pub mod card;

use std::rc::Rc;

pub type ActFn = Rc<dyn Fn(&mut Window, &mut App)>;
pub type TabFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;

#[derive(Clone)]
pub struct OverlayActions {
    pub minimize: ActFn,
    pub afk: ActFn,
    pub logout: ActFn,
    pub tab: TabFn,
}
