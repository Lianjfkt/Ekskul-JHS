# Admin Revert Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan kemampuan revert (pembatalan/pengembalian data) untuk semua tindakan admin melalui halaman Audit Log, menggunakan snapshot data sebelum dan sesudah perubahan yang disimpan di `audit_logs`.

**Architecture:** Setiap aksi admin akan menyimpan `before_state` dan `after_state` (JSONB) ke tabel `audit_logs`. Fungsi `revertLog` di `auditLogService.js` membaca snapshot dan mengeksekusi operasi invers (DELETE untuk CREATE, UPDATE ke before_state untuk EDIT, INSERT before_state untuk DELETE). UI di halaman Audit Log menampilkan tombol "↩ Batalkan" per baris log.

**Tech Stack:** React (Vite), Supabase (PostgreSQL + JS client), Lucide React icons, TailwindCSS / pixel CSS classes yang sudah ada

## Global Constraints

- Tidak ada library baru — gunakan hanya `supabase` client yang sudah ada dan icon dari `lucide-react`
- Semua pesan UI dalam Bahasa Indonesia
- Gunakan class CSS pixel yang sudah ada: `pixel-badge`, `font-pixel`, `font-retro`, `text-pixel-*`
- Tombol revert hanya aktif jika `is_reverted === false` DAN `target_id` tidak null
- Log yang sudah `is_reverted = true` tidak bisa di-revert ulang
- Revert DELETE user/student **tidak** di-support (karena delete user melibatkan Supabase Auth yang tidak bisa di-restore dari client saja) — tampilkan pesan "Aksi ini tidak dapat dibatalkan otomatis"
- Fungsi `logEvent` tetap backward-compatible (parameter `context` bersifat opsional)

---

## Task 1: Migrasi Database — Tambah Kolom Revert ke `audit_logs`

**Files:**
- Create: `add_revert_columns_audit_logs.sql`

**Interfaces:**
- Produces: Kolom baru di tabel `audit_logs`: `before_state JSONB`, `after_state JSONB`, `target_table TEXT`, `target_id UUID`, `is_reverted BOOLEAN DEFAULT false`, `reverted_by UUID`, `reverted_at TIMESTAMPTZ`

- [ ] **Step 1: Buat file SQL migrasi**

Buat file `add_revert_columns_audit_logs.sql` di root project dengan isi:

```sql
-- Tambah kolom revert ke tabel audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_state  JSONB,
  ADD COLUMN IF NOT EXISTS after_state   JSONB,
  ADD COLUMN IF NOT EXISTS target_table  TEXT,
  ADD COLUMN IF NOT EXISTS target_id     UUID,
  ADD COLUMN IF NOT EXISTS is_reverted   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverted_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reverted_at   TIMESTAMP WITH TIME ZONE;

-- Tambah policy agar admin bisa update kolom revert di audit_logs
CREATE POLICY IF NOT EXISTS "Admin bisa update status revert log"
ON public.audit_logs FOR UPDATE
USING (public.get_user_role() = 'admin');
```

- [ ] **Step 2: Jalankan SQL di Supabase**

Buka Supabase Dashboard → SQL Editor → paste isi file → Run.
Verifikasi: di Table Editor, tabel `audit_logs` sekarang memiliki kolom `before_state`, `after_state`, `target_table`, `target_id`, `is_reverted`, `reverted_by`, `reverted_at`.

- [ ] **Step 3: Commit**

```bash
git add add_revert_columns_audit_logs.sql
git commit -m "feat(db): tambah kolom revert ke tabel audit_logs"
```

---

## Task 2: Update `auditLogService.js` — Extend `logEvent` + Tambah `revertLog`

**Files:**
- Modify: `src/utils/auditLogService.js`

**Interfaces:**
- Consumes: `supabase` dari `../lib/supabaseClient`
- Produces:
  - `auditLogService.logEvent(userId, email, action, details, context)` — `context` opsional: `{ targetTable?: string, targetId?: string, beforeState?: object, afterState?: object }`
  - `auditLogService.revertLog(logId, adminUserId)` → `Promise<{ success: boolean, message: string }>`

- [ ] **Step 1: Ganti seluruh isi `src/utils/auditLogService.js`**

