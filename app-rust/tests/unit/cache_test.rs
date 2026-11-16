//! Cache in-memory: miss negatif settings dan TTL status online.

use std::collections::HashMap;
use tmbilling_server::cache::online::OnlineStatusStore;
use tmbilling_server::cache::settings::SettingsCache;

#[test]
fn miss_negatif_diingat_tanpa_query_ulang() {
    let cache = SettingsCache::new();
    assert!(cache.get("tidak_ada").is_none());
    assert!(!cache.is_missing("tidak_ada"));
    cache.mark_missing("tidak_ada");
    assert!(cache.is_missing("tidak_ada"));
    assert!(!cache.is_complete());

    let mut data = HashMap::new();
    data.insert("warnet_title".to_string(), "TMBilling".to_string());
    cache.update_all(data);
    assert!(cache.is_complete());
    assert_eq!(cache.get("warnet_title").as_deref(), Some("TMBilling"));
    assert!(!cache.is_missing("tidak_ada"));

    cache.invalidate();
    assert!(!cache.is_complete());
    assert!(cache.get("warnet_title").is_none());
}

#[test]
fn status_online_kedaluwarsa_setelah_ttl() {
    let store = OnlineStatusStore::new();
    store.touch(3);
    assert!(store.is_online(3));
    assert_eq!(store.online_ids(), vec![3]);
    store.forget(3);
    assert!(!store.is_online(3));
    assert!(store.online_ids().is_empty());
}
