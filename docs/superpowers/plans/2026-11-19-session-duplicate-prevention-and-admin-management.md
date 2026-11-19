# Pencegahan Sesi Duplikat dan Manajemen Hapus Sesi Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mencegah terjadinya duplikasi sesi latihan oleh pelatih (anti-spam submit, validasi frontend, dan unique constraint database) serta menyediakan fitur hapus sesi latihan secara langsung bagi Admin di halaman Rekap Absensi.

**Architecture:** Menerapkan pertahanan berlapis (defense in depth): lapisan frontend pelatih dengan `isSubmitting` guard dan duplicate checking query, lapisan database dengan PostgreSQL unique constraint pada `(extracurricular_id, session_date)`, serta antarmuka pengelolaan dan penghapusan sesi langsung di sisi Admin (`RecapManagement.jsx`) dengan cascading delete.

**Tech Stack:** React 18, Supabase JS Client v2, Lucide React icons, Tailwind CSS, Vite.

## Global Constraints
- Aturan Utama: Dalam satu ekstrakurikuler, hanya boleh ada maksimal 1 sesi latihan per tanggal (berlaku untuk semua sesi, baik reguler maupun khusus).
- Penghapusan sesi di database harus memanfaatkan relasi `ON DELETE CASCADE` sehingga data anak di `attendances`, `session_coaches`, dan `special_session_participants` terhapus bersih.
- Menjaga konsistensi UI pixel theme (`bg-pixel-panel`, `border-pixel-gray/30`, `text-pixel-*`, `font-retro`).
- Kode tidak boleh menghasilkan error kompilasi pada `npm run build`.

---

### Task 1: SQL Migration Script untuk Duplicate Detection, Cleanup, dan Unique Constraint

**Files:**
- Create: `add_unique_constraint_sessions.sql`

**Interfaces:**
- Produces: Skrip SQL yang dapat dieksekusi di Supabase SQL Editor untuk membersihkan duplikasi lama dan mengunci tabel `sessions` dengan constraint `unique_ekskul_session_date (extracurricular_id, session_date)`.

- [ ] **Step 1: Tulis skrip SQL lengkap**
Tulis file `add_unique_constraint_sessions.sql` yang berisi:
1. Query analisis pendeteksian data duplikat yang ada saat ini.
2. Query pembersihan duplikat aman: menghapus sesi duplikat dengan memprioritaskan sesi yang sudah memiliki data absensi atau sesi yang dibuat pertama kali.
3. Penambahan constraint unik `unique_ekskul_session_date` pada tabel `public.sessions`.

```sql
-- ==========================================
-- Migration: Tambah Unique Constraint pada tabel sessions
-- ==========================================
-- Constraint ini memastikan 1 ekskul hanya memiliki maksimal 1 sesi per tanggal.

-- 1. Deteksi data duplikat yang ada saat ini (jika ada):
-- SELECT extracurricular_id, session_date, COUNT(*)
-- FROM public.sessions
-- GROUP BY extracurricular_id, session_date
-- HAVING COUNT(*) > 1;

-- 2. Bersihkan sesi duplikat (pertahankan sesi yang memiliki data kehadiran terbanyak atau ID tertua)
DELETE FROM public.sessions
WHERE id IN (
  SELECT s.id
  FROM public.sessions s
  JOIN (
    SELECT extracurricular_id, session_date, MIN(id) as keep_id
    FROM public.sessions
    GROUP BY extracurricular_id, session_date
    HAVING COUNT(*) > 1
  ) dup ON s.extracurricular_id = dup.extracurricular_id 
       AND s.session_date = dup.session_date
       AND s.id != dup.keep_id
);

-- 3. Tambahkan Unique Constraint
ALTER TABLE public.sessions 
  ADD CONSTRAINT unique_ekskul_session_date UNIQUE (extracurricular_id, session_date);

-- 4. Indeks pendukung untuk performa query pencarian sesi berdasarkan tanggal & ekskul
CREATE INDEX IF NOT EXISTS idx_sessions_ekskul_date_unique 
  ON public.sessions (extracurricular_id, session_date);
```

- [ ] **Step 2: Verifikasi file SQL tersimpan dengan benar**
Periksa keberadaan dan baris file menggunakan `read_file`.

- [ ] **Step 3: Commit**
```bash
git add add_unique_constraint_sessions.sql
git commit -m "feat(db): add unique constraint and cleanup script for sessions"
```

---

### Task 2: Proteksi Anti Double-Click dan Validasi Sesi Duplikat pada Form Pelatih

**Files:**
- Modify: `src/pages/coach/CoachSessions.jsx:13-300`

**Interfaces:**
- Consumes: `supabase` client, `form.extracurricular_id`, `form.session_date`.
- Produces: `isSubmitting` state, validasi query sebelum insert sesi baru atau update tanggal, peringatan visual ketika tanggal sudah terpakai.

- [ ] **Step 1: Tambahkan state `isSubmitting` pada `CoachSessions.jsx`**
Di deklarasi state:
```javascript
const [isSubmitting, setIsSubmitting] = useState(false)
```