```js
import { supabase } from '../lib/supabaseClient'

const LOCAL_STORAGE_KEY = 'ekskul_audit_logs'

export const auditLogService = {
  /**
   * Catat event ke audit_logs.
   * @param {string} userId
   * @param {string} email
   * @param {string} action - misal 'CREATE_EKSKUL', 'DELETE_USER'
   * @param {string} details - teks deskripsi
   * @param {{ targetTable?: string, targetId?: string, beforeState?: object, afterState?: object }} context
   */
  async logEvent(userId, email, action, details, context = {}) {
    const { targetTable, targetId, beforeState, afterState } = context
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          user_id: userId || null,
          user_email: email || 'system@sekolah.com',
          action,
          details: typeof details === 'object' ? JSON.stringify(details) : details,
          ip_address: '127.0.0.1',
          before_state: beforeState || null,
          after_state: afterState || null,
          target_table: targetTable || null,
          target_id: targetId || null,
        }])
      if (error) throw error
    } catch (err) {
      console.warn('Logging event to LocalStorage:', err.message)
      const logs = this.getLocalLogs()
      const newLog = {
        id: `log-${Date.now()}`,
        user_id: userId || null,
        user_email: email || 'system@sekolah.com',
        action,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        before_state: beforeState || null,
        after_state: afterState || null,
        target_table: targetTable || null,
        target_id: targetId || null,
        is_reverted: false,
        created_at: new Date().toISOString()
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newLog, ...logs].slice(0, 100)))
    }
  },

  getLocalLogs() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (data) {
      try { return JSON.parse(data) } catch { return [] }
    }
    return []
  },

  async getLogs() {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    } catch (err) {
      console.warn('Reading audit logs from LocalStorage:', err.message)
      return this.getLocalLogs()
    }
  },

  /**
   * Batalkan tindakan yang sudah dicatat di log.
   * CREATE_* → DELETE row
   * UPDATE_* / EDIT_* / TOGGLE_* → UPDATE ke before_state
   * DELETE_* → INSERT before_state kembali
   * DELETE_USER / DELETE_STUDENT → tidak didukung (return error message)
   *
   * @param {string} logId - UUID dari baris audit_log
   * @param {string} adminUserId - UUID admin yang melakukan revert
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async revertLog(logId, adminUserId) {
    try {
      // 1. Ambil data log
      const { data: log, error: fetchErr } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', logId)
        .single()
      if (fetchErr) throw new Error('Gagal mengambil data log: ' + fetchErr.message)
      if (!log) throw new Error('Log tidak ditemukan.')
      if (log.is_reverted) throw new Error('Tindakan ini sudah pernah dibatalkan sebelumnya.')

      const { action, target_table, target_id, before_state } = log

      // 2. Cek apakah aksi ini didukung untuk revert
      const isDeleteUser = action === 'DELETE_USER' || action === 'DELETE_STUDENT'
      if (isDeleteUser) {
        return {
          success: false,
          message: 'Aksi penghapusan akun pengguna tidak dapat dibatalkan secara otomatis karena melibatkan sistem autentikasi. Harap buat ulang akun secara manual.'
        }
      }

      if (!target_table || !target_id) {
        return {
          success: false,
          message: 'Log ini tidak memiliki informasi target yang cukup untuk melakukan revert.'
        }
      }

      // 3. Eksekusi operasi invers
      if (action.startsWith('CREATE_')) {
        // Revert CREATE → DELETE
        const { error } = await supabase
          .from(target_table)
          .delete()
          .eq('id', target_id)
        if (error) throw new Error('Gagal menghapus data: ' + error.message)

      } else if (action.startsWith('UPDATE_') || action.startsWith('EDIT_') || action.startsWith('TOGGLE_')) {
        // Revert UPDATE/TOGGLE → kembalikan ke before_state
        if (!before_state) throw new Error('Data sebelumnya (before_state) tidak tersedia untuk aksi ini.')
        const { error } = await supabase
          .from(target_table)
          .update(before_state)
          .eq('id', target_id)
        if (error) throw new Error('Gagal memulihkan data: ' + error.message)

      } else if (action.startsWith('DELETE_')) {
        // Revert DELETE → INSERT before_state kembali
        if (!before_state) throw new Error('Data asli (before_state) tidak tersedia untuk aksi ini.')
        const { error } = await supabase
          .from(target_table)
          .insert([before_state])
        if (error) throw new Error('Gagal memulihkan data yang dihapus: ' + error.message)

      } else {
        return {
          success: false,
          message: `Tipe aksi "${action}" tidak didukung untuk revert otomatis.`
        }
      }

      // 4. Tandai log sebagai sudah di-revert
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('audit_logs')
        .update({
          is_reverted: true,
          reverted_by: adminUserId,
          reverted_at: now
        })
        .eq('id', logId)
      if (updateErr) console.warn('Gagal update status revert di log:', updateErr.message)

      // 5. Catat log baru untuk aksi revert itu sendiri
      await this.logEvent(
        adminUserId,
        null,
        `REVERT_${action}`,
        `Membatalkan tindakan: ${log.details || action}`,
        { targetTable: target_table, targetId: target_id }
      )

      return { success: true, message: 'Tindakan berhasil dibatalkan dan data telah dipulihkan.' }

    } catch (err) {
      return { success: false, message: err.message }
    }
  }
}
```

