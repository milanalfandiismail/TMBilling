# app/services/arsip/arsip_service.py

"""Service agregasi data terarsip untuk tab Diarsipkan."""

from app.repositories.arsip import ArsipRepository


class ArsipService:
    """Mengubah baris terarsip menjadi payload JSON per kategori."""

    @staticmethod
    def get_arsip():
        data = ArsipRepository.get_all_arsip()
        result = {kategori: [item.to_dict() for item in items]
                  for kategori, items in data.items()
                  if kategori != "grup"}
        result["grup"] = [
            {
                "id": g.id,
                "nama": g.nama,
                "keterangan": g.keterangan,
                "warna": g.warna,
                "aktif": g.aktif,
            }
            for g in data["grup"]
        ]
        return result
