"""Helper script: generate .env dari .env.example dengan SECRET_KEY acak."""
import os
import secrets

env_example = '.env.example'
env_file = '.env'


def build_env(example_text, secret_key, client_api_key):
    """Ganti nilai kunci berdasarkan prefiks; baris lain dipertahankan apa adanya."""
    nilai = {
        'SECRET_KEY=': secret_key,
        'CLIENT_API_KEY=': client_api_key,
        'DEBUG_MODE=': 'False',
    }
    terpakai = set()
    hasil = []
    for baris in example_text.splitlines(keepends=True):
        isi = baris.rstrip('\r\n')
        akhir = baris[len(isi):]
        for prefiks, baru in nilai.items():
            if isi.startswith(prefiks):
                hasil.append(prefiks + baru + akhir)
                terpakai.add(prefiks)
                break
        else:
            hasil.append(baris)
    # Kunci yang tidak ada di contoh tetap ditulis agar aplikasi tidak gagal start.
    for prefiks, baru in nilai.items():
        if prefiks not in terpakai:
            hasil.append(prefiks + baru + '\n')
    return ''.join(hasil)


if __name__ == '__main__':
    if not os.path.exists(env_example):
        print('[WARN] .env.example tidak ditemukan.')
        raise SystemExit(0)

    contoh = open(env_example, encoding='utf-8').read()
    isi_env = build_env(contoh, secrets.token_hex(32), secrets.token_urlsafe(32))
    with open(env_file, 'w', encoding='utf-8') as berkas:
        berkas.write(isi_env)
    print('[OK] File .env berhasil dibuat dengan SECRET_KEY acak.')