- [ ] **Step 2: Verifikasi manual — import masih berfungsi**

Jalankan dev server (`npm run dev`) dan pastikan tidak ada error di console saat membuka halaman Admin.

- [ ] **Step 3: Commit**

```bash
git add src/utils/auditLogService.js
git commit -m "feat(service): extend logEvent dengan context snapshot, tambah revertLog"
```

---

## Task 3: Update `AdminDashboard.jsx` — UI Tombol Revert + Handler Pengumuman

**Files:**
- Modify: `src/pages/admin/AdminDashboard.jsx` (baris ~260-320 untuk handler, baris ~1098-1165 untuk UI tabel log)

**Interfaces:**
- Consumes: `auditLogService.revertLog(logId, adminUserId)`, `auditLogService.logEvent(..., context)`
- Consumes: `user?.id` dari `useAuthStore`

- [ ] **Step 1: Tambah state `revertingLogId` di AdminDashboard**

Cari blok state Audit Logs (sekitar baris 44-46):
```jsx
// Audit Logs state
const [logs, setLogs] = useState([])
const [searchLogQuery, setSearchLogQuery] = useState('')
```
Ubah menjadi:
```jsx
// Audit Logs state
const [logs, setLogs] = useState([])
const [searchLogQuery, setSearchLogQuery] = useState('')
const [revertingLogId, setRevertingLogId] = useState(null)
const [revertMsg, setRevertMsg] = useState({ type: '', text: '' }) // type: 'success'|'error'
```

- [ ] **Step 2: Tambah fungsi `handleRevertLog` setelah `loadAuditLogs` (sekitar baris 267)**

Tambahkan fungsi ini setelah fungsi `loadAuditLogs`:
```jsx
const handleRevertLog = async (log) => {
  if (!confirm(`Apakah Anda yakin ingin membatalkan tindakan ini?\n\nAksi: ${log.action}\nDetail: ${log.details}\n\nData akan dikembalikan ke kondisi sebelumnya.`)) return
  setRevertingLogId(log.id)
  setRevertMsg({ type: '', text: '' })
  try {
    const result = await auditLogService.revertLog(log.id, user?.id)
    if (result.success) {
      setRevertMsg({ type: 'success', text: result.message })
    } else {
      setRevertMsg({ type: 'error', text: result.message })
    }
    await loadAuditLogs()
  } catch (err) {
    setRevertMsg({ type: 'error', text: err.message })
  } finally {
    setRevertingLogId(null)
  }
}
```

- [ ] **Step 3: Update `handleCreateAnnouncement` untuk kirim context snapshot**

Cari baris `await auditLogService.logEvent(user?.id, user?.email, 'CREATE_ANNOUNCEMENT', ...)` (sekitar baris 275).

Sebelum memanggil `createAnnouncement`, ambil ID data baru dengan `.select().single()`. Update handler:

```jsx
const handleCreateAnnouncement = async (e) => {
  e.preventDefault()
  if (!newTitle.trim() || !newContent.trim()) return
  setAnnLoading(true)
  try {
    const { data: newAnn, error } = await supabase
      .from('announcements')
      .insert([{ title: newTitle, content: newContent, created_by: user?.id }])
      .select()
      .single()
    if (error) throw error

    await auditLogService.logEvent(
      user?.id, user?.email,
      'CREATE_ANNOUNCEMENT',
      `Membuat pengumuman: ${newTitle}`,
      { targetTable: 'announcements', targetId: newAnn.id, beforeState: null, afterState: newAnn }
    )
    setNewTitle('')
    setNewContent('')
    await loadAnnouncements()
    await loadAuditLogs()
  } catch (err) {
    console.error(err)
  } finally {
    setAnnLoading(false)
  }
}
```

> **Catatan:** Sebelumnya `announcementService.createAnnouncement` yang dipanggil. Sekarang kita panggil Supabase langsung agar bisa ambil ID row. Cek `src/utils/announcementService.js` — jika ada import helper, bisa dihapus atau tetap dipakai tapi kita perlu ID. Cara termudah: panggil supabase langsung di handler ini.

- [ ] **Step 4: Update `handleToggleAnnouncement` dengan context snapshot**

Cari `handleToggleAnnouncement` (sekitar baris 287). Update:

