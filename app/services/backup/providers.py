# app/services/backup/providers.py

import os
import shutil
import urllib.request
import urllib.parse
import mimetypes
import uuid
import json
import base64
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from email.utils import parsedate_to_datetime

# =========================================================================
# UTILITIES FOR PURE PYTHON HTTP REQUESTS (NO EXTERNAL DEPENDENCIES)
# =========================================================================

def send_multipart_request(url, fields, files):
    """Sends a multipart/form-data POST request using urllib.request."""
    boundary = uuid.uuid4().hex.encode('utf-8')
    body = []
    
    for name, value in fields.items():
        body.append(b'--' + boundary)
        body.append(f'Content-Disposition: form-data; name="{name}"'.encode('utf-8'))
        body.append(b'')
        body.append(value.encode('utf-8'))
        
    for name, filepath in files.items():
        filename = os.path.basename(filepath)
        mime = mimetypes.guess_type(filepath)[0] or 'application/octet-stream'
        body.append(b'--' + boundary)
        body.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode('utf-8'))
        body.append(f'Content-Type: {mime}'.encode('utf-8'))
        body.append(b'')
        with open(filepath, 'rb') as f:
            body.append(f.read())
            
    body.append(b'--' + boundary + b'--')
    body.append(b'')
    
    payload = b'\r\n'.join(body)
    
    req = urllib.request.Request(url, data=payload, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary.decode("utf-8")}')
    req.add_header('User-Agent', 'TMBilling-Backup-Agent/1.0')
    
    with urllib.request.urlopen(req) as res:
        return res.read().decode('utf-8')


# =========================================================================
# BASE PROVIDER INTERFACE
# =========================================================================

class BaseBackupProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the backup provider."""
        pass

    @abstractmethod
    def upload(self, file_path: str) -> bool:
        """Uploads the zip backup file to destination."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Tests connection by uploading a dummy file or message."""
        pass

    @abstractmethod
    def cleanup(self, max_keep: int = 5):
        """Cleans up old files keeping only the newest max_keep files."""
        pass


# =========================================================================
# DISCORD WEBHOOK PROVIDER
# =========================================================================

class DiscordWebhookProvider(BaseBackupProvider):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    @property
    def name(self) -> str:
        return "Discord Webhook"

    def upload(self, file_path: str) -> bool:
        if not self.webhook_url:
            return False
        
        file_size = os.path.getsize(file_path)
        if file_size > 24 * 1024 * 1024:
            # File is too large for free Discord attachment (> 24MB)
            try:
                fields = {
                    "content": f"⚠️ **TMBilling Backup Alert**\nDatabase backup file (`{os.path.basename(file_path)}`) is too large for Discord attachment ({file_size / (1024*1024):.2f}MB). Please download it manually from the cashier dashboard."
                }
                send_multipart_request(self.webhook_url, fields, {})
                return False
            except Exception as e:
                print(f"[Backup] Discord warning send error: {e}")
                return False

        try:
            fields = {"content": f"📅 **TMBilling Auto-Backup**\nFile: `{os.path.basename(file_path)}`"}
            files = {"file": file_path}
            send_multipart_request(self.webhook_url, fields, files)
            return True
        except Exception as e:
            print(f"[Backup] Discord upload error: {e}")
            return False

    def test_connection(self) -> bool:
        if not self.webhook_url:
            return False
        try:
            fields = {"content": "✅ **TMBilling Connection Test**\nDiscord Webhook is successfully connected!"}
            send_multipart_request(self.webhook_url, fields, {})
            return True
        except Exception as e:
            print(f"[Backup] Discord test connection error: {e}")
            return False

    def cleanup(self, max_keep: int = 5):
        # FIFO cleanup not supported for raw webhooks
        pass


# =========================================================================
# WEBDAV (NEXTCLOUD) PROVIDER
# =========================================================================

