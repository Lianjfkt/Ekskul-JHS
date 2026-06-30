---
name: pixel-design
description: Use this skill whenever the user wants to design or build a UI with a "pixel" aesthetic — pixel art / 8-bit / 16-bit retro game style, OR a pixel-perfect, crisp, grid-aligned modern UI. Trigger this skill any time the user mentions "pixel art", "retro", "8-bit", "16-bit", "pixelated", "game UI", "arcade style", "pixel-perfect", "crisp UI", or asks for a web app / landing page / dashboard / game interface with a distinctive pixel look, even if they don't use the word "pixel" explicitly but describe a retro-game or blocky/grid visual style. Applies to HTML/CSS/JS and React web projects.
---

# Pixel Design

Panduan untuk membangun UI dengan estetika "pixel" — baik gaya **pixel art retro** (8-bit/16-bit, ala game jadul) maupun gaya **pixel-perfect modern** (rapi, presisi, grid-based, tanpa nuansa retro). Pilih salah satu mode di bawah berdasarkan konteks permintaan user, atau tanyakan jika ambigu.

## Langkah 0: Tentukan mode

Sebelum menulis kode, putuskan mode mana yang dipakai:

- **Mode Retro Pixel Art** — jika user menyebut kata seperti "retro", "8-bit", "16-bit", "pixel art", "game jadul", "arcade", "NES/SNES style", atau project terkait game/landing page yang playful & nostalgic.
- **Mode Pixel-Perfect Modern** — jika user menyebut "pixel-perfect", "crisp", "rapi", "presisi", atau ingin UI modern (dashboard, SaaS, form) yang tetap disiplin secara grid/spacing tapi TIDAK retro.

Jika ambigu, tanyakan singkat ke user, atau default ke Mode Retro Pixel Art karena itu yang biasanya dimaksud dengan istilah "pixel design".

Jangan campur kedua mode dalam satu UI kecuali user secara eksplisit memintanya.

---

## Mode 1: Retro Pixel Art

### Prinsip inti
- Semua elemen visual harus terasa dibangun dari grid piksel besar, bukan vektor halus modern.
- Hindari border-radius besar, gradient halus/soft shadow modern, font sans-serif modern yang smooth. Itu akan merusak ilusi retro.
- Tepi tegas (hard edges), warna solid/flat, kontras tinggi.

### Teknis implementasi (HTML/CSS/JS atau React)

1. **Disable anti-aliasing pada gambar pixel art**
   ```css
   img, canvas {
     image-rendering: pixelated;
     image-rendering: crisp-edges; /* fallback */
   }
   ```

2. **Font pixel**
   - Gunakan font bitmap/pixel seperti "Press Start 2P", "VT323", "Pixelify Sans", atau "Silkscreen" dari Google Fonts.
   - Import via `<link>` atau `@font-face`, lalu set sebagai `font-family` utama untuk heading/UI text.
   - Untuk body text panjang, "VT323" atau "Pixelify Sans" lebih nyaman dibaca daripada "Press Start 2P" yang sangat dekoratif — gunakan "Press Start 2P" hanya untuk judul/tombol pendek.

3. **Border ala 8-bit (bukan border-radius halus)**
   - Gunakan teknik "pixel border" dengan `box-shadow` berlapis atau `border-image` step, bukan `border-radius`.
   - Contoh sederhana border kotak retro:
   ```css
   .pixel-box {
     border: 4px solid #000;
     box-shadow:
       inset -4px -4px 0 0 rgba(0,0,0,0.3),
       inset 4px 4px 0 0 rgba(255,255,255,0.3);
     border-radius: 0;
   }
   ```
   - Untuk border bertingkat ala panel game (Mario/Zelda style), gunakan teknik `clip-path` dengan polygon bertangga, atau border-image dari sprite 9-slice.

4. **Palet warna**
   - Pakai palet terbatas (8–16 warna), warna solid, saturasi tinggi, kontras tegas. Jangan pakai gradient halus.
   - Referensi palet siap pakai: Lospec Palette List (lospec.com/palette-list) — sarankan palet seperti "PICO-8", "Endesga 32", atau "Resurrect 64" tergantung mood.

5. **Tombol & elemen interaktif**
   - State hover/active harus terasa "ditekan" — geser elemen 2-4px ke bawah/kanan saat `:active`, atau tukar warna shadow inset.
   ```css
   .pixel-btn:active {
     transform: translate(2px, 2px);
     box-shadow: none;
   }
   ```
   - Animasi sebaiknya stepped (frame-by-frame terasa), bukan easing halus. Gunakan `steps()` di `transition-timing-function` atau `animation-timing-function` untuk efek "patah-patah" khas sprite animation:
   ```css
   animation: blink 1s steps(2) infinite;
   ```