```jsx
const handleToggleAnnouncement = async (id, currentStatus, title) => {
  try {
    await announcementService.toggleAnnouncementStatus(id, !currentStatus)
    await auditLogService.logEvent(
      user?.id, user?.email,
      'TOGGLE_ANNOUNCEMENT',
      `Mengubah status pengumuman "${title}" menjadi ${!currentStatus ? 'Aktif' : 'Nonaktif'}`,
      {
        targetTable: 'announcements',
        targetId: id,
        beforeState: { is_active: currentStatus },
        afterState: { is_active: !currentStatus }
      }
    )
    await loadAnnouncements()
    await loadAuditLogs()
  } catch (err) {
    console.error(err)
  }
}
```

- [ ] **Step 5: Update `handleDeleteAnnouncement` dengan context snapshot**

Cari `handleDeleteAnnouncement` (sekitar baris 303). Ambil data dulu sebelum menghapus:

```jsx
const handleDeleteAnnouncement = async (id, title) => {
  if (!confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) return
  try {
    // Ambil data sebelum dihapus untuk before_state
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .single()

    await announcementService.deleteAnnouncement(id)
    await auditLogService.logEvent(
      user?.id, user?.email,
      'DELETE_ANNOUNCEMENT',
      `Menghapus pengumuman: ${title}`,
      { targetTable: 'announcements', targetId: id, beforeState: annData, afterState: null }
    )
    await loadAnnouncements()
    await loadAuditLogs()
  } catch (err) {
    console.error(err)
  }
}
```

- [ ] **Step 6: Update UI tabel Audit Log — tambah kolom Status & Aksi**

Temukan baris `<thead>` di tabel log (sekitar baris 1120-1126). Ganti header:

```jsx
<thead>
  <tr className="border-b-3 border-pixel-gray bg-pixel-navy font-pixel text-[7px] text-pixel-lavender uppercase tracking-wider">
    <th className="p-4">Waktu</th>
    <th className="p-4">Pengguna</th>
    <th className="p-4">Aksi</th>
    <th className="p-4">Detail</th>
    <th className="p-4">Status</th>
    <th className="p-4">Batalkan</th>
  </tr>
</thead>
```

Ganti baris `filteredLogs.map((log) => (` dan isi `<tr>` (sekitar baris 1136-1158):

```jsx
filteredLogs.map((log) => (
  <tr key={log.id} className={`hover:bg-pixel-panel-light ${log.is_reverted ? 'opacity-60' : ''}`}>
    <td className="p-4 whitespace-nowrap text-base text-pixel-lavender">
      {new Date(log.created_at).toLocaleString('id-ID')}
    </td>
    <td className="p-4 text-pixel-white">{log.user_email}</td>
    <td className="p-4 whitespace-nowrap">
      <span className={`pixel-badge ${
        log.action.startsWith('REVERT_')
          ? 'border-pixel-yellow text-pixel-yellow bg-pixel-yellow/10'
          : log.action.includes('DELETE')
          ? 'border-pixel-red text-pixel-red bg-pixel-red/10'
          : log.action.includes('CREATE')
          ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
          : 'border-pixel-blue text-pixel-blue bg-pixel-blue/10'
      }`}>
        {log.action}
      </span>
    </td>
    <td className="p-4 text-base text-pixel-lavender max-w-[250px] truncate" title={log.details}>
      {log.details}
    </td>
    <td className="p-4 whitespace-nowrap">
      {log.is_reverted ? (
        <span className="pixel-badge border-pixel-yellow text-pixel-yellow bg-pixel-yellow/10">
          ✓ Dibatalkan
        </span>
      ) : (
        <span className="pixel-badge border-pixel-green text-pixel-green bg-pixel-green/10">
          Aktif
        </span>
      )}
    </td>
    <td className="p-4">
      {!log.is_reverted && log.target_id && !log.action.startsWith('REVERT_') ? (
        <button
          onClick={() => handleRevertLog(log)}
          disabled={revertingLogId === log.id}
          className="pixel-badge border-pixel-red text-pixel-red bg-pixel-red/10 hover:bg-pixel-red/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Batalkan tindakan ini"
        >
          {revertingLogId === log.id ? '...' : '↩ Batalkan'}
        </button>
      ) : (
        <span className="text-pixel-lavender text-base">—</span>
      )}
    </td>
  </tr>
))
```

- [ ] **Step 7: Tambah pesan feedback revert di atas tabel log**

Di awal blok `{activeTab === 'logs' && (` (sekitar baris 1099), setelah `<div className="space-y-6">`, tambahkan:

```jsx
{revertMsg.text && (
  <div className={`p-3 rounded font-retro text-lg border-2 ${
    revertMsg.type === 'success'
      ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
      : 'border-pixel-red text-pixel-red bg-pixel-red/10'
  }`}>
    {revertMsg.text}
    <button
      onClick={() => setRevertMsg({ type: '', text: '' })}
      className="ml-3 text-pixel-lavender hover:text-pixel-white"
    >✕</button>
  </div>
)}
```

