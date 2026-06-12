"""Helper script: generate .env dari .env.example dengan SECRET_KEY acak."""
import secrets
import os

env_example = '.env.example'
env_file = '.env'

if not os.path.exists(env_example):
    print('[WARN] .env.example tidak ditemukan.')
    exit(0)

content = open(env_example, encoding='utf-8').read()
content = content.replace(
    'SECRET_KEY=ganti-dengan-rahasia-abang-yang-panjang-dan-unik',
    'SECRET_KEY=' + secrets.token_hex(32)
)
content = content.replace(
    'DEBUG_MODE=True',
    'DEBUG_MODE=False'
)
open(env_file, 'w', encoding='utf-8').write(content)
print('[OK] File .env berhasil dibuat dengan SECRET_KEY acak.')
