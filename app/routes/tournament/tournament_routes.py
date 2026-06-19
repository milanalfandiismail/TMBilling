# app/routes/tournament_routes.py

"""Blueprint rute API untuk Turnamen Bracket Maker di TMBilling.

Menyediakan API untuk:
1. CRUD Turnamen
2. Update skor pertandingan & kemajuan otomatis (Auto-advance)
3. Swiss matchmaking per babak
4. Konfirmasi lolos dari Swiss ke babak Playoffs
"""

from flask import Blueprint, request, jsonify, session
from app.models import db, now_local
from app.models import Turnamen, TurnamenTahap, TurnamenTim, TurnamenMatch
from app.routes.auth.auth_kasir_routes import login_required, admin_required
import math
import random

tournament_bp = Blueprint("tournament", __name__)


# =========================================================================
# HELPER FUNCTIONS
# =========================================================================

def advance_winner_to_next_match(match, winner_id):
    """Mendorong pemenang ke pertandingan berikutnya berdasarkan next_match_id."""
    if not match.next_match_id:
        return
        
    next_m = TurnamenMatch.query.get(match.next_match_id)
    if not next_m:
        return
        
    # Sesuai logika: match ganjil masuk tim1_id, genap masuk tim2_id
    if match.match_number % 2 != 0:
        next_m.tim1_id = winner_id
    else:
        next_m.tim2_id = winner_id
        
    db.session.commit()