- [ ] **Step 8: Verifikasi di browser**

Buka halaman Audit Log di AdminDashboard. Pastikan:
- Tabel sekarang punya kolom "Status" dan "Batalkan"
- Baris lama (tanpa `target_id`) menampilkan "—" di kolom Batalkan
- Tidak ada error console

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/AdminDashboard.jsx
git commit -m "feat(admin): tambah tombol revert di audit log, update handler pengumuman dengan snapshot"
```

---

## Task 4: Update `EkskulManagement.jsx` — Tambah Snapshot ke Semua Handler

**Files:**
- Modify: `src/pages/admin/EkskulManagement.jsx`

**Interfaces:**
- Consumes: `auditLogService.logEvent(..., context)` dari `../../utils/auditLogService`
- Consumes: `user` dari `../../stores/authStore` — **belum ada di file ini, perlu ditambahkan**

- [ ] **Step 1: Tambah import `auditLogService` dan `useAuthStore`**

Tambahkan di baris import paling atas (setelah import yang ada):

```jsx
import { auditLogService } from '../../utils/auditLogService'
import { useAuthStore } from '../../stores/authStore'
```

Tambahkan di dalam fungsi komponen (setelah `const [form, setForm] = useState(...)`):

```jsx
const { user } = useAuthStore()
```

- [ ] **Step 2: Update `handleSubmit` — tambah logEvent dengan context**

Temukan fungsi `handleSubmit` (baris 104-158). Setelah operasi sukses dan sebelum `setIsModalOpen(false)`, tambahkan logEvent.

Untuk **mode EDIT** (`if (selectedEkskul)`), tambahkan setelah `if (error) throw error`:

```jsx
// Ambil data terbaru setelah update untuk after_state
const { data: updatedData } = await supabase
  .from('extracurriculars')
  .select('*')
  .eq('id', selectedEkskul.id)
  .single()

await auditLogService.logEvent(
  user?.id, user?.email,
  'UPDATE_EKSKUL',
  `Memperbarui ekskul: ${form.name}`,
  {
    targetTable: 'extracurriculars',
    targetId: selectedEkskul.id,
    beforeState: {
      name: selectedEkskul.name,
      description: selectedEkskul.description,
      schedule: selectedEkskul.schedule,
      coach_id: selectedEkskul.coach_id,
      coach_id_2: selectedEkskul.coach_id_2,
      coach_id_3: selectedEkskul.coach_id_3,
      is_active: selectedEkskul.is_active,
      is_mandatory: selectedEkskul.is_mandatory,
      mandatory_class: selectedEkskul.mandatory_class
    },
    afterState: updatedData
  }
)
```

Untuk **mode CREATE**, ubah insert agar mengambil data baru:

```jsx
const { data: newEkskul, error } = await supabase
  .from('extracurriculars')
  .insert([{
    name: form.name,
    description: form.description,
    schedule: form.schedule,
    coach_id: form.coach_id || null,
    coach_id_2: form.coach_id_2 || null,
    coach_id_3: form.coach_id_3 || null,
    is_active: form.is_active,
    is_mandatory: form.is_mandatory,
    mandatory_class: form.is_mandatory ? (form.mandatory_class || null) : null
  }])
  .select()
  .single()
if (error) throw error

