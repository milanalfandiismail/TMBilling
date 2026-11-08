from app.models.member.member import Member
from app.repositories.member.member_repository import MemberRepository
from app.repositories.menu.menu_repository import MenuRepository
from app.repositories.pc.pc_repository import PCRepository
from app.repositories.sesi.sesi_repository import SesiRepository
from app.repositories.tournament.tournament_repository import TournamentRepository
from app.repositories.transaksi.transaksi_repository import TransaksiRepository
from app.services.cache.system_cache_store import PCNetworkCacheStore
from app.services.dashboard.dashboard_service import DashboardService
from app.services.menu.menu_service import MenuService
from app.services.report.report_service import ReportService
from app.services.settings.settings_service import SettingsService
from app.utils import helpers, timezone_utils


def test_helper_tanpa_pemanggil_sudah_dihapus():
    assert not hasattr(Member, "kurangi_waktu")
    assert not hasattr(MemberRepository, "tambah_saldo_menit")
    assert not hasattr(MemberRepository, "update_waktu")
    assert not hasattr(MenuRepository, "count_archived")
    assert not hasattr(MenuRepository, "get_transactions_by_date_paginated")
    assert not hasattr(PCRepository, "save_batch")
    assert not hasattr(SesiRepository, "get_active_admin_sessions")
    assert not hasattr(SesiRepository, "update_last_sync")
    assert not hasattr(SesiRepository, "create_new_session")
    assert not hasattr(SesiRepository, "get_by_tanggal")
    assert not hasattr(SesiRepository, "get_all_suspects")
    assert not hasattr(SesiRepository, "get_by_audit_status")
    assert not hasattr(SesiRepository, "get_aktif_tanpa_sync")
    assert not hasattr(TournamentRepository, "get_matches_by_stage_and_round")
    assert not hasattr(TransaksiRepository, "get_by_sesi_id")
    assert not hasattr(TransaksiRepository, "get_last_paket_member")
    assert not hasattr(TransaksiRepository, "get_history_nota_by_date")
    assert not hasattr(TransaksiRepository, "update_refund_status")
    assert not hasattr(DashboardService, "get_dashboard_data")
    assert not hasattr(MenuService, "get_menu_by_id")
    assert not hasattr(ReportService, "get_total_menit_harian")
    assert not hasattr(SettingsService, "get_auto_shutdown_timer")
    assert not hasattr(PCNetworkCacheStore, "get_by_mac")
    assert not hasattr(helpers, "format_rupiah")
    assert not hasattr(timezone_utils, "ensure_utc")
