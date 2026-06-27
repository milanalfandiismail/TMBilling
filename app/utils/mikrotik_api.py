import socket
import hashlib
import binascii

class MikroTikAPIClient:
    """Klien Protokol Socket Murni untuk MikroTik RouterOS API."""
    
    def __init__(self, host, username, password, port=8728):
        self.host = host
        self.username = username
        self.password = password
        self.port = int(port)
        self.sock = None

    def _encode_length(self, length):
        if length < 0x80:
            return bytes([length])
        elif length < 0x4000:
            length |= 0x8000
            return bytes([(length >> 8) & 0xFF, length & 0xFF])
        elif length < 0x200000:
            length |= 0xC00000
            return bytes([(length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])
        elif length < 0x10000000:
            length |= 0xE0000000
            return bytes([(length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])
        else:
            return bytes([0xF0, (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])

    def _decode_length(self):
        b = self.sock.recv(1)
        if not b:
            return 0
        c = b[0]
        if (c & 0x80) == 0x00:
            return c
        elif (c & 0xC0) == 0x80:
            b2 = self.sock.recv(1)[0]
            return ((c & 0x3F) << 8) | b2
        elif (c & 0xE0) == 0xC0:
            b2 = self.sock.recv(1)[0]
            b3 = self.sock.recv(1)[0]
            return ((c & 0x1F) << 16) | (b2 << 8) | b3
        elif (c & 0xF0) == 0xE0:
            b2 = self.sock.recv(1)[0]
            b3 = self.sock.recv(1)[0]
            b4 = self.sock.recv(1)[0]
            return ((c & 0x0F) << 24) | (b2 << 16) | (b3 << 8) | b4
        else:
            return 0

    def _write_word(self, w):
        b = w.encode('utf-8')
        self.sock.sendall(self._encode_length(len(b)))
        self.sock.sendall(b)

    def _read_word(self):
        length = self._decode_length()
        if length == 0:
            return ''
        data = b''
        while len(data) < length:
            chunk = self.sock.recv(length - len(data))
            if not chunk:
                break
            data += chunk
        return data.decode('utf-8', errors='replace')

    def send_sentence(self, words):
        for w in words:
            self._write_word(w)
        self.sock.sendall(b'\x00')

    def read_sentence(self):
        words = []
        while True:
            w = self._read_word()
            if w == '':
                break
            words.append(w)
        return words

    def talk(self, words):
        self.send_sentence(words)
        res = []
        while True:
            sentence = self.read_sentence()
            if not sentence:
                break
            res.append(sentence)
            if sentence[0] == '!done' or sentence[0] == '!fatal':
                break
        return res

    def login(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(5.0)
        self.sock.connect((self.host, self.port))

        # Coba cara login baru (ROS v6.43+ / v7)
        res = self.talk(["/login", "=name=" + self.username, "=password=" + self.password])
        
        # Coba cara lama (ROS < 6.43) dengan tantangan CHAP jika diberikan respon =ret=
        if res and res[-1][0] == '!done':
            has_ret = False
            challenge = None
            for sentence in res:
                for word in sentence:
                    if word.startswith('=ret='):
                        has_ret = True
                        challenge = word[5:]
                        
            if has_ret and challenge:
                md = hashlib.md5()
                md.update(b'\x00')
                md.update(self.password.encode('utf-8'))
                md.update(binascii.unhexlify(challenge))
                response = binascii.hexlify(md.digest()).decode('utf-8')
                res = self.talk(["/login", "=name=" + self.username, "=response=00" + response])
                
        # Validasi akhir apakah sukses
        if res and res[-1][0] == '!done' and not any(w.startswith('=ret=') for s in res for w in s):
            return True
            
        raise Exception(f"MikroTik Login failed: {res}")

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        self.sock = None

    def get_user(self, username):
        """Mendapatkan data user hotspot berdasarkan nama."""
        res = self.talk(["/ip/hotspot/user/print", f"?name={username}"])
        for sentence in res:
            if sentence[0] == '!re':
                user_dict = {}
                for attr in sentence[1:]:
                    if attr.startswith('='):
                        parts = attr[1:].split('=', 1)
                        if len(parts) == 2:
                            user_dict[parts[0]] = parts[1]
                return user_dict
        return None

    def add_user(self, username, password, profile="default"):
        """Menambahkan user baru ke hotspot."""
        res = self.talk([
            "/ip/hotspot/user/add", 
            f"=name={username}", 
            f"=password={password}", 
            f"=profile={profile}"
        ])
        if res[-1][0] == '!trap':
            raise Exception(f"Failed to add user: {res}")
        return res[-1][0] == '!done'

    def set_user_password(self, uid, password):
        """Mengubah password user yang sudah ada."""
        res = self.talk(["/ip/hotspot/user/set", f"=.id={uid}", f"=password={password}"])
        if res[-1][0] == '!trap':
            raise Exception(f"Failed to set user: {res}")
        return res[-1][0] == '!done'

    def remove_user(self, uid):
        """Menghapus user hotspot."""
        res = self.talk(["/ip/hotspot/user/remove", f"=.id={uid}"])
        if res[-1][0] == '!trap':
            raise Exception(f"Failed to remove user: {res}")
        return res[-1][0] == '!done'

    def test_connection(self):
        """Test koneksi dan login."""
        try:
            if self.login():
                return True, "Koneksi sukses"
        except Exception as e:
            return False, str(e)
        finally:
            self.close()
        return False, "Unknown error"
