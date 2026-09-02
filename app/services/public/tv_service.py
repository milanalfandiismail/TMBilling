# app/services/public/tv_service.py

from app.models.pc.pc import PC
from app.models.paket.paket import Paket
from app.models.tournament.tournament import Turnamen, TurnamenTahap, TurnamenMatch, TurnamenTim
from app.models.menu.menu import MenuItem
from app.services.dashboard.dashboard_service import DashboardService
from app.services.settings.settings_service import SettingsService
from app.services.tournament.tournament_service import TournamentService
from app.models.base.base import db


class TVSignageService:
    """Service to gather all real-time data needed for TV Mode & Digital Signage."""

    @staticmethod
    def get_live_data():
        """Retrieve aggregated data for the TV display: PC status, tournament, promos, and settings."""
        # 1. PC List & Occupancy using existing DashboardService logic
        pc_data = DashboardService.get_pc_list()
        pc_list = pc_data.get("pc_list", [])
        
        total_pc = len(pc_list)
        pc_aktif = sum(1 for pc in pc_list if pc.get("status") in ("terpakai", "admin"))
        pc_kosong = total_pc - pc_aktif
        utilisasi = int((pc_aktif / total_pc) * 100) if total_pc > 0 else 0

        occupancy = {
            "total_pc": total_pc,
            "pc_aktif": pc_aktif,
            "pc_kosong": pc_kosong,
            "utilisasi": utilisasi
        }

        # 2. Active Tournament Info
        tournament_info = None
        active_t = Turnamen.query.filter_by(status="aktif").first()
        if active_t:
            stages_list = []
            active_stage = None
            
            # Find active stage or default to first stage
            for s in active_t.stages:
                stage_dict = s.to_dict()
                stages_list.append(stage_dict)
                if s.status == "aktif":
                    active_stage = s
                    
            if not active_stage and active_t.stages:
                active_stage = active_t.stages[0]

            standings_list = []
            matches_list = []

            if active_stage:
                # Get matches for this stage
                matches = TurnamenMatch.query.filter_by(tahap_id=active_stage.id).all()
                matches_list = [m.to_dict() for m in matches]

                if active_stage.tipe_format == "swiss":
                    # Get standings dict
                    standings_dict = TournamentService.get_swiss_standings(active_stage.id)

                    # Convert to list and sort: wins DESC, losses ASC
                    sorted_standings = sorted(
                        standings_dict.values(),
                        key=lambda x: (x["wins"], -x["losses"]),
                        reverse=True
                    )
                    # Remove set objects so it is JSON serializable
                    for s_item in sorted_standings:
                        if "played_against" in s_item:
                            del s_item["played_against"]
                        standings_list.append(s_item)

            tournament_info = {
                "tournament": active_t.to_dict(),
                "active_stage": active_stage.to_dict() if active_stage else None,
                "standings": standings_list,
                "matches": matches_list
            }

        # 3. Active Packages (Promos)
        promos = Paket.query.filter_by(aktif=True).order_by(Paket.harga.asc()).all()
        promos_list = [p.to_dict() for p in promos]

        # 4. Settings
        # Retrieve settings using SettingsService
        tv_running_text = SettingsService.get(
            "tv_running_text", 
            "Selamat datang di TMBilling! Nikmati koneksi internet ultra cepat, spesifikasi hardware PC premium, dan kenyamanan bermain game terbaik."
        )
        
        tv_slide_duration = SettingsService.get("tv_slide_duration", "15")
        try:
            slide_duration = int(tv_slide_duration)
        except (ValueError, TypeError):
            slide_duration = 15

        tv_slides_enabled = SettingsService.get("tv_slides_enabled", "1,2,3,4")
        warnet_rules = SettingsService.get("warnet_announcement", "")

        tv_timezone = SettingsService.get("timezone", "Asia/Jakarta")
        tz_abbr = "WIB"
        if "Makassar" in tv_timezone:
            tz_abbr = "WITA"
        elif "Jayapura" in tv_timezone:
            tz_abbr = "WIT"
        elif "Singapore" in tv_timezone or "Hong_Kong" in tv_timezone:
            tz_abbr = "SGT"

        tv_warnet_title = SettingsService.get("warnet_title", "TMBilling")

        settings = {
            "running_text": tv_running_text,
            "slide_duration": slide_duration,
            "slides_enabled": [int(x.strip()) for x in tv_slides_enabled.split(",") if x.strip().isdigit()],
            "warnet_rules": [r.strip() for r in warnet_rules.split("\n") if r.strip()] if "<" not in warnet_rules else [],
            "warnet_rules_html": warnet_rules,
            "timezone_abbr": tz_abbr,
            "warnet_title": tv_warnet_title
        }

        # 5. Food Menu
        menus = MenuItem.query.filter_by(is_active=True).order_by(MenuItem.nama.asc()).all()
        menus_list = [m.to_dict() for m in menus]

        return {
            "occupancy": occupancy,
            "pc_list": pc_list,
            "by_grup": pc_data.get("by_grup", {}),
            "grup_meta": pc_data.get("grup_meta", {}),
            "tournament": tournament_info,
            "promos": promos_list,
            "settings": settings,
            "menu_items": menus_list
        }