- [ ] **Step 2: Tambahkan validasi duplikasi tanggal di dalam `handleSubmit`**
Sebelum proses insert/update dilakukan di `handleSubmit`:
```javascript
// Validasi duplikasi tanggal sesi untuk ekskul yang sama
let duplicateQuery = supabase
  .from('sessions')
  .select('id, session_date, topic')
  .eq('extracurricular_id', form.extracurricular_id)
  .eq('session_date', form.session_date)

if (selectedSession?.id) {
  duplicateQuery = duplicateQuery.neq('id', selectedSession.id)
}

const { data: existingSessions, error: dupErr } = await duplicateQuery
if (dupErr) throw dupErr

if (existingSessions && existingSessions.length > 0) {
  setErrorMsg(`Sesi untuk ekstrakurikuler ini pada tanggal ${form.session_date} sudah ada (${existingSessions[0].topic || 'Tanpa topik'}). Setiap ekskul hanya boleh memiliki 1 sesi per hari.`)
  return
}
```

- [ ] **Step 3: Bungkus proses penyimpanan dengan `setIsSubmitting` dan `try/finally`**
Di awal `handleSubmit`:
```javascript
setIsSubmitting(true)
```
Di akhir blok `try/catch/finally`:
```javascript
} catch (err) {
  setErrorMsg(err.message)
} finally {
  setIsSubmitting(false)
}
```

- [ ] **Step 4: Update tombol "Simpan Sesi" di modal `CoachSessions.jsx`**
Ubah tombol submit (sekitar baris 623):
```jsx
<Button type="button" onClick={handleCloseModal} variant="outline" disabled={isSubmitting}>Batal</Button>
<Button type="submit" disabled={isSubmitting} className="gap-2">
  {isSubmitting ? (
    <>
      <span className="w-3.5 h-3.5 border-2 border-pixel-white border-t-transparent rounded-full animate-spin inline-block" />
      Menyimpan...
    </>
  ) : (
    'Simpan Sesi'
  )}
</Button>
```

- [ ] **Step 5: Verifikasi build dengan `npm run build`**
Pastikan tidak ada error sintaks.

- [ ] **Step 6: Commit**
```bash
git add src/pages/coach/CoachSessions.jsx
git commit -m "feat(coach): add double-click protection and duplicate session date validation"
```

---

### Task 3: Fitur Hapus Sesi untuk Admin pada Tab "Absensi per Sesi"

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Consumes: `selectedSessionId`, `currentSelectedSession`, `fetchRecapData()`.
- Produces: Tombol "Hapus Sesi" di tab `sessionAttendance`, dialog konfirmasi penghapusan, proses cascading delete sesi ke Supabase.

- [ ] **Step 1: Tambahkan state `isDeletingSession` dan `sessionDeleteConfirmOpen`**
Di `RecapManagement.jsx`:
```javascript
const [isDeletingSession, setIsDeletingSession] = useState(false)
const [sessionDeleteConfirmOpen, setSessionDeleteConfirmOpen] = useState(false)
```

- [ ] **Step 2: Buat fungsi `handleAdminDeleteSession`**
```javascript
const handleAdminDeleteSession = async (sessionId) => {
  if (!sessionId) return
  setIsDeletingSession(true)
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)

    if (error) throw error

    toast.success('Sesi latihan dan data absensi terkait berhasil dihapus.', 'Penghapusan Berhasil')
    soundManager.playCoin()
    setSessionDeleteConfirmOpen(false)
    setSelectedSessionId('')
    await fetchRecapData()
  } catch (err) {
    console.error('Gagal menghapus sesi:', err)
    toast.error('Gagal menghapus sesi: ' + err.message, 'Terjadi Kesalahan')
  } finally {
    setIsDeletingSession(false)
  }
}
```

