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

## 📡 Requirements & Integrasi Backend

Untuk membuat fitur ini bekerja dengan data asli (bukan simulasi), Anda perlu menyiapkan:

### 1. Format Data (Payload)
Pastikan Gateway LoRa atau Backend mengirim data JSON dengan format berikut:

```json
{
  "user_id": "RANGER-01",
  "lat": -7.565,
  "lng": 110.455,
  "alt": 1500,        // Opsional (meter)
  "speed": 1.2,       // Opsional (m/s)
  "battery": 85,      // 0-100
  "timestamp": "2024-02-16T10:00:00Z"
}
```

### 2. Integrasi WebSocket (Di `src/services/TrackerService.ts`)
Ganti kode simulasi `setInterval` dengan koneksi WebSocket asli:

```typescript
// Contoh implementasi di src/services/TrackerService.ts
useEffect(() => {
  if (!isLiveTrackingEnabled) return;

  // GANTI URL INI
  const ws = new WebSocket('wss://api.landscape360.com/tracker-stream');

  ws.onmessage = (event) => {
    try {
      const packet = JSON.parse(event.data);
      // Validasi data packet di sini jika perlu
      addOrUpdateTracker(packet);
    } catch (e) {
      console.error("Invalid GPS Packet", e);
    }
  };

  return () => ws.close();
}, [isLiveTrackingEnabled]);
```