def generate_playoff_bracket(turnamen_id, stage_id, teams, default_bo):
    """Men-generate bracket Playoffs Single Elimination ke belakang (backwards)."""
    T = len(teams)
    if T < 2:
        return
        
    # Bulatkan ke atas ke pangkat 2 terdekat
    N = 2 ** math.ceil(math.log2(T))
    num_rounds = math.ceil(math.log2(N))
    
    next_round_matches = []
    
    # Generate dari babak final turun ke babak pertama
    for r in range(num_rounds, 0, -1):
        num_matches = 2 ** (num_rounds - r)
        current_round_matches = []
        
        for i in range(num_matches):
            m = TurnamenMatch(
                turnamen_id=turnamen_id,
                tahap_id=stage_id,
                round_number=r,
                match_number=i+1,
                bo_format=default_bo
            )
            
            if r < num_rounds:
                # Link ke match di babak selanjutnya yang telah di-generate sebelumnya
                m.next_match_id = next_round_matches[i // 2].id
                
            db.session.add(m)
            db.session.flush() # Flush untuk mendapatkan id
            current_round_matches.append(m)
            
        next_round_matches = current_round_matches
        
    # Isi tim di Babak 1 (round 1)
    round1_matches = next_round_matches
    for i in range(len(round1_matches)):
        m = round1_matches[i]
        
        if 2 * i < T:
            m.tim1_id = teams[2 * i].id
        if 2 * i + 1 < T:
            m.tim2_id = teams[2 * i + 1].id
            
        # Jika salah satu slot kosong (BYE)
        if m.tim1_id and not m.tim2_id:
            m.pemenang_id = m.tim1_id
            m.skor1 = 1
            m.skor2 = 0
            if m.next_match_id:
                advance_winner_to_next_match(m, m.tim1_id)
                
    db.session.commit()


def get_swiss_standings(stage_id):
    """Menghitung klasemen sementara Swiss Stage berdasarkan match yang selesai."""
    stage = TurnamenTahap.query.get(stage_id)
    if not stage:
        return {}
        
    # Inisialisasi data tim
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
        
    # Hitung dari match di stage ini
    matches = TurnamenMatch.query.filter_by(tahap_id=stage_id).all()
    for m in matches:
        if m.pemenang_id:
            # Jika match normal (2 tim)
            if m.tim1_id and m.tim2_id:
                standings[m.tim1_id]["played_against"].add(m.tim2_id)
                standings[m.tim2_id]["played_against"].add(m.tim1_id)
                
                if m.pemenang_id == m.tim1_id:
                    standings[m.tim1_id]["wins"] += 1
                    standings[m.tim2_id]["losses"] += 1
                else:
                    standings[m.tim2_id]["wins"] += 1
                    standings[m.tim1_id]["losses"] += 1
            # Jika BYE
            elif m.tim1_id:
                standings[m.tim1_id]["wins"] += 1
                standings[m.tim1_id]["byes"] += 1
                
    return standings


def pair_swiss_round(stage_id, round_number, default_bo):
    """Melakukan pairing Swiss otomatis untuk ronde berikutnya."""
    standings = get_swiss_standings(stage_id)
    
    # Urutkan tim berdasarkan jumlah kemenangan desc, kekalahan asc
    sorted_teams = sorted(
        standings.values(),
        key=lambda x: (x["wins"], -x["losses"]),
        reverse=True
    )
    
    # Cek ganjil/genap
    has_bye = len(sorted_teams) % 2 != 0
    bye_team_id = None
    
    if has_bye:
        # Cari tim terbawah yang belum pernah mendapat BYE
        for t in reversed(sorted_teams):
            if t["byes"] == 0:
                bye_team_id = t["id"]
                sorted_teams.remove(t)
                break
        # Fallback jika semua sudah dapat bye
        if not bye_team_id and sorted_teams:
            bye_team = sorted_teams.pop()
            bye_team_id = bye_team["id"]
            
    paired = set()
    pairs = []
    
    # Lakukan pairing serakah (greedy pairing)
    for i in range(len(sorted_teams)):
        t1 = sorted_teams[i]
        if t1["id"] in paired:
            continue
            
        # Cari lawan terdekat yang belum pernah dilawan
        opponent = None
        for j in range(i + 1, len(sorted_teams)):
            t2 = sorted_teams[j]
            if t2["id"] in paired:
                continue
            if t2["id"] not in t1["played_against"]:
                opponent = t2
                break
                
        # Fallback: jika semua sudah pernah dilawan, ambil yang terdekat saja
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
            # Tim tidak dapat pasangan (karena stuck), pasangkan dengan tim sisa mana pun
            paired.add(t1["id"])
            for j in range(len(sorted_teams)):
                t2 = sorted_teams[j]
                if t2["id"] not in paired:
                    paired.add(t2["id"])
                    pairs.append((t1["id"], t2["id"]))
                    break
                    
    # Buat match di database
    match_index = 1
    stage = TurnamenTahap.query.get(stage_id)
    
    # Tambah match bye
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
        db.session.add(m)
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
        db.session.add(m)
        match_index += 1
        
    db.session.commit()


# =========================================================================
# API ENDPOINTS
# =========================================================================

@tournament_bp.route("/tournament", methods=["GET"])
@login_required
def list_tournament():
    """Mengambil semua daftar turnamen."""
    try:
        tournaments = Turnamen.query.order_by(Turnamen.dibuat_pada.desc()).all()
        res = []
        for t in tournaments:
            stages_list = [s.to_dict() for s in t.stages]
            teams_count = len(t.teams)
            res.append({
                "id": t.id,
                "nama": t.nama,
                "deskripsi": t.deskripsi,
                "status": t.status,
                "dibuat_pada": t.dibuat_pada.strftime("%Y-%m-%d %H:%M:%S") if t.dibuat_pada else None,
                "stages": stages_list,
                "teams_count": teams_count
            })
        return jsonify({"tournaments": res}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament/<int:t_id>", methods=["GET"])
@login_required
def get_tournament(t_id):
    """Mengambil detail lengkap turnamen beserta stage, tim, match, dan klasemen."""
    try:
        t = Turnamen.query.get(t_id)
        if not t:
            return jsonify({"error": "Turnamen tidak ditemukan"}), 404
            
        stages = [s.to_dict() for s in t.stages]
        teams = [tm.to_dict() for tm in t.teams]
        
        # Ambil semua matches yang dikelompokkan berdasarkan stage
        matches_by_stage = {}
        for s in t.stages:
            stage_matches = TurnamenMatch.query.filter_by(tahap_id=s.id).order_by(TurnamenMatch.round_number, TurnamenMatch.match_number).all()
            matches_by_stage[s.id] = [m.to_dict() for m in stage_matches]
            
        # Hitung klasemen untuk setiap stage Swiss
        standings_by_stage = {}
        for s in t.stages:
            if s.tipe_format == "swiss":
                raw_standings = get_swiss_standings(s.id)
                # Ubah sets menjadi list untuk serialization JSON
                standings_list = []
                for k, v in raw_standings.items():
                    v_dict = dict(v)
                    v_dict["played_against"] = list(v["played_against"])
                    standings_list.append(v_dict)
                # Urutkan berdasarkan wins desc
                standings_list = sorted(standings_list, key=lambda x: (x["wins"], -x["losses"]), reverse=True)
                standings_by_stage[s.id] = standings_list
                
        return jsonify({
            "tournament": t.to_dict(),
            "stages": stages,
            "teams": teams,
            "matches": matches_by_stage,
            "standings": standings_by_stage
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament", methods=["POST"])
@login_required
@admin_required
def create_tournament():
    """Membuat turnamen baru beserta tim dan menginisialisasi stage pertama."""
    data = request.get_json() or {}
    nama = data.get("nama", "").strip()
    deskripsi = data.get("deskripsi", "").strip()
    tipe_jalur = data.get("tipe_jalur", "playoff") # "playoff", "swiss", "multi" (Swiss -> Playoff)
    teams_input = data.get("teams", [])
    default_bo = int(data.get("bo_format", 1))
    
    if not nama:
        return jsonify({"error": "Nama turnamen wajib diisi"}), 400
        
    if len(teams_input) < 2:
        return jsonify({"error": "Minimal harus mendaftarkan 2 tim"}), 400
        
    try:
        # Cek duplikasi nama
        existing = Turnamen.query.filter_by(nama=nama).first()
        if existing:
            return jsonify({"error": f"Turnamen dengan nama '{nama}' sudah ada"}), 400
            
        t = Turnamen(nama=nama, deskripsi=deskripsi, status="aktif")
        db.session.add(t)
        db.session.flush() # Mendapatkan t.id
        
        # Tambah Tim
        db_teams = []
        for t_name in teams_input:
            t_name = t_name.strip()
            if t_name:
                tm = TurnamenTim(turnamen_id=t.id, nama_tim=t_name)
                db.session.add(tm)
                db_teams.append(tm)
        db.session.flush()
        
        # Inisialisasi Tahap Pertama
        if tipe_jalur == "playoff":
            stage = TurnamenTahap(
                turnamen_id=t.id,
                nama="Playoffs",
                tipe_format="single_elimination",
                urutan=1,
                status="aktif"
            )
            db.session.add(stage)
            db.session.flush()
            generate_playoff_bracket(t.id, stage.id, db_teams, default_bo)
            
        elif tipe_jalur == "swiss":
            stage = TurnamenTahap(
                turnamen_id=t.id,
                nama="Swiss Stage",
                tipe_format="swiss",
                urutan=1,
                status="aktif"
            )
            db.session.add(stage)
            db.session.flush()
            
            # Acak tim untuk ronde 1 Swiss
            random_teams = list(db_teams)
            random.shuffle(random_teams)
            
            # Buat match ronde 1
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
                db.session.add(m)
                match_index += 1
                
            for i in range(0, len(random_teams), 2):
                m = TurnamenMatch(
                    turnamen_id=t.id,
                    tahap_id=stage.id,
                    round_number=1,
                    match_number=match_index,
                    tim1_id=random_teams[i].id,
                    tim2_id=random_teams[i+1].id,
                    bo_format=default_bo
                )
                db.session.add(m)
                match_index += 1
                
        elif tipe_jalur == "multi":
            # Tahap 1: Swiss Stage (Aktif)
            stage1 = TurnamenTahap(
                turnamen_id=t.id,
                nama="Group Stage (Swiss)",
                tipe_format="swiss",
                urutan=1,
                status="aktif"
            )
            db.session.add(stage1)
            
            # Tahap 2: Playoffs (Draft)
            stage2 = TurnamenTahap(
                turnamen_id=t.id,
                nama="Playoffs",
                tipe_format="single_elimination",
                urutan=2,
                status="draft"
            )
            db.session.add(stage2)
            db.session.flush()
            
            # Acak tim ronde 1 Swiss
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
                db.session.add(m)
                match_index += 1
                
            for i in range(0, len(random_teams), 2):
                m = TurnamenMatch(
                    turnamen_id=t.id,
                    tahap_id=stage1.id,
                    round_number=1,
                    match_number=match_index,
                    tim1_id=random_teams[i].id,
                    tim2_id=random_teams[i+1].id,
                    bo_format=default_bo
                )
                db.session.add(m)
                match_index += 1
                
        db.session.commit()
        return jsonify({"success": True, "message": f"Turnamen '{nama}' berhasil dibuat", "tournament_id": t.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament/match/<int:match_id>/skor", methods=["POST"])
@login_required
@admin_required
def update_match_skor(match_id):
    """Mengupdate skor pertandingan dan meloloskan pemenang ke babak berikutnya."""
    m = TurnamenMatch.query.get(match_id)
    if not m:
        return jsonify({"error": "Match tidak ditemukan"}), 404
        
    data = request.get_json() or {}
    skor1 = int(data.get("skor1", 0))
    skor2 = int(data.get("skor2", 0))
    pemenang_id = data.get("pemenang_id")
    
    if pemenang_id:
        pemenang_id = int(pemenang_id)
    else:
        # Auto-detect pemenang berdasarkan skor yang lebih tinggi
        if skor1 > skor2:
            pemenang_id = m.tim1_id
        elif skor2 > skor1:
            pemenang_id = m.tim2_id
        else:
            return jsonify({"error": "Skor seri. Silakan tentukan tim pemenang secara manual."}), 400
            
    try:
        m.skor1 = skor1
        m.skor2 = skor2
        m.pemenang_id = pemenang_id
        db.session.commit()
        
        # Jika single elimination playoffs, advance winner otomatis
        if m.tahap.tipe_format == "single_elimination" and m.next_match_id:
            advance_winner_to_next_match(m, pemenang_id)
            
        # Cek apakah seluruh turnamen sudah selesai
        # Jika stage saat ini adalah stage terakhir dan seluruh match memiliki pemenang, ubah status turnamen jadi selesai
        t = m.turnamen
        all_done = True
        
        # Cari stage terakhir
        last_stage = max(t.stages, key=lambda s: s.urutan)
        if last_stage.id == m.tahap_id:
            all_stage_matches = TurnamenMatch.query.filter_by(tahap_id=last_stage.id).all()
            for sm in all_stage_matches:
                if not sm.pemenang_id:
                    all_done = False
                    break
            if all_done:
                last_stage.status = "selesai"
                t.status = "selesai"
                db.session.commit()
                
        return jsonify({"success": True, "message": "Skor pertandingan diperbarui", "match": m.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament/<int:t_id>/swiss/next", methods=["POST"])
@login_required
@admin_required
def next_swiss_round(t_id):
    """Membuka ronde Swiss berikutnya dan melakukan matchmaking otomatis."""
    t = Turnamen.query.get(t_id)
    if not t:
        return jsonify({"error": "Turnamen tidak ditemukan"}), 404
        
    # Cari stage Swiss aktif
    stage = next((s for s in t.stages if s.tipe_format == "swiss" and s.status == "aktif"), None)
    if not stage:
        return jsonify({"error": "Tidak ada Swiss Stage yang sedang aktif pada turnamen ini"}), 400
        
    # Cek apakah ronde saat ini sudah selesai semua match-nya
    matches = TurnamenMatch.query.filter_by(tahap_id=stage.id).all()
    if not matches:
        return jsonify({"error": "Tidak ada pertandingan terdaftar di stage ini"}), 400
        
    current_round = max(m.round_number for m in matches)
    incomplete = TurnamenMatch.query.filter_by(tahap_id=stage.id, round_number=current_round).filter(TurnamenMatch.pemenang_id.is_none()).all()
    if incomplete:
        return jsonify({"error": f"Ronde {current_round} belum selesai. Mohon lengkapi seluruh skor terlebih dahulu."}), 400
        
    try:
        next_round = current_round + 1
        default_bo = matches[0].bo_format
        pair_swiss_round(stage.id, next_round, default_bo)
        return jsonify({"success": True, "message": f"Ronde {next_round} berhasil dibuat"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament/stage/<int:stage_id>/finish", methods=["POST"])
@login_required
@admin_required
def finish_stage(stage_id):
    """Menyelesaikan stage saat ini dan memajukan tim-tim terpilih ke Playoffs (untuk multi-tahap)."""
    stage = TurnamenTahap.query.get(stage_id)
    if not stage:
        return jsonify({"error": "Tahap tidak ditemukan"}), 404
        
    data = request.get_json() or {}
    selected_team_ids = data.get("qualified_team_ids", []) # Daftar id tim yang diloloskan
    
    if not selected_team_ids:
        return jsonify({"error": "Harap pilih tim yang akan diloloskan ke babak berikutnya"}), 400
        
    try:
        stage.status = "selesai"
        t = stage.turnamen
        
        # Cari stage urutan berikutnya
        next_stage = next((s for s in t.stages if s.urutan == stage.urutan + 1), None)
        if next_stage:
            next_stage.status = "aktif"
            db.session.commit()
            
            # Ambil entitas tim dari database yang terpilih
            qualified_teams = TurnamenTim.query.filter(TurnamenTim.id.in_(selected_team_ids)).all()
            
            # Generate Playoffs bracket untuk stage berikutnya
            # Ambil format BO default dari salah satu match stage sebelumnya
            prev_match = TurnamenMatch.query.filter_by(tahap_id=stage_id).first()
            default_bo = prev_match.bo_format if prev_match else 1
            
            generate_playoff_bracket(t.id, next_stage.id, qualified_teams, default_bo)
            msg = f"Tahap {stage.nama} diselesaikan. {len(qualified_teams)} tim diloloskan ke {next_stage.nama}."
        else:
            # Tidak ada stage selanjutnya, turnamen selesai total
            t.status = "selesai"
            db.session.commit()
            msg = f"Turnamen {t.nama} telah selesai."
            
        return jsonify({"success": True, "message": msg}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@tournament_bp.route("/tournament/<int:t_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_tournament(t_id):
    """Menghapus turnamen secara permanen beserta semua data relasinya (cascade)."""
    t = Turnamen.query.get(t_id)
    if not t:
        return jsonify({"error": "Turnamen tidak ditemukan"}), 404
        
    try:
        db.session.delete(t)
        db.session.commit()
        return jsonify({"success": True, "message": f"Turnamen '{t.nama}' berhasil dihapus"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
