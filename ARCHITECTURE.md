# Arsitektur Sistem Landscape 360

Dokumen ini menjelaskan arsitektur teknis dari aplikasi **Landscape 360**, sebuah platform pemetaan dan pelacakan GPS real-time.

## 1. Visualisasi Arsitektur (Diagram)

Berikut adalah representasi visual dari sistem menggunakan diagram Mermaid.

### A. Diagram Konteks Sistem (System Context)
Menggambarkan bagaimana pengguna berinteraksi dengan aplikasi dan layanan eksternal.

```mermaid
graph TD

    %% Actors
    TrackerUser["Pengguna (Tracker)"]
    MonitorUser["Monitor (Admin)"]

    %% Client Side
    subgraph ClientSide["Landscape 360 Web App"]
        UI["React UI"]
        Logic["Business Logic / Services"]
        Store["Zustand State"]
        LocalDB[("IndexedDB Cache")]
    end

    %% Backend Services
    subgraph Backend["Backend Services"]
        Supabase["Supabase (Auth, DB, Realtime)"]
        Mapbox["Mapbox API (Maps)"]
    end

    %% Relationships
    TrackerUser -->|Melacak Posisi| UI
    MonitorUser -->|Memantau User| UI

    UI --> Logic
    Logic --> Store
    Logic --> LocalDB

    Logic -->|WebSocket / HTTP| Supabase
    UI -->|Fetch Tiles| Mapbox
```

### B. Alur Data Tracking (Sequence Diagram)
Menjelaskan bagaimana data lokasi dikirim dari Tracker ke Monitor, termasuk mekanisme **Heartbeat** dan **Smart Reconnect**.

```mermaid
sequenceDiagram
    participant T as Tracker Device
    participant S as Supabase Realtime
    participant M as Monitor Dashboard

    Note over T, M: 1. Normal Broadcast (Online)
    loop Every Interval
        T->>S: Broadcast {lat, lng, speed}
        S->>M: Receive Update
        M->>M: Update Map Marker
    end

    Note over T, M: 2. Heartbeat (Monitor Baru Join)
    M->>S: Subscribe 'tracking-room'
    M->>S: Broadcast 'heartbeat-request'
    S->>T: Forward 'heartbeat-request'
    T->>S: Reply 'heartbeat-response' (Last Known Loc)
    S->>M: Update Map Immediately

    Note over T, M: 3. Smart Reconnect (Sinyal Hilang)
    T->>T: Connection Lost (Buffer Data)
    T->>T: ...Moving...
    T->>S: Reconnect Success (Status: SUBSCRIBED)
    T->>S: Flush Buffered Data (Kirim data tunda)
    S->>M: Receive Buffered Update
```

### C. Skema Database & Role (ER Diagram)
Struktur data untuk manajemen pengguna dan hak akses.

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "Has One"
    
    PROFILES {
        uuid id PK "Reference to auth.users"
        string email
        string role "pengguna360 (User) | monitor360 (Admin)"
        string subscription_tier "Free | Pro | Enterprise"
        string full_name
        timestamp created_at
    }

    TRACKING_LOGS {
        uuid id PK
        uuid user_id FK
        geometry location "PostGIS Point"
        float speed
        float heading
        jsonb metadata "Battery, Accuracy"
        timestamp recorded_at
    }

    PROFILES ||--o{ TRACKING_LOGS : "Logs History"
```

---

## 2. Detail Modul Teknis

### Tech Stack Utama
- **Frontend Framework**: React (TypeScript) + Vite
- **State Management**: Zustand
- **Map Engine**: Mapbox GL JS (`react-map-gl`)
- **Backend & Realtime**: Supabase (PostgreSQL, Auth, Realtime)
- **Styling**: Tailwind CSS

### A. Autentikasi & Role (RBAC)
Sistem menggunakan **Supabase Auth** dengan tingkatan akses berikut:

#### 1. Pengguna Tamu (Guest / Tanpa Login)
-   **Akses**: Terbatas.
-   **Fitur**:
    -   Melihat peta dasar (2D/3D).
    -   Mengubah gaya peta (Streets, Outdoors, Satellite).
    -   Navigasi dasar (Zoom, Pan, Rotate, Tilt).
-   **Batasan**: Tidak bisa menyimpan survey, tidak bisa download peta offline, tidak ada fitur tracking.

#### 2. Pengguna Free (`pengguna360`)
-   **Akses**: Login via Email.
-   **Fitur**:
    -   Menyimpan hingga **2 Survey**.
    -   Download peta offline (Max **1 Region**, **1 MB**).
-   **Batasan**: Fitur GPS Tracking **Dimatikan**.

#### 3. Pengguna Pro (`pengguna360` + Subscription)
-   **Akses**: Berlangganan bulanan ($3.5/mo).
-   **Fitur**:
    -   **GPS Broadcast**: Dapat mengirim lokasi diri sendiri ke server.
    -   Menyimpan hingga **4 Survey**.
    -   Download peta offline (Max **3 Regions**, **10 MB**).
    -   High-Res Export (PNG/PDF).
-   **Batasan**: Hanya bisa melihat lokasi diri sendiri, tidak bisa memantau user lain.

#### 4. Pengguna Enterprise (`monitor360`)
-   **Akses**: Lisensi Korporat ($7/mo).
-   **Fitur**:
    -   **Realtime Monitoring**: Melihat **SEMUA** user aktif di peta secara real-time.
    -   Akses ke **Control Panel** khusus.
    -   Menyimpan hingga **10 Survey**.
    -   Download peta offline (Max **10 Regions**, **25 MB**).
    -   Prioritas Support 24/7.

### B. Mode Konektivitas (Online vs Offline)
Fitur unggulan untuk menangani sinyal tidak stabil:

1.  **Online Mode (Realtime Tracking)**
    -   Menggunakan **WebSockets** untuk komunikasi dua arah.
    -   **Heartbeat Protocol**: Memastikan data langsung muncul saat monitor login.
    -   **Smart Reconnect**: Menyimpan data saat offline dan mengirimnya saat online kembali.

2.  **Offline Mode**
    -   **Map Caching**: Menggunakan **IndexedDB** untuk menyimpan tile peta.
    -   **Local Survey**: Data pengukuran disimpan di state lokal perangkat.

## 3. Struktur Direktori
- `/src/components`: Komponen UI (Map, ControlPanel, Auth).
- `/src/services`: Logika bisnis (TrackerService, MapService).
- `/src/store`: Global state (Zustand).
- `/src/utils`: Utilitas (Offline DB, Geometry calculations).