class WebDAVProvider(BaseBackupProvider):
    def __init__(self, url: str, username: str = None, password: str = None):
        self.url = url
        self.username = username
        self.password = password
        if self.url and not self.url.endswith('/'):
            self.url += '/'

    @property
    def name(self) -> str:
        return "WebDAV (Nextcloud)"

    def _get_auth_header(self) -> str:
        if self.username and self.password:
            auth_str = f"{self.username}:{self.password}"
            return "Basic " + base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        return None

    def upload(self, file_path: str) -> bool:
        if not self.url:
            return False
        try:
            filename = os.path.basename(file_path)
            upload_url = self.url + urllib.parse.quote(filename)
            
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
                
            req = urllib.request.Request(upload_url, data=file_bytes, method='PUT')
            req.add_header('Content-Type', 'application/octet-stream')
            req.add_header('User-Agent', 'TMBilling-Backup-Agent/1.0')
            
            auth = self._get_auth_header()
            if auth:
                req.add_header('Authorization', auth)
                
            with urllib.request.urlopen(req) as res:
                if res.status in (200, 201, 204):
                    self.cleanup()
                    return True
            return False
        except Exception as e:
            print(f"[Backup] WebDAV upload error: {e}")
            return False

    def test_connection(self) -> bool:
        if not self.url:
            return False
        try:
            # PUT a small test txt file
            test_url = self.url + "tmbilling_test.txt"
            req = urllib.request.Request(test_url, data=b"Test", method='PUT')
            req.add_header('Content-Type', 'text/plain')
            req.add_header('User-Agent', 'TMBilling-Backup-Agent/1.0')
            
            auth = self._get_auth_header()
            if auth:
                req.add_header('Authorization', auth)
                
            with urllib.request.urlopen(req) as res:
                if res.status in (200, 201, 204):
                    # Clean it up immediately
                    del_req = urllib.request.Request(test_url, method='DELETE')
                    if auth:
                        del_req.add_header('Authorization', auth)
                    with urllib.request.urlopen(del_req):
                        pass
                    return True
            return False
        except Exception as e:
            print(f"[Backup] WebDAV test connection error: {e}")
            return False

    def cleanup(self, max_keep: int = 5):
        if not self.url:
            return
        try:
            req = urllib.request.Request(self.url, method='PROPFIND')
            req.add_header('Depth', '1')
            req.add_header('User-Agent', 'TMBilling-Backup-Agent/1.0')
            
            auth = self._get_auth_header()
            if auth:
                req.add_header('Authorization', auth)
                
            with urllib.request.urlopen(req) as res:
                xml_data = res.read()
                root = ET.fromstring(xml_data)
                
                files = []
                ns = {'d': 'DAV:'}
                for response in root.findall('d:response', ns):
                    href = response.find('d:href', ns).text
                    propstat = response.find('d:propstat', ns)
                    if propstat is not None:
                        prop = propstat.find('d:prop', ns)
                        if prop is not None:
                            last_mod = prop.find('d:getlastmodified', ns)
                            is_dir = prop.find('d:resourcetype/d:collection', ns) is not None
                            
                            # Filter files matching warnet backup naming convention
                            if last_mod is not None and not is_dir and "warnet_backup_" in href:
                                dt = parsedate_to_datetime(last_mod.text)
                                files.append((href, dt))
                                
                # Sort descending by date (newest first)
                files.sort(key=lambda x: x[1], reverse=True)
                
                if len(files) > max_keep:
                    for href, _ in files[max_keep:]:
                        # Delete oldest files
                        parsed = urllib.parse.urlparse(self.url)
                        delete_url = f"{parsed.scheme}://{parsed.netloc}{href}"
                        
                        del_req = urllib.request.Request(delete_url, method='DELETE')
                        if auth:
                            del_req.add_header('Authorization', auth)
                        with urllib.request.urlopen(del_req) as del_res:
                            pass
        except Exception as e:
            print(f"[Backup] WebDAV cleanup error: {e}")


# =========================================================================
# GOOGLE DRIVE PROVIDER
# =========================================================================