await auditLogService.logEvent(
  user?.id, user?.email,
  'CREATE_EKSKUL',
  `Membuat ekskul baru: ${form.name}`,
  { targetTable: 'extracurriculars', targetId: newEkskul.id, beforeState: null, afterState: newEkskul }
)
```

- [ ] **Step 3: Update `handleDelete` — ambil before_state sebelum hapus**

Temukan `handleDelete` (baris 160-174). Update:

```jsx
const handleDelete = async (id) => {
  if (!confirm('Apakah Anda yakin ingin menghapus ekstrakurikuler ini? Data kehadiran, sesi, dan nilai terkait akan dihapus secara cascade.')) return
  setErrorMsg('')
  try {
    // Ambil data sebelum dihapus
    const { data: ekskulData } = await supabase
      .from('extracurriculars')
      .select('id, name, description, schedule, coach_id, coach_id_2, coach_id_3, is_active, is_mandatory, mandatory_class')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('extracurriculars')
      .delete()
      .eq('id', id)
    if (error) throw error

    await auditLogService.logEvent(
      user?.id, user?.email,
      'DELETE_EKSKUL',
      `Menghapus ekskul: ${ekskulData?.name || id}`,
      { targetTable: 'extracurriculars', targetId: id, beforeState: ekskulData, afterState: null }
    )
    setSuccessMsg('Ekskul berhasil dihapus.')
    fetchData()
  } catch (err) {
    setErrorMsg(err.message)
  }
}
```

- [ ] **Step 4: Update `handleToggleStatus` — tambah context snapshot**

Temukan `handleToggleStatus` (baris 176-189). Update:

```jsx
const handleToggleStatus = async (ekskul) => {
  setErrorMsg('')
  try {
    const { error } = await supabase
      .from('extracurriculars')
      .update({ is_active: !ekskul.is_active })
      .eq('id', ekskul.id)
    if (error) throw error

    await auditLogService.logEvent(
      user?.id, user?.email,
      'TOGGLE_EKSKUL',
      `Mengubah status ekskul "${ekskul.name}" menjadi ${!ekskul.is_active ? 'Aktif' : 'Nonaktif'}`,
      {
        targetTable: 'extracurriculars',
        targetId: ekskul.id,
        beforeState: { is_active: ekskul.is_active },
        afterState: { is_active: !ekskul.is_active }
      }
    )
    setSuccessMsg(`Status ekskul ${ekskul.name} berhasil diubah.`)
    fetchData()
  } catch (err) {
    setErrorMsg(err.message)
  }
}
```

- [ ] **Step 5: Verifikasi — buat/edit/hapus/toggle ekskul, cek log di Audit Log**

Buka halaman Manajemen Ekskul → lakukan salah satu operasi → buka Audit Log → pastikan log baru muncul dengan tombol "↩ Batalkan" yang aktif.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/EkskulManagement.jsx
git commit -m "feat(admin): tambah snapshot audit log ke semua handler EkskulManagement"
```

---

## Task 5: Update `UsersManagement.jsx` — Tambah Snapshot ke Handler Siswa & User

**Files:**
- Modify: `src/pages/admin/UsersManagement.jsx`

**Interfaces:**
- Consumes: `auditLogService.logEvent(..., context)` dari `../../utils/auditLogService`
- Consumes: `user` dari `../../stores/authStore`

> **Catatan penting:** Handler delete user (`handleUserDelete`, `handleStudentDelete`) tidak di-support revert karena melibatkan Supabase Auth RPC. Kita tetap log aksinya tapi tanpa `target_id` yang bisa di-revert — `revertLog` akan return pesan error yang jelas.

- [ ] **Step 1: Tambah import `auditLogService` dan `useAuthStore`**

```jsx
import { auditLogService } from '../../utils/auditLogService'
import { useAuthStore } from '../../stores/authStore'
```

Di dalam fungsi komponen, tambahkan:
```jsx
const { user } = useAuthStore()
```

- [ ] **Step 2: Update `handleStudentSubmit` — tambah logEvent dengan snapshot**

Di bagian **mode Edit** (setelah sukses update students), tambahkan sebelum `setSuccessMsg`:

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'UPDATE_STUDENT',
  `Memperbarui data siswa: ${cleanName}`,
  {
    targetTable: 'students',
    targetId: selectedStudent.id,
    beforeState: {
      nis: selectedStudent.nis,
      full_name: selectedStudent.full_name,
      class: selectedStudent.class,
      gender: selectedStudent.gender,
      phone: selectedStudent.phone
    },
    afterState: {
      nis: studentForm.nis.trim(),
      full_name: cleanName,
      class: studentForm.class.trim(),
      gender: studentForm.gender,
      phone: studentForm.phone.trim()
    }
  }
)
```

Di bagian **mode Insert** (setelah `if (sErr) throw sErr`), tambahkan:

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'CREATE_STUDENT',
  `Menambah siswa baru: ${cleanName}`,
  { targetTable: 'students', targetId: newStudent.id, beforeState: null, afterState: newStudent }
)
```

- [ ] **Step 3: Update `handleStudentDelete` — log dengan before_state (tanpa target_id revertible)**

Di `handleStudentDelete` (baris 243), tambahkan logEvent setelah delete berhasil:

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'DELETE_STUDENT',
  `Menghapus siswa: ${student.full_name} (${student.nis})`,
  {
    targetTable: 'students',
    targetId: null, // null agar tombol revert tidak muncul (tidak bisa di-restore karena auth terhapus)
    beforeState: {
      id: student.id,
      nis: student.nis,
      full_name: student.full_name,
      class: student.class,
      gender: student.gender,
      phone: student.phone
    },
    afterState: null
  }
)
```

- [ ] **Step 4: Update `handleUserSubmit` — tambah logEvent dengan snapshot**

Di bagian **mode Edit** (setelah berhasil), tambahkan:

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'UPDATE_USER',
  `Memperbarui akun ${userForm.role}: ${userForm.full_name}`,
  {
    targetTable: 'users',
    targetId: selectedUser.id,
    beforeState: {
      email: selectedUser.email,
      full_name: selectedUser.full_name,
      role: selectedUser.role
    },
    afterState: {
      email: userForm.email.toLowerCase().trim(),
      full_name: userForm.full_name.trim(),
      role: userForm.role
    }
  }
)
```

