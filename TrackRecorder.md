# Track Recorder (Online & Offline)

Track Recorder merekam **jejak GPS pribadi** (seperti Strava / Gaia GPS): rute, jarak, durasi, kecepatan, dan elevasi. Fitur ini **terpisah** dari Live Tracking / Monitoring (`Tracker.md`): tidak mengirim lokasi realtime ke monitor, dan tidak bergantung pada `VITE_ENABLE_GPS_TRACKER`.

## Hak Akses

| Akun | Akses |
|---|---|
| Free | ❌ Tombol terkunci, label "Hubungi Admin" |
| Pro | ✅ |
| Enterprise (User maupun Monitor) | ✅ |
| Admin (`profiles.is_admin`) | ✅ |

Dicek di dua lapis:
1. **UI**: `canUseTrackRecorder()` di `src/store/useTrackRecorderStore.ts`.
2. **Database**: fungsi `can_use_track_recorder()` + RLS di tabel `recorded_tracks`. Jadi walaupun UI diakali, server tetap menolak.

Jika plan turun (mis. Pro → Free) saat sedang merekam, rekaman **di-pause, bukan dihapus**. Track lama tetap bisa dilihat & dihapus.

## Konsep: Local-first

Setiap titik GPS yang diterima **langsung disimpan di perangkat (IndexedDB)** sebelum hal lain. Karena itu rekaman aman walau sinyal hilang, browser di-refresh, aplikasi ditutup, atau HP mati.

| Mode | Penyimpanan | Sinkron ke cloud |
|---|---|---|
| **Online** | Perangkat + cloud | Otomatis tiap ±60 detik selama merekam, saat selesai, dan saat sinyal kembali |
| **Offline** | Perangkat saja | Tidak otomatis. Bisa di-upload manual dari tab **My Tracks** |

Mode Online tetap bisa dipakai tanpa sinyal: data menunggu di perangkat (status *Waiting to sync*) dan dikirim saat online lagi.

## Alur Pemakaian

1. Control Panel → **Track Recorder**.
2. Tab **Record**: isi nama (opsional), pilih **Online** / **Offline**, tekan **Start Recording**.
3. Selama merekam: waktu, jarak, waktu bergerak, kecepatan rata-rata, elevasi naik/turun, ketinggian, akurasi GPS, status sinkron.
   - **Pause / Resume**: jeda tidak dihitung dan garis tidak disambung melewati jeda (segmen baru).
   - **Finish** → simpan. **Discard** → hapus rekaman.
   - Panel bisa ditutup; muncul indikator kecil **REC** di bawah layar, rekaman tetap berjalan.
4. Tab **My Tracks**: lihat di peta (zoom otomatis, titik start hijau / finish merah), ekspor **GPX**, upload ke cloud, ganti nama, hapus (juga dari cloud).

Jika aplikasi tertutup saat merekam, saat dibuka lagi rekaman **dipulihkan dalam status Paused**; tekan Resume untuk melanjutkan.

```mermaid
sequenceDiagram
    participant GPS as GPS Perangkat
    participant S as useTrackRecorderStore
    participant DB as IndexedDB
    participant C as Supabase (recorded_tracks)

    GPS->>S: watchPosition (fix)
    S->>S: Filter (akurasi, jitter, lonjakan) + hitung statistik
    S->>DB: Simpan titik + track (antrian berurutan)
    alt Mode Online & ada sinyal
        loop Tiap 60 detik / saat Finish / event 'online'
            S->>C: upsert seluruh track (idempoten)
        end
    else Offline / tanpa sinyal
        Note over S,DB: Tetap di perangkat (local / pending)
    end
```

## Penyaringan & Perhitungan

Konfigurasi di `TRACK_RECORDER_CONFIG` (`src/types/trackRecorder.ts`):

| Konstanta | Default | Fungsi |
|---|---|---|
| `MAX_ACCURACY_M` | 50 m | Titik dengan akurasi lebih buruk diabaikan |
| `MIN_DISTANCE_M` | 5 m | Abaikan gerakan kecil (jitter saat diam) |
| `MAX_SPEED_MS` | 70 m/s | Tolak lonjakan posisi yang mustahil |
| `ELEVATION_THRESHOLD_M` | 3 m | Elevasi naik/turun baru dihitung jika berubah ≥ 3 m (meredam noise GPS) |
| `MOVING_SPEED_MS` | 0.3 m/s | Di bawah ini dianggap diam (tidak masuk "Moving") |
| `MAX_MOVING_GAP_MS` | 120 s | Jeda antar titik lebih lama tidak dihitung bergerak |
| `AUTO_SYNC_INTERVAL_MS` | 60 s | Interval upload mode Online |

Saat merekam, layar dijaga tetap menyala (Wake Lock API) bila browser mendukung.

## Struktur File

| File | Tanggung jawab |
|---|---|
| `src/types/trackRecorder.ts` | Tipe data (`RecordedTrack`, `TrackPoint`, status) & `TRACK_RECORDER_CONFIG` |
| `src/utils/trackRecorderGeo.ts` | Fungsi murni: jarak (haversine), filter titik, statistik, segmen, GPX, format |
| `src/utils/trackRecorderDb.ts` | Penyimpanan perangkat (IndexedDB `track-recorder-db`: `tracks`, `points`) |
| `src/services/trackRecorderSync.ts` | Sinkron cloud (tabel `recorded_tracks`) |
| `src/store/useTrackRecorderStore.ts` | State & aksi: start/pause/resume/finish/discard, pemulihan, sync, list, hapus, GPX, `canUseTrackRecorder` |
| `src/services/TrackRecorderService.ts` | Hook latar belakang: GPS `watchPosition`, Wake Lock, auto-sync, login/logout & hak akses |
| `src/components/TrackRecorderLayer.tsx` | Gambar di peta: jejak aktif (oranye), posisi + lingkaran akurasi, track tersimpan (cyan) |
| `src/components/TrackRecorderPanel.tsx` | UI panel (Record / My Tracks) + indikator REC |
| `supabase/migrations/20261024000000_create_recorded_tracks.sql` | Tabel, index, fungsi akses, RLS |

Dipasang di `MapBoxContainer.tsx` (service, layer, panel) dan `ControlPanel.tsx` (tombol).

## Data Cloud

Tabel `recorded_tracks`: satu baris per track. Titik disimpan ringkas di kolom `points` (JSONB) sebagai `[lng, lat, alt, timestamp_ms, accuracy_m, segment]`. Upload selalu meng-*upsert* seluruh track, jadi aman diulang saat koneksi putus-nyambung.

RLS: user hanya bisa melihat/menghapus track miliknya; membuat/mengubah hanya jika Pro, Enterprise, atau admin.

## Setup

1. Jalankan migration `supabase/migrations/20261024000000_create_recorded_tracks.sql` di Supabase SQL Editor (butuh migration `20261023000000_restrict_profile_self_update.sql` yang menambah `is_admin`).
2. Tidak ada env tambahan.

## Testing

```bash
npx vitest run src/utils/trackRecorderGeo.test.ts src/store/useTrackRecorderStore.test.ts src/components/TrackRecorderPanel.test.tsx
```

Untuk uji lapangan: buka di HP (HTTPS wajib untuk GPS), izinkan lokasi, lalu coba mode Offline dengan mode pesawat menyala.