class GoogleDriveProvider(BaseBackupProvider):
    def __init__(self, client_id: str, client_secret: str, refresh_token: str, folder_id: str = None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.folder_id = folder_id

    @property
    def name(self) -> str:
        return "Google Drive"

    def _get_access_token(self) -> str:
        if not self.client_id or not self.client_secret or not self.refresh_token:
            return None
        try:
            url = "https://oauth2.googleapis.com/token"
            params = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
                "grant_type": "refresh_token"
            }
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request(url, data=data, method='POST')
            req.add_header('Content-Type', 'application/x-www-form-urlencoded')
            
            with urllib.request.urlopen(req) as res:
                res_data = json.loads(res.read().decode('utf-8'))
                return res_data.get("access_token")
        except Exception as e:
            print(f"[Backup] GDrive token refresh error: {e}")
            return None

    def upload(self, file_path: str) -> bool:
        access_token = self._get_access_token()
        if not access_token:
            return False
        try:
            metadata = {
                "name": os.path.basename(file_path)
            }
            if self.folder_id:
                metadata["parents"] = [self.folder_id]
                
            boundary = "tmbilling_gdrive_upload_boundary"
            body = []
            
            body.append(b'--' + boundary.encode('utf-8'))
            body.append(b'Content-Type: application/json; charset=UTF-8')
            body.append(b'')
            body.append(json.dumps(metadata).encode('utf-8'))
            
            body.append(b'--' + boundary.encode('utf-8'))
            body.append(b'Content-Type: application/octet-stream')
            body.append(b'')
            with open(file_path, 'rb') as f:
                body.append(f.read())
                
            body.append(b'--' + boundary.encode('utf-8') + b'--')
            body.append(b'')
            
            payload = b'\r\n'.join(body)
            
            url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
            req = urllib.request.Request(url, data=payload, method='POST')
            req.add_header('Authorization', f'Bearer {access_token}')
            req.add_header('Content-Type', f'multipart/related; boundary={boundary}')
            
            with urllib.request.urlopen(req) as res:
                res_data = json.loads(res.read().decode('utf-8'))
                if "id" in res_data:
                    self.cleanup(access_token=access_token)
                    return True
            return False
        except Exception as e:
            print(f"[Backup] GDrive upload error: {e}")
            return False

    def test_connection(self) -> bool:
        access_token = self._get_access_token()
        if not access_token:
            return False
        try:
            # Query client user info to check if token is valid
            url = "https://www.googleapis.com/oauth2/v3/userinfo"
            req = urllib.request.Request(url, method='GET')
            req.add_header('Authorization', f'Bearer {access_token}')
            with urllib.request.urlopen(req) as res:
                return res.status == 200
        except Exception as e:
            print(f"[Backup] GDrive test connection error: {e}")
            return False

    def cleanup(self, max_keep: int = 5, access_token: str = None):
        if not access_token:
            access_token = self._get_access_token()
        if not access_token:
            return
        try:
            q = "mimeType != 'application/vnd.google-apps.folder' and trashed = false and name contains 'warnet_backup_'"
            if self.folder_id:
                q += f" and '{self.folder_id}' in parents"
                
            url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(q)}&orderBy=createdTime%20desc&fields=files(id,name,createdTime)"
            req = urllib.request.Request(url, method='GET')
            req.add_header('Authorization', f'Bearer {access_token}')
            
            with urllib.request.urlopen(req) as res:
                data = json.loads(res.read().decode('utf-8'))
                files = data.get("files", [])
                
                if len(files) > max_keep:
                    for f in files[max_keep:]:
                        file_id = f["id"]
                        del_url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
                        del_req = urllib.request.Request(del_url, method='DELETE')
                        del_req.add_header('Authorization', f'Bearer {access_token}')
                        with urllib.request.urlopen(del_req):
                            pass
        except Exception as e:
            print(f"[Backup] GDrive cleanup error: {e}")


# =========================================================================
# NAS / LOCAL NETWORK SHARE PROVIDER
# =========================================================================

class NASBackupProvider(BaseBackupProvider):
    def __init__(self, nas_path: str):
        self.nas_path = nas_path

    @property
    def name(self) -> str:
        return "NAS / Network Shared folder"

    def upload(self, file_path: str) -> bool:
        if not self.nas_path:
            return False
        try:
            if not os.path.exists(self.nas_path):
                os.makedirs(self.nas_path, exist_ok=True)
            filename = os.path.basename(file_path)
            dest = os.path.join(self.nas_path, filename)
            shutil.copy2(file_path, dest)
            self.cleanup()
            return True
        except Exception as e:
            print(f"[Backup] NAS upload error: {e}")
            return False

    def test_connection(self) -> bool:
        if not self.nas_path:
            return False
        try:
            if not os.path.exists(self.nas_path):
                os.makedirs(self.nas_path, exist_ok=True)
            test_file = os.path.join(self.nas_path, "tmbilling_test.txt")
            with open(test_file, 'w') as f:
                f.write("Test")
            if os.path.exists(test_file):
                os.remove(test_file)
                return True
            return False
        except Exception as e:
            print(f"[Backup] NAS test connection error: {e}")
            return False

    def cleanup(self, max_keep: int = 5):
        if not self.nas_path or not os.path.exists(self.nas_path):
            return
        try:
            files = [f for f in os.listdir(self.nas_path) if f.startswith("warnet_backup_") and f.endswith(".zip")]
            files.sort(key=lambda x: os.path.getmtime(os.path.join(self.nas_path, x)), reverse=True)
            if len(files) > max_keep:
                for f in files[max_keep:]:
                    path = os.path.join(self.nas_path, f)
                    if os.path.exists(path):
                        os.remove(path)
        except Exception as e:
            print(f"[Backup] NAS cleanup error: {e}")
