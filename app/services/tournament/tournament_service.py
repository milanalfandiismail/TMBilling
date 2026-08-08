# app/services/tournament/tournament_service.py

"""Service untuk manajemen business logic Turnamen Bracket Maker.

Modul ini menangani pemrosesan data turnamen: pembuatan bracket Playoffs (Single Elimination),
pemasangan Swiss Matchmaking per babak, update skor, serta transisi tahap turnamen.
"""

import math
import random
from app.models import Turnamen, TurnamenTahap, TurnamenTim, TurnamenMatch
from app.repositories import TournamentRepository
from app.utils.timezone_utils import format_display


class TournamentService:
    """Service class untuk mengelola alur & bisnis logika Turnamen."""

    # =========================================================================
    # 1. HELPER & BRACKET GENERATION LOGIC
    # =========================================================================

    @staticmethod
    def advance_winner_to_next_match(match, winner_id):
        """Mendorong pemenang ke pertandingan berikutnya berdasarkan next_match_id."""
        if not match.next_match_id:
            return

        next_m = TournamentRepository.get_match_by_id(match.next_match_id)
        if not next_m:
            return

        if match.match_number % 2 != 0:
            next_m.tim1_id = winner_id
        else:
            next_m.tim2_id = winner_id

        TournamentRepository.commit()

    @staticmethod
    def generate_playoff_bracket(turnamen_id, stage_id, teams, default_bo):
        """Men-generate bracket Playoffs Single Elimination ke belakang (backwards)."""
        T = len(teams)
        if T < 2:
            return

        N = 2 ** math.ceil(math.log2(T))
        num_rounds = math.ceil(math.log2(N))

        next_round_matches = []

        for r in range(num_rounds, 0, -1):
            num_matches = 2 ** (num_rounds - r)
            current_round_matches = []

            for i in range(num_matches):
                m = TurnamenMatch(
                    turnamen_id=turnamen_id,
                    tahap_id=stage_id,
                    round_number=r,
                    match_number=i + 1,
                    bo_format=default_bo
                )

                if r < num_rounds:
                    m.next_match_id = next_round_matches[i // 2].id

                TournamentRepository.save(m)
                TournamentRepository.flush()
                current_round_matches.append(m)

            next_round_matches = current_round_matches

        round1_matches = next_round_matches
        for i in range(len(round1_matches)):
            m = round1_matches[i]

            if 2 * i < T:
                m.tim1_id = teams[2 * i].id
            if 2 * i + 1 < T:
                m.tim2_id = teams[2 * i + 1].id

            if m.tim1_id and not m.tim2_id:
                m.pemenang_id = m.tim1_id
                m.skor1 = 1
                m.skor2 = 0
                if m.next_match_id:
                    TournamentService.advance_winner_to_next_match(m, m.tim1_id)

        TournamentRepository.commit()

    @staticmethod
    def get_swiss_standings(stage_id):
        """Menghitung klasemen sementara Swiss Stage berdasarkan match yang selesai."""
        stage = TournamentRepository.get_stage_by_id(stage_id)
        if not stage:
            return {}

        standings = {}
        for t in stage.turnamen.teams:
            standings[t.id] = {
                "id": t.id,
                "nama_tim": t.nama_tim,
                "wins": 0,
                "losses": 0,
                "played_against": set(),
                "byes": 0
            }

        matches = TournamentRepository.get_matches_by_stage(stage_id)
        for m in matches:
            if m.pemenang_id:
                if m.tim1_id and m.tim2_id:
                    standings[m.tim1_id]["played_against"].add(m.tim2_id)
                    standings[m.tim2_id]["played_against"].add(m.tim1_id)

                    if m.pemenang_id == m.tim1_id:
                        standings[m.tim1_id]["wins"] += 1
                        standings[m.tim2_id]["losses"] += 1
                    else:
                        standings[m.tim2_id]["wins"] += 1
                        standings[m.tim1_id]["losses"] += 1
                elif m.tim1_id:
                    standings[m.tim1_id]["wins"] += 1
                    standings[m.tim1_id]["byes"] += 1

        return standings

    @staticmethod
    def pair_swiss_round(stage_id, round_number, default_bo):
        """Melakukan pairing Swiss otomatis untuk ronde berikutnya."""
        standings = TournamentService.get_swiss_standings(stage_id)

        sorted_teams = sorted(
            standings.values(),
            key=lambda x: (x["wins"], -x["losses"]),
            reverse=True
        )

        has_bye = len(sorted_teams) % 2 != 0
        bye_team_id = None

        if has_bye:
            for t in reversed(sorted_teams):
                if t["byes"] == 0:
                    bye_team_id = t["id"]
                    sorted_teams.remove(t)
                    break
            if not bye_team_id and sorted_teams:
                bye_team = sorted_teams.pop()
                bye_team_id = bye_team["id"]

        paired = set()
        pairs = []

        for i in range(len(sorted_teams)):
            t1 = sorted_teams[i]
            if t1["id"] in paired:
                continue

            opponent = None
            for j in range(i + 1, len(sorted_teams)):
                t2 = sorted_teams[j]
                if t2["id"] in paired:
                    continue
                if t2["id"] not in t1["played_against"]:
                    opponent = t2
                    break

            if not opponent:
                for j in range(i + 1, len(sorted_teams)):
                    t2 = sorted_teams[j]
                    if t2["id"] not in paired:
                        opponent = t2
                        break

            if opponent:
                paired.add(t1["id"])
                paired.add(opponent["id"])
                pairs.append((t1["id"], opponent["id"]))
            else:
                paired.add(t1["id"])
                for j in range(len(sorted_teams)):
                    t2 = sorted_teams[j]
                    if t2["id"] not in paired:
                        paired.add(t2["id"])
                        pairs.append((t1["id"], t2["id"]))
                        break

        match_index = 1
        stage = TournamentRepository.get_stage_by_id(stage_id)

        if bye_team_id:
            m = TurnamenMatch(
                turnamen_id=stage.turnamen_id,
                tahap_id=stage_id,
                round_number=round_number,
                match_number=match_index,
                tim1_id=bye_team_id,
                tim2_id=None,
                skor1=1,
                skor2=0,
                pemenang_id=bye_team_id,
                bo_format=default_bo
            )
            TournamentRepository.save(m)
            match_index += 1

        for p1, p2 in pairs:
            m = TurnamenMatch(
                turnamen_id=stage.turnamen_id,
                tahap_id=stage_id,
                round_number=round_number,
                match_number=match_index,
                tim1_id=p1,
                tim2_id=p2,
                bo_format=default_bo
            )
            TournamentRepository.save(m)
            match_index += 1

        TournamentRepository.commit()

    # =========================================================================
    # 2. PUBLIC SERVICE METHODS (CALLED BY ROUTES)
    # =========================================================================

    @staticmethod
    def get_all_tournaments():
        """Mengambil ringkasan semua turnamen."""
        tournaments = TournamentRepository.get_all()
        res = []
        for t in tournaments:
            stages_list = [s.to_dict() for s in t.stages]
            teams_count = len(t.teams)
            res.append({
                "id": t.id,
                "nama": t.nama,
                "deskripsi": t.deskripsi,
                "status": t.status,
                "dibuat_pada": format_display(t.dibuat_pada) if t.dibuat_pada else None,
                "stages": stages_list,
                "teams_count": teams_count
            })
        return res

    @staticmethod
    def get_tournament_detail(t_id):
        """Mengambil detail lengkap turnamen beserta stage, tim, match, dan klasemen."""
        t = TournamentRepository.get_by_id(t_id)
        if not t:
            raise ValueError("Turnamen tidak ditemukan")

        stages = [s.to_dict() for s in t.stages]
        teams = [tm.to_dict() for tm in t.teams]

        matches_by_stage = {}
        for s in t.stages:
            stage_matches = TournamentRepository.get_matches_by_stage(s.id)
            matches_by_stage[s.id] = [m.to_dict() for m in stage_matches]

        standings_by_stage = {}
        for s in t.stages:
            if s.tipe_format == "swiss":
                raw_standings = TournamentService.get_swiss_standings(s.id)
                standings_list = []
                for k, v in raw_standings.items():
                    v_dict = dict(v)
                    v_dict["played_against"] = list(v["played_against"])
                    standings_list.append(v_dict)
                standings_list = sorted(standings_list, key=lambda x: (x["wins"], -x["losses"]), reverse=True)
                standings_by_stage[s.id] = standings_list

        return {
            "tournament": t.to_dict(),
            "stages": stages,
            "teams": teams,
            "matches": matches_by_stage,
            "standings": standings_by_stage
        }

    @staticmethod
    def create_tournament(data):
        """Membuat turnamen baru beserta tim dan menginisialisasi stage pertama."""
        nama = data.get("nama", "").strip()
        deskripsi = data.get("deskripsi", "").strip()
        tipe_jalur = data.get("tipe_jalur", "playoff")
        teams_input = data.get("teams", [])
        default_bo = int(data.get("bo_format", 1))

        if not nama:
            raise ValueError("Nama turnamen wajib diisi")

        if len(teams_input) < 2:
            raise ValueError("Minimal harus mendaftarkan 2 tim")

        existing = TournamentRepository.get_by_nama(nama)
        if existing:
            raise ValueError(f"Turnamen dengan nama '{nama}' sudah ada")

        try:
            t = Turnamen(nama=nama, deskripsi=deskripsi, status="aktif")
            TournamentRepository.save(t)
            TournamentRepository.flush()

            db_teams = []
            for t_name in teams_input:
                t_name = t_name.strip()
                if t_name:
                    tm = TurnamenTim(turnamen_id=t.id, nama_tim=t_name)
                    TournamentRepository.save(tm)
                    db_teams.append(tm)
            TournamentRepository.flush()

            if tipe_jalur == "playoff":
                stage = TurnamenTahap(
                    turnamen_id=t.id,
                    nama="Playoffs",
                    tipe_format="single_elimination",
                    urutan=1,
                    status="aktif"
                )
                TournamentRepository.save(stage)
                TournamentRepository.flush()
                TournamentService.generate_playoff_bracket(t.id, stage.id, db_teams, default_bo)

            elif tipe_jalur == "swiss":
                stage = TurnamenTahap(
                    turnamen_id=t.id,
                    nama="Swiss Stage",
                    tipe_format="swiss",
                    urutan=1,
                    status="aktif"
                )
                TournamentRepository.save(stage)
                TournamentRepository.flush()

                random_teams = list(db_teams)
                random.shuffle(random_teams)

                has_bye = len(random_teams) % 2 != 0
                match_index = 1

                if has_bye:
                    bye_t = random_teams.pop()
                    m = TurnamenMatch(
                        turnamen_id=t.id,
                        tahap_id=stage.id,
                        round_number=1,
                        match_number=match_index,
                        tim1_id=bye_t.id,
                        tim2_id=None,
                        skor1=1,
                        skor2=0,
                        pemenang_id=bye_t.id,
                        bo_format=default_bo
                    )
                    TournamentRepository.save(m)
                    match_index += 1

                for i in range(0, len(random_teams), 2):
                    m = TurnamenMatch(
                        turnamen_id=t.id,
                        tahap_id=stage.id,
                        round_number=1,
                        match_number=match_index,
                        tim1_id=random_teams[i].id,
                        tim2_id=random_teams[i + 1].id,
                        bo_format=default_bo
                    )
                    TournamentRepository.save(m)
                    match_index += 1

            elif tipe_jalur == "multi":
                stage1 = TurnamenTahap(
                    turnamen_id=t.id,
                    nama="Group Stage (Swiss)",
                    tipe_format="swiss",
                    urutan=1,
                    status="aktif"
                )
                TournamentRepository.save(stage1)

                stage2 = TurnamenTahap(
                    turnamen_id=t.id,
                    nama="Playoffs",
                    tipe_format="single_elimination",
                    urutan=2,
                    status="draft"
                )
                TournamentRepository.save(stage2)
                TournamentRepository.flush()

                random_teams = list(db_teams)
                random.shuffle(random_teams)
                match_index = 1
                has_bye = len(random_teams) % 2 != 0

                if has_bye:
                    bye_t = random_teams.pop()
                    m = TurnamenMatch(
                        turnamen_id=t.id,
                        tahap_id=stage1.id,
                        round_number=1,
                        match_number=match_index,
                        tim1_id=bye_t.id,
                        tim2_id=None,
                        skor1=1,
                        skor2=0,
                        pemenang_id=bye_t.id,
                        bo_format=default_bo
                    )
                    TournamentRepository.save(m)
                    match_index += 1

                for i in range(0, len(random_teams), 2):
                    m = TurnamenMatch(
                        turnamen_id=t.id,
                        tahap_id=stage1.id,
                        round_number=1,
                        match_number=match_index,
                        tim1_id=random_teams[i].id,
                        tim2_id=random_teams[i + 1].id,
                        bo_format=default_bo
                    )
                    TournamentRepository.save(m)
                    match_index += 1

            TournamentRepository.commit()
            return {"tournament_id": t.id, "nama": nama}

        except Exception as e:
            TournamentRepository.rollback()
            raise e

    @staticmethod
    def update_match_skor(match_id, data):
        """Mengupdate skor pertandingan dan meloloskan pemenang ke babak berikutnya."""
        m = TournamentRepository.get_match_by_id(match_id)
        if not m:
            raise ValueError("Match tidak ditemukan")

        skor1 = int(data.get("skor1", 0))
        skor2 = int(data.get("skor2", 0))
        pemenang_id = data.get("pemenang_id")

        if pemenang_id:
            pemenang_id = int(pemenang_id)
        else:
            if skor1 > skor2:
                pemenang_id = m.tim1_id
            elif skor2 > skor1:
                pemenang_id = m.tim2_id
            else:
                raise ValueError("Skor seri. Silakan tentukan tim pemenang secara manual.")

        try:
            m.skor1 = skor1
            m.skor2 = skor2
            m.pemenang_id = pemenang_id
            TournamentRepository.commit()

            if m.tahap.tipe_format == "single_elimination" and m.next_match_id:
                TournamentService.advance_winner_to_next_match(m, pemenang_id)

            t = m.turnamen
            all_done = True
            last_stage = max(t.stages, key=lambda s: s.urutan)
            if last_stage.id == m.tahap_id:
                all_stage_matches = TournamentRepository.get_matches_by_stage(last_stage.id)
                for sm in all_stage_matches:
                    if not sm.pemenang_id:
                        all_done = False
                        break
                if all_done:
                    last_stage.status = "selesai"
                    t.status = "selesai"
                    TournamentRepository.commit()

            return m.to_dict()

        except Exception as e:
            TournamentRepository.rollback()
            raise e

    @staticmethod
    def next_swiss_round(t_id):
        """Membuka ronde Swiss berikutnya dan melakukan matchmaking otomatis."""
        t = TournamentRepository.get_by_id(t_id)
        if not t:
            raise ValueError("Turnamen tidak ditemukan")

        stage = next((s for s in t.stages if s.tipe_format == "swiss" and s.status == "aktif"), None)
        if not stage:
            raise ValueError("Tidak ada Swiss Stage yang sedang aktif pada turnamen ini")

        matches = TournamentRepository.get_matches_by_stage(stage.id)
        if not matches:
            raise ValueError("Tidak ada pertandingan terdaftar di stage ini")

        current_round = max(m.round_number for m in matches)
        incomplete = TournamentRepository.get_incomplete_matches_in_round(stage.id, current_round)
        if incomplete:
            raise ValueError(f"Ronde {current_round} belum selesai. Mohon lengkapi seluruh skor terlebih dahulu.")

        next_round = current_round + 1
        default_bo = matches[0].bo_format
        TournamentService.pair_swiss_round(stage.id, next_round, default_bo)
        return next_round

    @staticmethod
    def finish_stage(stage_id, selected_team_ids):
        """Menyelesaikan stage saat ini dan memajukan tim-tim terpilih ke Playoffs."""
        stage = TournamentRepository.get_stage_by_id(stage_id)
        if not stage:
            raise ValueError("Tahap tidak ditemukan")

        if not selected_team_ids:
            raise ValueError("Harap pilih tim yang akan diloloskan ke babak berikutnya")

        try:
            stage.status = "selesai"
            t = stage.turnamen

            next_stage = next((s for s in t.stages if s.urutan == stage.urutan + 1), None)
            if next_stage:
                next_stage.status = "aktif"
                TournamentRepository.commit()

                qualified_teams = TournamentRepository.get_teams_by_ids(selected_team_ids)
                prev_match = TournamentRepository.get_matches_by_stage(stage_id)
                default_bo = prev_match[0].bo_format if prev_match else 1

                TournamentService.generate_playoff_bracket(t.id, next_stage.id, qualified_teams, default_bo)
                msg = f"Tahap {stage.nama} diselesaikan. {len(qualified_teams)} tim diloloskan ke {next_stage.nama}."
            else:
                t.status = "selesai"
                TournamentRepository.commit()
                msg = f"Turnamen {t.nama} telah selesai."

            return msg

        except Exception as e:
            TournamentRepository.rollback()
            raise e

    @staticmethod
    def delete_tournament(t_id):
        """Menghapus turnamen secara permanen beserta semua data relasinya."""
        t = TournamentRepository.get_by_id(t_id)
        if not t:
            raise ValueError("Turnamen tidak ditemukan")

        try:
            TournamentRepository.delete(t)
            TournamentRepository.commit()
            return t.nama
        except Exception as e:
            TournamentRepository.rollback()
            raise e
