//! Agregasi 7 kategori data terarsip.

use serde_json::{json, Value};

use crate::repositories::{game, grup, member, menu, paket, pc, user};
use crate::state::AppState;

pub async fn get(st: &AppState) -> Value {
    let g = grup::get_all(&st.pool, false).await.unwrap_or_default();
    let p = pc::get_all(&st.pool, false, None, None)
        .await
        .unwrap_or_default();
    let pk = paket::get_all(&st.pool, false, None, None)
        .await
        .unwrap_or_default();
    let semua_member = member::get_paginated(
        &st.pool,
        member::Filter {
            q: None,
            grup_id: None,
            aktif_only: false,
        },
        "id",
        "asc",
        10_000,
        0,
    )
    .await
    .map(|(rows, _)| rows)
    .unwrap_or_default();
    let m = semua_member;
    let u = user::get_all(&st.pool, false).await.unwrap_or_default();
    let gm = game::get_all(&st.pool, false, None, None, None, None, 0)
        .await
        .unwrap_or_default();
    let mn = menu::get_archived(&st.pool).await.unwrap_or_default();

    let grup_arsip: Vec<Value> = g
        .iter()
        .filter(|x| !x.active())
        .map(|x| x.to_json())
        .collect();
    let pc_arsip: Vec<Value> = p
        .iter()
        .filter(|x| !x.active())
        .map(|x| x.to_json(None, None))
        .collect();
    let paket_arsip: Vec<Value> = pk
        .iter()
        .filter(|x| !x.active())
        .map(|x| x.to_json())
        .collect();
    let member_arsip: Vec<Value> = m
        .iter()
        .filter(|x| !x.aktif)
        .map(|x| {
            x.to_json(
                Some("reguler"),
                Some("#888888"),
                x.waktu_tersimpan,
                &st.cfg.timezone,
            )
        })
        .collect();
    let user_arsip: Vec<Value> = u
        .iter()
        .filter(|x| !x.active())
        .map(|x| x.to_json())
        .collect();
    let game_arsip: Vec<Value> = gm
        .iter()
        .filter(|x| !x.active())
        .map(|x| x.to_json())
        .collect();
    let menu_arsip: Vec<Value> = mn
        .iter()
        .filter(|x| !x.is_active)
        .map(|x| x.to_json())
        .collect();

    json!({
        "grup": grup_arsip,
        "pc": pc_arsip,
        "paket": paket_arsip,
        "member": member_arsip,
        "user": user_arsip,
        "game": game_arsip,
        "menu": menu_arsip,
    })
}
