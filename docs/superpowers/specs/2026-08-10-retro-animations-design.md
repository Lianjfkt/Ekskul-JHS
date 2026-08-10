# Rencana Desain Efek Animasi Retro (PICO-8 Theme)

Dokumen ini merinci penambahan efek animasi bergaya retro 8-bit/pixel-art pada aplikasi Manajemen Ekskul JHS. Animasi ini dirancang agar sejalan dengan estetika visual Press Start 2P, VT323, dan skema warna PICO-8.

## Pendekatan Desain

Gaya pixel art membutuhkan animasi bertahap (stepped/patah-patah) dan menolak pergerakan halus (smooth linear transitions). Hal ini sesuai dengan properti `transition: none !important` yang ada di stylesheet dasar kita.

Kita akan menggunakan keyframe CSS bertahap (`steps(N)`) untuk efek-efek ini.

## Perubahan yang Diusulkan

### 1. Stylesheet Global

#### [MODIFY] [index.css](file:///media/lian/Ubuntu/Ekskul-JHS/src/index.css)

Kita akan menambahkan utilitas animasi berikut:
- **`pixel-shake`**: Animasi guncangan layar bertahap 8-bit untuk efek error/peringatan.
- **`pixel-pop`**: Efek kemunculan modal atau popup dengan perbesaran bertahap (stepped scaling).
- **`pixel-xp-float`**: Animasi melayang untuk teks "+1 XP" atau penanda aksi berhasil (seperti absen terisi).
- **`pixel-spin-stepped`**: Rotasi berputar bertahap (8 arah) untuk mengganti spinner modern yang terlalu mulus.
- **Hover effects**: Efek angkat/dorong interaktif retro pada card link.

```css
@keyframes pixel-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-4px, 2px); }
  40% { transform: translate(4px, -2px); }
  60% { transform: translate(-2px, -2px); }
  80% { transform: translate(2px, 2px); }
}

@keyframes pixel-pop {
  0% { transform: scale(0.85); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes pixel-xp-float {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(-24px); opacity: 0; }
}

@keyframes pixel-spin-stepped {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-pixel-shake {
  animation: pixel-shake 0.3s steps(4) 1;
}

.animate-pixel-pop {
  animation: pixel-pop 0.2s steps(3) forwards;
}

.animate-pixel-xp-float {
  animation: pixel-xp-float 1s steps(6) forwards;
}

.animate-pixel-spin-stepped {
  animation: pixel-spin-stepped 1s steps(8) infinite;
}

/* Hover state retro untuk Card interaktif */
.pixel-card-interactive {
  cursor: pointer;
}
.pixel-card-interactive:hover {
  transform: translate(-2px, -2px);
  box-shadow:
    inset -3px -3px 0 0 rgba(0, 0, 0, 0.4),
    inset 3px 3px 0 0 rgba(255, 255, 255, 0.12),
    6px 6px 0 0 var(--pixel-blue);
}
.pixel-card-interactive:active {
  transform: translate(2px, 2px);
  box-shadow:
    inset -3px -3px 0 0 rgba(255, 255, 255, 0.1),
    inset 3px 3px 0 0 rgba(0, 0, 0, 0.4);
}
```

### 2. Komponen UI dan Halaman

#### [MODIFY] [button.jsx](file:///media/lian/Ubuntu/Ekskul-JHS/src/components/ui/button.jsx)
Memastikan tombol loading menggunakan `animate-pixel-spin-stepped` untuk ikon refresh/spinner.

#### [MODIFY] Halaman Loading & Progress
Meningkatkan visual loading indicator dengan bouncy pixel block.

#### [MODIFY] Feedback Sukses / Teks Melayang (XP Float Style)
Ketika absensi berhasil dilakukan atau status diubah, tambahkan indikator "+1 Absen" / "Sukses!" bergaya RPG melayang dengan `animate-pixel-xp-float`.

## Rencana Verifikasi

### Pengujian Manual
1. Membuka halaman absensi/dashboard untuk memeriksa animasi tombol.
2. Membuka modal dan memicu validasi error untuk memastikan `pixel-shake` dan `pixel-pop` berfungsi.
3. Mencoba merekam absensi untuk memicu animasi teks "+1 Absen" yang melayang.