6. **Background & dekorasi**
   - Gunakan pola pixel berulang (tile) untuk background, bukan gambar foto/gradient halus.
   - Bintang, awan, cloud, dsb dibuat dari shape kotak-kotak (box-shadow trick atau grid div kecil), bukan SVG smooth.

7. **Cursor**
   - Pertimbangkan custom cursor pixel (`cursor: url('pixel-cursor.png'), auto;`) untuk memperkuat nuansa retro, terutama untuk landing page game.

8. **Sound/feedback (opsional)**
   - Jika project punya interaksi (klik tombol, dsb), tawarkan menambahkan sound effect 8-bit pendek (beep/blip) untuk feedback klik — banyak user yang minta "pixel design" sebenarnya ingin nuansa game penuh, bukan cuma visual.

### Checklist sebelum selesai (Mode Retro)
- [ ] Tidak ada `border-radius` yang membulatkan elemen utama
- [ ] Tidak ada gradient/shadow modern yang soft & blur tinggi
- [ ] Font pixel terpasang dan dipakai konsisten
- [ ] Gambar/icon pixel pakai `image-rendering: pixelated`
- [ ] Palet warna terbatas & konsisten di seluruh UI
- [ ] Tombol punya state "tertekan" yang jelas

---

## Mode 2: Pixel-Perfect Modern

Mode ini BUKAN retro — ini tentang presisi: UI modern yang rapi, grid-aligned, dan setiap elemen "pas" hingga ke piksel.

### Prinsip inti
1. **Base grid 8px (atau 4px untuk detail kecil)**
   - Semua spacing (margin, padding, gap) harus kelipatan 8px (atau 4px untuk elemen mikro seperti icon spacing).
   - Hindari nilai sembarang seperti `padding: 13px` atau `margin: 7px`.

2. **Definisikan design tokens di awal sebelum coding UI**
   ```css
   :root {
     --space-1: 4px;
     --space-2: 8px;
     --space-3: 16px;
     --space-4: 24px;
     --space-5: 32px;
     --space-6: 48px;
     --radius-sm: 4px;
     --radius-md: 8px;
   }
   ```

3. **Typography pada baseline grid**
   - `line-height` harus kelipatan unit dasar (mis. 4px atau 8px) supaya teks antar elemen sejajar secara vertikal.
   - Gunakan skala type yang konsisten (mis. 12/14/16/20/24/32/40px), bukan ukuran acak.

4. **Hindari sub-pixel rendering yang blur**
   - Untuk elemen dengan border tipis, pastikan posisi elemen genap (integer px), hindari posisi `0.5px` yang menyebabkan border terlihat blur di beberapa browser/zoom level.
   - Gunakan `transform: translateZ(0)` atau `will-change` secukupnya jika ada blur akibat sub-pixel saat animasi/scale.

5. **Icon & asset tajam di semua resolusi**
   - Gunakan SVG (vector) untuk icon, bukan PNG raster, supaya tetap tajam di retina/HiDPI display.
   - Jika pakai raster image, sediakan varian @2x/@3x.

6. **Konsistensi komponen**
   - Setiap komponen berulang (card, button, input) harus memakai token spacing & radius yang sama — jangan ada card dengan padding 16px di satu tempat dan 18px di tempat lain.

7. **Untuk React**: pertimbangkan setup Tailwind dengan custom spacing scale yang mengikuti grid 8px (`theme.spacing` di `tailwind.config`), supaya disiplin grid otomatis terjaga di seluruh komponen.

### Checklist sebelum selesai (Mode Pixel-Perfect)
- [ ] Semua spacing kelipatan unit grid (4px/8px)
- [ ] Tidak ada nilai pixel "acak" (cek devtools, semua selisih antar elemen rapi)
- [ ] Border/garis tidak terlihat blur di zoom 100% & retina
- [ ] Icon pakai SVG, tajam di semua ukuran layar
- [ ] Komponen berulang konsisten (radius, padding, font sama)

---

## Workflow saat dipanggil di Antigravity

1. Tentukan mode (retro vs pixel-perfect) berdasarkan permintaan user — tanyakan jika tidak jelas.
2. Tanyakan singkat: tech stack (plain HTML/CSS/JS atau React + Tailwind?), dan apakah ada referensi visual/warna yang diinginkan.
3. Set up font & token (pixel font untuk mode retro, spacing tokens untuk mode pixel-perfect) SEBELUM membangun komponen, supaya konsisten dari awal — jangan tempel-tempel style per komponen tanpa sistem.
4. Bangun komponen sesuai checklist di atas.
5. Sebelum menyatakan selesai, jalankan checklist mode yang relevan dan perbaiki yang belum sesuai.