Di bagian **mode Create** (setelah berhasil, `data` adalah UUID user baru dari RPC):

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'CREATE_USER',
  `Membuat akun ${userForm.role}: ${userForm.full_name}`,
  {
    targetTable: 'users',
    targetId: data, // UUID dikembalikan dari admin_create_user RPC
    beforeState: null,
    afterState: {
      email: userForm.email.toLowerCase().trim(),
      full_name: userForm.full_name.trim(),
      role: userForm.role
    }
  }
)
```

- [ ] **Step 5: Update `handleUserDelete` — log tanpa target_id revertible**

Di `handleUserDelete` (baris 460), tambahkan logEvent setelah delete berhasil:

```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'DELETE_USER',
  `Menghapus akun pengguna: ${email}`,
  {
    targetTable: 'users',
    targetId: null, // null karena tidak bisa di-restore otomatis
    beforeState: { id, email },
    afterState: null
  }
)
```

- [ ] **Step 6: Update `handleMasterSubmit` dan `handleMasterDelete` — tambah logEvent**

Di `handleMasterSubmit` (baris 293), setelah sukses:

- Mode **Edit**: 
```jsx
await auditLogService.logEvent(
  user?.id, user?.email,
  'UPDATE_STUDENT_MASTER',
  `Memperbarui data master siswa: ${masterForm.full_name}`,
  {
    targetTable: 'student_master',
    targetId: selectedMaster.id,
    beforeState: { nis: selectedMaster.nis, full_name: selectedMaster.full_name, class: selectedMaster.class },
    afterState: { nis: masterForm.nis, full_name: masterForm.full_name, class: masterForm.class }
  }
)
```

- Mode **Create** (setelah insert, simpan ID dari `.select().single()`):
```jsx
// Ubah insert agar return data:
const { data: newMaster, error: mErr } = await supabase
  .from('student_master')
  .insert([{ nis: masterForm.nis.trim(), full_name: masterForm.full_name.trim(), class: masterForm.class.trim(), gender: masterForm.gender, phone: masterForm.phone.trim() }])
  .select()
  .single()
if (mErr) throw mErr

await auditLogService.logEvent(
  user?.id, user?.email,
  'CREATE_STUDENT_MASTER',
  `Menambah data master siswa: ${masterForm.full_name}`,
  { targetTable: 'student_master', targetId: newMaster.id, beforeState: null, afterState: newMaster }
)
```

Di `handleMasterDelete` (baris 341), ambil before_state dulu:
```jsx
const { data: masterData } = await supabase.from('student_master').select('*').eq('id', m.id).single()
// ... lakukan delete ...
await auditLogService.logEvent(
  user?.id, user?.email,
  'DELETE_STUDENT_MASTER',
  `Menghapus data master siswa: ${m.full_name}`,
  { targetTable: 'student_master', targetId: m.id, beforeState: masterData, afterState: null }
)
```

- [ ] **Step 7: Verifikasi di browser**

Tambah siswa baru → buka Audit Log → pastikan log `CREATE_STUDENT` muncul dengan tombol "↩ Batalkan" → klik Batalkan → pastikan data siswa terhapus.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/UsersManagement.jsx
git commit -m "feat(admin): tambah snapshot audit log ke semua handler UsersManagement"
```

---

## Task 6: Update `EnrollmentManagement.jsx` — Tambah Snapshot ke Handler

**Files:**
- Modify: `src/pages/admin/EnrollmentManagement.jsx`

**Interfaces:**
- Consumes: `auditLogService.logEvent(..., context)`
- Consumes: `user` dari `../../stores/authStore`

- [ ] **Step 1: Tambah import dan destructure `user`**

```jsx
import { auditLogService } from '../../utils/auditLogService'
import { useAuthStore } from '../../stores/authStore'
// di dalam komponen:
const { user } = useAuthStore()
```

- [ ] **Step 2: Update `handleSubmit` — tambah logEvent CREATE**

Di `handleSubmit` (baris 105), ubah insert agar return data:

```jsx
const { data: newEnrollment, error } = await supabase
  .from('enrollments')
  .insert([form])
  .select(`*, student:student_id (full_name, nis, class), extracurricular:extracurricular_id (name)`)
  .single()
if (error) throw error

await auditLogService.logEvent(
  user?.id, user?.email,
  'CREATE_ENROLLMENT',
  `Mendaftarkan ${newEnrollment.student?.full_name} ke ${newEnrollment.extracurricular?.name}`,
  { targetTable: 'enrollments', targetId: newEnrollment.id, beforeState: null, afterState: form }
)
```

