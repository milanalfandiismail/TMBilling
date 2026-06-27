"""Service untuk Owner Analytics Dashboard."""

from datetime import datetime, timedelta
from app.models import db
from app.models.transaksi.transaksi import Transaksi
from app.models.sesi.sesi import Sesi
from app.models.member.member import Member
from app.models.paket.paket import Paket
from app.models.menu.menu import TransaksiMenu
from app.models.user.user import User
from app.utils.timezone_utils import now_utc, get_display_tz, display_in_tz, UTC
from sqlalchemy import func


class OwnerAnalyticsService:

    @staticmethod
    def parse_dates(start_str=None, end_str=None):
        tz = get_display_tz()
        now_aware = now_utc().astimezone(tz)
        
        if end_str:
            try: 
                end_dt = datetime.strptime(end_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, tzinfo=tz)
            except: 
                end_dt = now_aware
        else:
            end_dt = now_aware
            
        if start_str:
            try: 
                start_dt = datetime.strptime(start_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0, tzinfo=tz)
            except: 
                start_dt = (end_dt - timedelta(days=6)).replace(hour=0, minute=0, second=0)
        else:
            start_dt = (end_dt - timedelta(days=6)).replace(hour=0, minute=0, second=0)
            
        start_utc = start_dt.astimezone(UTC).replace(tzinfo=None)
        end_utc = end_dt.astimezone(UTC).replace(tzinfo=None)
        return start_utc, end_utc

    @staticmethod
    def _daily_labels(start, end):
        labels, total_days = [], (end - start).days + 1
        for i in range(total_days):
            d = (start + timedelta(days=i)).date()
            labels.append(d.strftime('%d/%m/%Y'))
        return labels

    @staticmethod
    def get_pendapatan_harian(start, end):
        billing = db.session.query(Transaksi.dibuat_pada, Transaksi.jumlah)\
            .filter(Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end, Transaksi.jumlah > 0).all()

        kantin = db.session.query(TransaksiMenu.tanggal, TransaksiMenu.total_harga)\
            .filter(TransaksiMenu.tanggal >= start, TransaksiMenu.tanggal <= end).all()

        b_map, k_map = {}, {}
        
        for b in billing:
            if b.dibuat_pada:
                local_dt = display_in_tz(b.dibuat_pada)
                dt_iso = local_dt.date().isoformat()
                b_map[dt_iso] = b_map.get(dt_iso, 0) + b.jumlah
            
        for k in kantin:
            if k.tanggal:
                local_dt = display_in_tz(k.tanggal)
                dt_iso = local_dt.date().isoformat()
                k_map[dt_iso] = k_map.get(dt_iso, 0) + k.total_harga

        labels, bd, kd = [], [], []
        start_local = display_in_tz(start).date()
        end_local = display_in_tz(end).date()
        
        total_days = (end_local - start_local).days + 1
        for i in range(total_days):
            d = start_local + timedelta(days=i)
            dt_iso = d.isoformat()
            labels.append(d.strftime('%d/%m/%Y'))
            bd.append(b_map.get(dt_iso, 0))
            kd.append(k_map.get(dt_iso, 0))
            
        return {'labels': labels, 'billing': bd, 'kantin': kd}

    @staticmethod
    def get_heatmap_jam_sibuk(start, end):
        sessions = Sesi.query.filter(Sesi.mulai_pada >= start, Sesi.mulai_pada <= end).all()
        jam_counts = {}
        for s in sessions:
            if s.mulai_pada:
                local_dt = display_in_tz(s.mulai_pada)
                jam_counts[local_dt.hour] = jam_counts.get(local_dt.hour, 0) + 1
        mx = max(jam_counts.values()) if jam_counts else 1
        labels, data = [], []
        for j in range(24):
            labels.append(f'{j:02d}:00')
            data.append(round((jam_counts.get(j, 0) / mx) * 100, 1))
        return {'labels': labels, 'data': data}

    @staticmethod
    def get_member_trend(start, end):
        members = Member.query.filter(
            (Member.dibuat_pada >= start) | (Member.kadaluarsa_pada >= start)
        ).all()
        
        b_map, k_map = {}, {}
        for m in members:
            if m.dibuat_pada and start <= m.dibuat_pada <= end:
                local_dt = display_in_tz(m.dibuat_pada)
                dt_iso = local_dt.date().isoformat()
                b_map[dt_iso] = b_map.get(dt_iso, 0) + 1
                
            if m.kadaluarsa_pada and start <= m.kadaluarsa_pada <= end:
                local_dt = display_in_tz(m.kadaluarsa_pada)
                dt_iso = local_dt.date().isoformat()
                k_map[dt_iso] = k_map.get(dt_iso, 0) + 1

        labels, bd, kd = [], [], []
        start_local = display_in_tz(start).date()
        end_local = display_in_tz(end).date()
        
        total_days = (end_local - start_local).days + 1
        for i in range(total_days):
            d = start_local + timedelta(days=i)
            dt_iso = d.isoformat()
            labels.append(d.strftime('%d/%m/%Y'))
            bd.append(b_map.get(dt_iso, 0))
            kd.append(k_map.get(dt_iso, 0))
            
        return {'labels': labels, 'baru': bd, 'kadaluarsa': kd}

    @staticmethod
    def get_top_paket(start, end):
        r = db.session.query(Paket.nama, func.count(Transaksi.id).label('total')
        ).join(Transaksi, Transaksi.paket_id == Paket.id
        ).filter(Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end, Transaksi.is_refunded == False
        ).group_by(Paket.id, Paket.nama).order_by(func.count(Transaksi.id).desc()).limit(5).all()
        if r:
            ids = [p.id for p in Paket.query.filter(Paket.nama.in_([x.nama for x in r])).all()]
            other = db.session.query(func.count(Transaksi.id)).filter(
                Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end,
                Transaksi.is_refunded == False, ~Transaksi.paket_id.in_(ids)
            ).scalar() or 0
        else:
            other = 0
        labels = [x.nama for x in r] + (['Lainnya'] if other > 0 else [])
        data = [x.total for x in r] + ([other] if other > 0 else [])
        colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'][:len(labels)]
        return {'labels': labels, 'data': data, 'colors': colors}

    @staticmethod
    def get_pendapatan_per_kasir(start, end):
        r = db.session.query(User.nama_lengkap, func.coalesce(func.sum(Transaksi.jumlah), 0).label('total')
        ).join(Transaksi, Transaksi.user_id == User.id
        ).filter(Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end, Transaksi.jumlah > 0
        ).group_by(User.id, User.nama_lengkap).order_by(func.sum(Transaksi.jumlah).desc()).all()
        return {'labels': [x.nama_lengkap for x in r], 'data': [x.total for x in r]}

    @staticmethod
    def get_refund_rate(start, end):
        total = Transaksi.query.filter(Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end).count()
        refund = Transaksi.query.filter(Transaksi.dibuat_pada >= start, Transaksi.dibuat_pada <= end, Transaksi.is_refunded == True).count()
        return {'total': total, 'refund': refund, 'refund_rate': round((refund / total * 100), 1) if total > 0 else 0}

    @staticmethod
    def get_all_analytics(start_str=None, end_str=None):
        start, end = OwnerAnalyticsService.parse_dates(start_str, end_str)
        return {
            'pendapatan_harian': OwnerAnalyticsService.get_pendapatan_harian(start, end),
            'heatmap_jam_sibuk': OwnerAnalyticsService.get_heatmap_jam_sibuk(start, end),
            'member_trend': OwnerAnalyticsService.get_member_trend(start, end),
            'top_paket': OwnerAnalyticsService.get_top_paket(start, end),
            'pendapatan_per_kasir': OwnerAnalyticsService.get_pendapatan_per_kasir(start, end),
            'refund_rate': OwnerAnalyticsService.get_refund_rate(start, end),
        }
