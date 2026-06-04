# 🏫 Ekskul JHS — Sistem Manajemen Ekstrakurikuler

> Aplikasi web untuk manajemen ekstrakurikuler Sekolah Menengah Pertama (SMP/JHS) berbasis **React + Vite + Supabase**.

---

## 📋 Deskripsi

**Ekskul JHS** adalah platform manajemen ekstrakurikuler yang memungkinkan sekolah untuk mengelola kegiatan ekskul secara digital. Sistem ini dirancang untuk empat jenis pengguna dengan hak akses berbeda:

| Role | Akses |
|------|-------|
| 👨‍💼 **Admin** | Kelola ekskul, siswa, pendaftaran, dan rekap nilai |
| 🧑‍🏫 **Pelatih (Coach)** | Input absensi, nilai, dan kelola sesi latihan |
| 🧑‍🎓 **Siswa (Student)** | Lihat jadwal, absensi, dan nilai pribadi |
| 👨‍👩‍👧 **Orang Tua (Parent)** | Pantau perkembangan anak secara real-time |

---

## ✨ Fitur Utama

- 🔐 **Autentikasi** — Login multi-role dengan Supabase Auth
- 📊 **Dashboard** — Statistik dan ringkasan per role
- 📅 **Manajemen Sesi** — Jadwal latihan dan kehadiran
- ✅ **Absensi Digital** — Input dan rekap kehadiran siswa
- 📝 **Penilaian** — Input dan lihat nilai per siswa
- 📥 **Import Data** — Upload siswa & pendaftaran via CSV/Excel
- 📄 **Ekspor PDF** — Rekap nilai dan laporan dalam format PDF
- 📱 **Responsive** — Mendukung tampilan mobile & desktop

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Frontend | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| Backend | [Supabase](https://supabase.com/) (Database + Auth) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Routing | [React Router v6](https://reactrouter.com/) |
| Charts | [Recharts](https://recharts.org/) |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| Import | [PapaParse](https://www.papaparse.com/) + [SheetJS](https://sheetjs.com/) |
| Deploy | [Vercel](https://vercel.com/) |

---

## 🚀 Cara Menjalankan Lokal

### 1. Clone repository

```bash
git clone https://github.com/Lianjfkt/Ekskul-JHS.git
cd Ekskul-JHS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi environment

Buat file `.env.local` di root project:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> 🔑 Dapatkan kredensial dari [Supabase Dashboard](https://app.supabase.com/) → Settings → API

### 4. Setup database

Jalankan file `init_schema.sql` di Supabase SQL Editor untuk membuat tabel-tabel yang dibutuhkan.

### 5. Jalankan dev server

```bash
npm run dev
```

Buka [http://localhost:5173](http://localhost:5173) di browser.

---

## 📁 Struktur Project

```
src/
├── components/
│   ├── import/        # Komponen import CSV/Excel
│   ├── shared/        # Navbar, Sidebar, Layout, dll
│   ├── ui/            # Komponen UI (button, card, input, dll)
│   └── student/       # Layout khusus siswa
├── hooks/             # Custom React hooks
├── lib/               # Supabase client & utilities
├── pages/
│   ├── admin/         # Halaman Admin
│   ├── auth/          # Login
│   ├── coach/         # Halaman Pelatih
│   ├── parent/        # Halaman Orang Tua
│   └── student/       # Halaman Siswa
├── routes/            # Konfigurasi routing
├── stores/            # Zustand state management
└── utils/             # Helper functions (CSV, Excel, PDF)
```

---

## 🌐 Deploy

Aplikasi dideploy menggunakan **Vercel** dengan konfigurasi SPA routing di `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## 👤 Developer

**Lianjfkt**
- GitHub: [@Lianjfkt](https://github.com/Lianjfkt)
- Email: febriandyjalian@gmail.com

---

<p align="center">Made with ❤️ for JHS Extracurricular Management</p>
