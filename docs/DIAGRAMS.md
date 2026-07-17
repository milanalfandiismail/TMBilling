# Diagram Arsitektur & Alur Sistem TMBilling

Dokumen ini berisi kumpulan diagram lengkap yang mendeskripsikan arsitektur, alur data, dan hubungan entitas di dalam sistem TMBilling.

## 1. End-to-End Data Flow

```mermaid
sequenceDiagram
    participant Browser as Browser (Kasir)
    participant Flask as Flask Server
    participant DB as Database
    participant Tauri as Tauri Client (PC)

    Note over Browser,Tauri: === DASHBOARD FLOW ===
    Browser->>Flask: GET /api/v1/kasir/dashboard/pc
    Flask->>DB: PCService.get_all()
    DB-->>Flask: pc_list
    Flask-->>Browser: JSON {by_grup, pc_list}
    
    Note over Browser,Tauri: === BUKA SESI FLOW ===
    Browser->>Flask: POST /api/v1/kasir/sesi/buka-guest {pc_kode, paket_id}
    Flask->>DB: validate PC + paket
    Flask->>DB: create Sesi + Transaksi
    Flask->>DB: commit()
    Flask-->>Browser: {sesi_id, token, sisa_menit}

    Note over Browser,Tauri: === CLIENT POLLING (5s) ===
    loop Every 5 seconds
        Tauri->>Flask: POST /api/v1/public/client/status {ip, mac}
        Flask->>DB: update last_activity
        Flask->>DB: cek sesi aktif
        DB-->>Flask: sesi or null
        alt sesi ada
            Flask-->>Tauri: {status: "aktif", sisa_waktu: 45}
        else kosong
            Flask-->>Tauri: {status: "kosong", shutdown_timer: 180}
        end
    end

    Note over Browser,Tauri: === UNINSTALL FLOW ===
    Tauri->>Flask: GET /api/v1/kasir/settings/uninstall-token/client
    Flask-->>Tauri: {uninstall_token, emergency_token}
    Tauri->>Tauri: execute_uninstall()
    Tauri->>Flask: kill processes, delete Registry, delete files
```

## 2. System Topology

```mermaid
graph TB
    subgraph "Server Room"
        Flask[Flask Server<br/>Waitress WSGI :7015]
        DB[(SQLite / PostgreSQL)]
        Backups[backups/]
    end

    subgraph "Cloud / External Storage"
        Discord[Discord Webhook]
        WebDAV[WebDAV / Nextcloud]
        GDrive[Google Drive]
        NAS[NAS / Shared Folder]
    end

    subgraph "Kasir"
        Browser[Browser<br/>Dashboard Kasir]
    end

    subgraph "PC Client #1"
        MGCTM1[MGCTM.exe<br/>Guardian 5s]
        mtm1[mtm.exe<br/>Scout 5s]
        Tauri1[TMBilling.exe<br/>Lockscreen UI]
        TMMonitor1[TMMonitor.exe<br/>Telemetry 60s]
    end

    subgraph "PC Client #2"
        MGCTM2[MGCTM.exe]
        mtm2[mtm.exe]
        Tauri2[TMBilling.exe]
        TMMonitor2[TMMonitor.exe]
    end

    Browser -->|HTTP| Flask
    Flask --> DB
    Flask --> Backups

    Flask -->|ZIP Upload| Discord
    Flask -->|ZIP Upload| WebDAV
    Flask -->|ZIP Upload| GDrive
    Flask -->|ZIP Upload| NAS

    MGCTM1 -->|spawn| Tauri1
    MGCTM1 -->|spawn| TMMonitor1
    MGCTM1 -->|spawn| mtm1
    mtm1 -->|monitor| MGCTM1

    MGCTM1 -->|POST /api/v1/public/client/*| Flask
    TMMonitor1 -->|POST /api/v1/public/monitor| Flask

    MGCTM2 -->|POST /api/v1/public/client/*| Flask
    TMMonitor2 -->|POST /api/v1/public/monitor| Flask
```

## 3. Client Polling Loop (5 Detik)

```mermaid
sequenceDiagram
    participant Client as TMBilling.exe (Client)
    participant Server as Flask Server
    participant DB as Database

    Note over Client: Startup
    Client->>Server: POST /api/v1/public/client/identify {ip, mac}
    Server->>DB: cek IP & MAC binding
    DB-->>Server: PC ditemukan / auto-register MAC
    Server-->>Client: {valid: true, pc_kode, grup}

    Note over Client: Loop setiap 5 detik
    loop Every 5 seconds
        Client->>Server: POST /api/v1/public/client/status {ip, mac, role}
        Server->>DB: update last_activity
        Server->>DB: cek sesi aktif
        
        alt Sesi aktif
            DB-->>Server: sesi + sisa_waktu
            Server-->>Client: {status: "aktif", sisa_waktu: 45, nama: "Guest"}
            Client->>Client: Tampilkan overlay billing
        else Tidak ada sesi + admin mode
            DB-->>Server: null
            Server-->>Client: {status: "kosong", shutdown_timer: 180}
            Client->>Client: Tampilkan login screen + timer shutdown
        else Admin mode aktif
            DB-->>Server: is_admin_mode = True
            Server-->>Client: {status: "admin", sisa_waktu: 999999}
            Client->>Client: Tampilkan overlay admin
        end
    end
```

## 4. Uninstaller Flow

```mermaid
graph TD
    A[Jalankan Uninstaller.exe] --> B[Win32 GUI — Input Password]
    B --> C{Online?}
    
    C -->|Ya| D["Fetch token dari Flask API (/api/v1/kasir/settings/uninstall-token/client)"]
    D --> E{Token valid?}
    E -->|Ya| F[Execute Uninstall]
    E -->|Tidak| F
    
    C -->|Tidak| G[Deobfuscate EmergencyToken<br/>dari Registry]
    G --> H{Input == EmergencyToken?}
    H -->|Ya| F
    H -->|Tidak| I[MessageBox — Akses Ditolak]
    I --> B
 
    F --> J[tulis stop.token → sleep 2.5s]
    J --> K[taskkill MGCTM, TMMonitor, TMBilling, mtm → sleep 1.5s]
    K --> L[reg.exe delete HKLM\Software\TMBilling]
    L --> M[Hapus semua file billing]
    M --> N[Hapus MGCTM.lnk dari startup]
    N --> O[Hapus mtm.exe dari AppData]
    O --> P[MessageBox — Sukses]
    P --> Q[Delayed self-delete + deep purge via cmd.exe]
```

## 5. Entity Relationship

```mermaid
erDiagram
    GRUP ||--o{ PC : memiliki
    GRUP ||--o{ MEMBER : memiliki
    GRUP ||--o{ PAKET : memiliki
    PC ||--o| HARDWARE_MONITOR : "di-monitor"
    PC ||--o{ PC_PROCESS : menjalankan
    PC ||--o{ SESI : digunakan
    MEMBER ||--o{ SESI : memiliki
    MEMBER ||--o{ TRANSAKSI : melakukan
    SESI ||--o{ TRANSAKSI : mencatat
    SESI ||--o| PAKET : menggunakan
    TRANSAKSI ||--o| USER : "di-input"
    TRANSAKSI ||--o| PAKET : membeli
```

---
*TMBilling v1.4.4*