- [ ] **Step 3: Update `handleDelete` — ambil before_state sebelum hapus**

```jsx
const handleDelete = async (id) => {
  if (!confirm('Apakah Anda yakin ingin menghapus/menolak data pendaftaran ini?')) return
  setErrorMsg('')
  try {
    // Ambil data sebelum dihapus
    const { data: enrollData } = await supabase
      .from('enrollments')
      .select(`*, student:student_id (full_name, nis), extracurricular:extracurricular_id (name)`)
      .eq('id', id)
      .single()

    const { error } = await supabase.from('enrollments').delete().eq('id', id)
    if (error) throw error

    await auditLogService.logEvent(
      user?.id, user?.email,
      'DELETE_ENROLLMENT',
      `Menghapus pendaftaran ${enrollData?.student?.full_name} dari ${enrollData?.extracurricular?.name}`,
      {
        targetTable: 'enrollments',
        targetId: id,
        beforeState: {
          id: enrollData.id,
          student_id: enrollData.student_id,
          extracurricular_id: enrollData.extracurricular_id,
          semester: enrollData.semester,
          academic_year: enrollData.academic_year,
          status: enrollData.status
        },
        afterState: null
      }
    )
    setSuccessMsg('Pendaftaran berhasil dihapus/ditolak.')
    fetchData()
  } catch (err) {
    setErrorMsg(err.message)
  }
}
```

- [ ] **Step 4: Update `handleStatusChange` — tambah logEvent TOGGLE**

```jsx
const handleStatusChange = async (id, newStatus) => {
  setErrorMsg('')
  try {
    // Ambil status lama
    const { data: currentData } = await supabase
      .from('enrollments')
      .select('status, student:student_id (full_name), extracurricular:extracurricular_id (name)')
      .eq('id', id)
      .single()

    const { error } = await supabase.from('enrollments').update({ status: newStatus }).eq('id', id)
    if (error) throw error

    await auditLogService.logEvent(
      user?.id, user?.email,
      'TOGGLE_ENROLLMENT',
      `Mengubah status pendaftaran ${currentData?.student?.full_name} menjadi ${newStatus}`,
      {
        targetTable: 'enrollments',
        targetId: id,
        beforeState: { status: currentData?.status },
        afterState: { status: newStatus }
      }
    )
    setSuccessMsg(newStatus === 'active' ? 'Pendaftaran berhasil disetujui!' : 'Status pendaftaran berhasil diubah.')
    fetchData()
  } catch (err) {
    setErrorMsg(err.message)
  }
}
```

- [ ] **Step 5: Verifikasi di browser**

Daftarkan siswa ke ekskul → buka Audit Log → pastikan log `CREATE_ENROLLMENT` muncul dengan tombol Batalkan → klik → pastikan pendaftaran terhapus dari DB.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/EnrollmentManagement.jsx
git commit -m "feat(admin): tambah snapshot audit log ke semua handler EnrollmentManagement"
```

---

## Task 7: Verifikasi Akhir & End-to-End Test

**Files:** Tidak ada file baru

- [ ] **Step 1: Test skenario CREATE → Revert**

1. Buat ekskul baru "Test Revert Ekskul"
2. Buka Audit Log → cari log `CREATE_EKSKUL`
3. Klik "↩ Batalkan" → konfirmasi → pastikan sukses
4. Buka EkskulManagement → pastikan "Test Revert Ekskul" tidak ada lagi
5. Kembali ke Audit Log → pastikan baris log tersebut bertanda "✓ Dibatalkan" dan tombol disabled

- [ ] **Step 2: Test skenario UPDATE → Revert**

1. Edit nama ekskul yang ada → simpan
2. Buka Audit Log → cari log `UPDATE_EKSKUL`
3. Klik "↩ Batalkan" → pastikan nama ekskul kembali ke nama lama

- [ ] **Step 3: Test skenario DELETE → Revert**

1. Hapus enrollment siswa
2. Buka Audit Log → cari log `DELETE_ENROLLMENT`
3. Klik "↩ Batalkan" → pastikan enrollment muncul kembali

- [ ] **Step 4: Test skenario tidak bisa revert 2x**

1. Lakukan revert pada log apapun
2. Pastikan tombol disabled dan tidak bisa diklik lagi

- [ ] **Step 5: Test log lama tanpa `target_id`**

1. Pastikan baris log lama (sebelum fitur ini) menampilkan "—" di kolom Batalkan (bukan tombol)

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: selesaikan fitur revert tindakan admin — verifikasi akhir"
```

