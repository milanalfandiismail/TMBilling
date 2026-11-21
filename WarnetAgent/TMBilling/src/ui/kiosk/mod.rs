pub mod afk;
pub mod header;
pub mod info;
pub mod login;

use std::rc::Rc;

use gpui_kit::*;

use crate::state::{LoginField, PowerAction};

pub type FieldFn = Rc<dyn Fn(LoginField, &mut Window, &mut App)>;
pub type ActionFn = Rc<dyn Fn(&mut Window, &mut App)>;
pub type PowerFn = Rc<dyn Fn(Option<PowerAction>, &mut Window, &mut App)>;
pub type QrisFn = Rc<dyn Fn(bool, &mut Window, &mut App)>;
pub type TabFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;
pub type PageFn = Rc<dyn Fn(usize, &mut Window, &mut App)>;

/// Aksi layar kiosk; dibangun di app.rs dengan entity handle.
pub struct KioskActions {
    pub field: FieldFn,
    pub submit: ActionFn,
    pub power: PowerFn,
    pub qris: QrisFn,
    pub tab: TabFn,
    pub page: PageFn,
}
