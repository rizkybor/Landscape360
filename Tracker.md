# Konfigurasi & Dokumentasi Fitur GPS Tracker

Fitur Realtime GPS Tracking saat ini dikontrol menggunakan **Environment Variable** untuk keamanan deployment.

## 🚀 Cara Testing di Lokal

Fitur ini secara otomatis **AKTIF** di komputer Anda karena saya telah membuat file `.env.local` dengan isi:

```bash
VITE_ENABLE_GPS_TRACKER=true
```

Ini memungkinkan Anda melihat dan menguji fitur GPS Tracking tanpa khawatir fitur ini muncul di Production secara tidak sengaja.

## ⚠️ Keamanan Deployment (Git & Production)

Saat Anda melakukan push ke Git, file `.env.local` **TIDAK AKAN** ikut terupload (karena biasanya di-ignore oleh git).

Artinya:
1.  Di server production (Vercel/Netlify/dll), fitur ini akan **MATI (HIDDEN)** secara default.
2.  Jika Anda ingin mengaktifkannya di Production nanti, Anda cukup menambahkan Environment Variable `VITE_ENABLE_GPS_TRACKER=true` di dashboard hosting Anda.

## 📂 Struktur File Tracker

Fitur ini dibangun menggunakan arsitektur yang terpisah agar tidak mengganggu kode utama peta. Berikut adalah file-file yang bertanggung jawab:

1.  **`src/types/tracker.ts`**
    *   Berisi definisi tipe data (TypeScript Interfaces) untuk paket data GPS.
    *   Berisi konstanta konfigurasi global (`TRACKER_CONFIG`).
2.  **`src/store/useTrackerStore.ts`**
    *   State management (Zustand) untuk menyimpan data lokasi user, history jejak (trail), dan status koneksi.
3.  **`src/services/TrackerService.ts`**
    *   Layanan simulasi backend. Saat ini menggunakan `setInterval` untuk membuat data palsu (mocking).
    *   Di sinilah tempat Anda akan mengintegrasikan **WebSocket** atau **REST API** yang sebenarnya nanti.
4.  **`src/components/LiveTrackerLayer.tsx`**
    *   Komponen Mapbox yang merender Marker user dan Garis Jejak (Polyline).
    *   Menggunakan `requestAnimationFrame` untuk animasi pergerakan marker yang halus (interpolasi).
5.  **`src/components/MapSync.tsx`** (Sebelumnya MapSynchronizer)
    *   Mengelola sinkronisasi state peta agar tidak membebani performa UI utama.

---

## 🔧 Konfigurasi Sistem

Anda dapat mengatur perilaku sistem tracker tanpa mengubah logika kode utama melalui file `src/types/tracker.ts`.

```typescript
export const TRACKER_CONFIG = {
  // Interval update data dari LoRa/Internet (ms)
  // 5000 = 5 detik (Realtime, boros baterai/data)
  // 30000 = 30 detik (Hemat baterai)
  UPDATE_INTERVAL_MS: 5000, 

  // Batas waktu toleransi sinyal hilang (ms)
  // Jika data tidak diterima > 60 detik, status user jadi "Offline" (abu-abu)
  OFFLINE_THRESHOLD_MS: 60000, 
  
  // Jumlah titik riwayat jejak yang disimpan di memori browser
  // Semakin banyak = semakin panjang ekor jejaknya, tapi memakan memori
  MAX_HISTORY_POINTS: 500,
  
  // Aktifkan animasi halus antar titik koordinat
  ENABLE_INTERPOLATION: true,
};
```

## 📱 Fitur Broadcast My GPS

Fitur ini memungkinkan Anda menggunakan perangkat Anda sendiri (Handphone/Laptop) sebagai GPS Tracker.

### Cara Menggunakan
1.  Buka **Control Panel** di aplikasi.
2.  Klik tombol **"Start GPS Tracking"**.
3.  Aktifkan toggle **"Broadcast My GPS"**.
4.  Browser akan meminta izin akses lokasi (**Allow Location Access**).
5.  Setelah diizinkan, marker baru dengan ID **`MY-DEVICE`** akan muncul di peta sesuai lokasi Anda saat ini.
6.  Bawalah perangkat Anda berjalan, marker akan bergerak mengikuti posisi Anda secara real-time.

> **Catatan:** Akurasi tergantung pada GPS perangkat Anda. Pastikan Anda berada di luar ruangan (outdoor) untuk hasil terbaik.

## 📡 Requirements & Integrasi Backend

Fitur ini menggunakan **Supabase Realtime** untuk sinkronisasi data antar pengguna dengan latency rendah (< 100ms).

### 1. Arsitektur Komunikasi
- **Broadcast (Pengguna)**: Client mengirim data lokasi via channel `tracking-room` (Event: `location-update`).
- **Monitoring (Command Center)**: Client dengan role `monitor360` mendengarkan event tersebut dan merender marker di peta.
- **Heartbeat Protocol**:
    1. Monitor baru bergabung -> Kirim `heartbeat-request`.
    2. Semua Tracker aktif merespons dengan `location-update` terakhir mereka.
    3. Peta Monitor langsung terisi tanpa menunggu interval update berikutnya.

### 2. Keamanan (Row Level Security & Policies)
Akses ke channel tracking diatur ketat di sisi aplikasi (`ControlPanel.tsx` & `TrackerService.ts`):
- **Broadcast**: Hanya diizinkan untuk user `pengguna360` dengan status **Pro** atau **Enterprise**.
- **Monitoring**: Hanya diizinkan untuk user `monitor360` dengan status **Enterprise**.
- **Auto-Cutoff**: Jika subscription habis atau user logout, koneksi WebSocket otomatis diputus.

### 3. Format Data (Payload)
Data dikirim dalam format JSON ringkas:

```json
{
  "user_id": "RANGER-01", // atau Email User
  "lat": -7.565,
  "lng": 110.455,
  "alt": 1500,        // (meter)
  "speed": 1.2,       // (m/s)
  "battery": 85,      // 0-100%
  "timestamp": "2024-02-16T10:00:00Z",
  "status": "active"
}
```

### 4. Handling Koneksi & Offline (Smart Reconnect)
Fitur ini dirancang untuk kondisi lapangan yang mungkin memiliki sinyal internet tidak stabil (intermittent).

- **Online-Only**: Secara mendasar, fitur ini membutuhkan koneksi internet (WebSocket) untuk bekerja.
- **Temporary Offline**: Jika sinyal hilang, data lokasi terakhir akan disimpan di memori browser (Buffer).
- **Auto Flush**: Begitu sinyal kembali (`SUBSCRIBED`), sistem otomatis mengirimkan data terakhir yang tersimpan (jika usianya < 60 detik) agar posisi di peta Monitor langsung terupdate.

---

## 🚀 Cara Testing (Role Simulation)

Anda dapat mengubah role user secara manual di database Supabase (`public.profiles`) untuk simulasi:

1. **Menjadi Monitor (Enterprise):**
   ```sql
   UPDATE public.profiles 
   SET status_subscribe = 'Enterprise', status_user = 'monitor360' 
   WHERE email = 'email_anda@example.com';
   ```

2. **Menjadi Tracker (Pro):**
   ```sql
   UPDATE public.profiles 
   SET status_subscribe = 'Pro', status_user = 'pengguna360' 
   WHERE email = 'email_anda@example.com';
   ```

> **Catatan:** Logout dan Login ulang di aplikasi untuk menerapkan perubahan role.