- [ ] **Step 3: Tambahkan tombol "Hapus Sesi" dan modal dialog konfirmasi pada tab `sessionAttendance`**
Di samping atau di bawah kartu ringkasan sesi pada `sessionAttendance`:
Tambahkan tombol merah:
```jsx
<Button
  variant="destructive"
  size="sm"
  onClick={() => setSessionDeleteConfirmOpen(true)}
  className="bg-pixel-red hover:bg-rose-700 text-pixel-white gap-2 text-xs font-semibold rounded-none"
>
  <Trash2 className="w-3.5 h-3.5" />
  Hapus Sesi Ini
</Button>
```
Dan render dialog konfirmasi retro-pixel:
```jsx
{sessionDeleteConfirmOpen && (
  <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
    <div className="bg-pixel-panel border-2 border-pixel-red p-6 max-w-md w-full shadow-pixel-lg space-y-4">
      <div className="flex items-center gap-3 text-pixel-red font-bold text-base">
        <ShieldAlert className="w-6 h-6 flex-shrink-0" />
        Konfirmasi Hapus Sesi
      </div>
      <p className="text-xs text-pixel-lavender leading-relaxed">
        Apakah Anda yakin ingin menghapus sesi tanggal <strong className="text-pixel-white">{formatDateIndo(currentSelectedSession?.session_date)}</strong> ({currentSelectedSession?.topic || 'Tanpa Materi'})?
      </p>
      <p className="text-2xs text-pixel-peach bg-pixel-navy p-3 border border-pixel-gray/30">
        ⚠️ <strong>Perhatian:</strong> Seluruh {sessionStats.total} data absensi siswa yang tercatat pada sesi ini akan otomatis terhapus secara permanen.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isDeletingSession}
          onClick={() => setSessionDeleteConfirmOpen(false)}
        >
          Batal
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isDeletingSession}
          onClick={() => handleAdminDeleteSession(currentSelectedSession?.id)}
          className="bg-pixel-red hover:bg-rose-700 text-pixel-white gap-1.5"
        >
          {isDeletingSession ? 'Menghapus...' : 'Ya, Hapus Sesi'}
        </Button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verifikasi build dengan `npm run build`**
Pastikan tidak ada sintaks atau import yang rusak.

- [ ] **Step 5: Commit**
```bash
git add src/pages/admin/RecapManagement.jsx
git commit -m "feat(admin): add delete session capability in session attendance tab"
```

---

### Task 4: Fitur Hapus Sesi pada Modal "Detail Sesi Latihan" dan Indikator Sesi Ganda

**Files:**
- Modify: `src/pages/admin/RecapManagement.jsx`

**Interfaces:**
- Consumes: `selectedSessionGroup`, `availableEkskulSessions`.
- Produces: Tombol hapus pada masing-masing item sesi di modal detail pelatih, dan badge visual "⚠️ Ganda" pada sesi yang bertanggal sama.

- [ ] **Step 1: Tambahkan tombol hapus di setiap kartu sesi modal `selectedSessionGroup`**
Di dalam pemetaan `selectedSessionGroup.sessionsList.map((session, sIdx) => ...)`:
Tambahkan tombol hapus dengan konfirmasi langsung:
```jsx
<Button
  variant="ghost"
  size="icon"
  title="Hapus Sesi"
  onClick={async () => {
    if (!window.confirm(`Hapus sesi tanggal ${formatDateIndo(session.session_date)} (${session.topic || 'Tanpa topik'})? Data absensi pada sesi ini akan ikut terhapus.`)) return
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', session.id)
      if (error) throw error
      toast.success('Sesi berhasil dihapus')
      soundManager.playCoin()
      
      // Update data di modal secara langsung
      const updatedList = selectedSessionGroup.sessionsList.filter(s => s.id !== session.id)
      if (updatedList.length === 0) {
        setSelectedSessionGroup(null)
      } else {
        setSelectedSessionGroup({
          ...selectedSessionGroup,
          sessionsList: updatedList,
          sessionsCount: updatedList.length
        })
      }
      await fetchRecapData()
    } catch (err) {
      toast.error('Gagal menghapus sesi: ' + err.message)
    }
  }}
  className="h-8 w-8 text-pixel-red/80 hover:text-pixel-red hover:bg-pixel-red/10 rounded-none"
>
  <Trash2 className="w-4 h-4" />
</Button>
```

- [ ] **Step 2: Tambahkan indikator visual jika terdeteksi tanggal ganda di dropdown sesi**
Pada pembentukan opsi di dropdown sesi:
```javascript
// Hitung frekuensi tanggal sesi dalam availableEkskulSessions
const dateCounts = useMemo(() => {
  const counts = {}
  availableEkskulSessions.forEach(s => {
    counts[s.session_date] = (counts[s.session_date] || 0) + 1
  })
  return counts
}, [availableEkskulSessions])
```
Di opsi `<option key={s.id} value={s.id}>`:
```jsx
<option key={s.id} value={s.id}>
  {dateCounts[s.session_date] > 1 ? '⚠️ [GANDA] ' : ''}
  {formatDateIndo(s.session_date)}{s.topic ? ` — ${s.topic}` : ''}
</option>
```

- [ ] **Step 3: Jalankan `npm run build` untuk memvalidasi seluruh aplikasi**
Pastikan build berhasil 100%.

- [ ] **Step 4: Commit**
```bash
git add src/pages/admin/RecapManagement.jsx
git commit -m "feat(admin): add delete session in detail modal and duplicate date indicator"
```

---

### Task 5: Pengujian Akhir & Verifikasi Menyeluruh

**Files:**
- Test all modified files

- [ ] **Step 1: Jalankan `npm run build`**
Pastikan proses build selesai tanpa error.

- [ ] **Step 2: Verifikasi Alur Pelatih dan Admin**
1. Periksa `CoachSessions.jsx`: pastikan submit button memiliki `disabled={isSubmitting}` dan validasi duplikasi tanggal berjalan.
2. Periksa `RecapManagement.jsx`: pastikan tombol hapus sesi di tab "Absensi per Sesi" dan di modal "Detail Sesi Latihan" terpasang lengkap dengan konfirmasi yang aman.
3. Periksa `add_unique_constraint_sessions.sql`: pastikan skrip SQL siap dijalankan di Supabase.

- [ ] **Step 3: Final Commit & Summary**
```bash
git status
```
