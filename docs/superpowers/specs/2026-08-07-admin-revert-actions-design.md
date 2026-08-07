# Fitur Revert Tindakan Admin

## Ringkasan

Admin sistem Ekskul-JHS saat ini dapat melakukan berbagai tindakan (tambah, edit, hapus, toggle) di beberapa halaman manajemen. Tidak ada mekanisme untuk membatalkan atau mengembalikan tindakan tersebut jika terjadi kesalahan. Fitur ini menambahkan kemampuan **revert (pembatalan/pengembalian data)** untuk semua tindakan admin melalui halaman Audit Log, menggunakan pendekatan snapshot data sebelum dan sesudah perubahan.

---

## Pendekatan: Soft Revert dengan Snapshot Data

Setiap kali admin melakukan aksi, sistem menyimpan snapshot data **sebelum** dan **sesudah** perubahan dalam tabel `audit_logs`. Admin dapat membatalkan tindakan tersebut dari halaman Audit Log kapan saja tanpa batasan waktu. Sistem akan membaca snapshot dan mengembalikan data ke kondisi semula secara otomatis.

---

## Perubahan Database

### Modifikasi Tabel `audit_logs`

```sql
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_state  JSONB,
  ADD COLUMN IF NOT EXISTS after_state   JSONB,
  ADD COLUMN IF NOT EXISTS target_table  TEXT,
  ADD COLUMN IF NOT EXISTS target_id     UUID,
  ADD COLUMN IF NOT EXISTS is_reverted   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverted_by   UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reverted_at   TIMESTAMP WITH TIME ZONE;
```

| Kolom | Tipe | Keterangan |
|---|---|---|
| `before_state` | JSONB | Snapshot data sebelum aksi (null untuk CREATE) |
| `after_state` | JSONB | Snapshot data sesudah aksi (null untuk DELETE) |
| `target_table` | TEXT | Nama tabel yang terdampak |
| `target_id` | UUID | UUID row yang dimodifikasi |
| `is_reverted` | BOOLEAN | Apakah log ini sudah pernah di-revert |
| `reverted_by` | UUID | User ID admin yang melakukan revert |
| `reverted_at` | TIMESTAMP | Waktu revert dilakukan |

---

## Perubahan Service

### `src/utils/auditLogService.js`

#### Modifikasi `logEvent`

```js
// Signature baru (context bersifat opsional, backward-compatible)
logEvent(userId, email, action, details, context = {})
// context: { targetTable, targetId, beforeState, afterState }
```

#### Fungsi Baru `revertLog(logId, adminUserId)`

| Tipe Aksi | Strategi Revert |
|---|---|
| `CREATE_*` | DELETE dari targetTable WHERE id = targetId |
| `UPDATE_*` / `EDIT_*` / `TOGGLE_*` | UPDATE targetTable SET beforeState WHERE id = targetId |
| `DELETE_*` | INSERT beforeState ke targetTable |

Setelah revert: update `is_reverted`, `reverted_by`, `reverted_at` di baris log. Catat log baru `REVERT_<ORIGINAL_ACTION>`.

**Ketentuan:** Log `is_reverted = true` tidak bisa di-revert ulang. Hanya role `admin` yang bisa memanggil fungsi ini.

---

## Perubahan Frontend

### `AdminDashboard.jsx` — UI Audit Log

- Tambah kolom **Status**: badge "Sudah Dibatalkan" jika `is_reverted = true`
- Tambah kolom **Aksi**: tombol **"↩ Batalkan"** jika log belum di-revert dan memiliki `target_id`
- Klik tombol → dialog konfirmasi → panggil `revertLog()` → refresh list
- Tombol disabled untuk log yang sudah di-revert

### Handler yang Diperbarui

Semua handler di 4 halaman admin diperbarui untuk menyertakan `context`:

**`AdminDashboard.jsx`** (Pengumuman):
- `CREATE_ANNOUNCEMENT`: beforeState=null, afterState=data baru, targetTable='announcements'
- `TOGGLE_ANNOUNCEMENT`: beforeState={is_active: lama}, afterState={is_active: baru}
- `DELETE_ANNOUNCEMENT`: beforeState=data pengumuman, afterState=null

**`UsersManagement.jsx`** (Siswa, Pelatih, Orang Tua):
- CREATE: beforeState=null, afterState=data baru, targetTable='users'/'students'
- UPDATE: beforeState=data lama, afterState=data baru
- DELETE: beforeState=data lama, afterState=null

**`EkskulManagement.jsx`** (Ekskul):
- CREATE: beforeState=null, afterState=data baru, targetTable='extracurriculars'
- UPDATE: beforeState=selectedEkskul, afterState=data baru
- DELETE: beforeState=data ekskul, afterState=null
- TOGGLE: beforeState={is_active: lama}, afterState={is_active: baru}

**`EnrollmentManagement.jsx`** (Pendaftaran):
- CREATE: beforeState=null, afterState=data baru, targetTable='enrollments'
- DELETE: beforeState=data enrollment, afterState=null

---

## Alur Revert

```
Admin → Klik "↩ Batalkan" di baris log
  → Dialog konfirmasi
  → Konfirmasi "Ya"
    → revertLog(logId, adminUserId)
      → Baca action, target_table, target_id, before_state
      → Eksekusi operasi invers di Supabase
      → Update log: is_reverted=true, reverted_by, reverted_at
      → Catat log baru: REVERT_<ORIGINAL_ACTION>
    → Refresh list log → toast sukses
  → Tombol disabled, badge "Sudah Dibatalkan" tampil
```

---

## File yang Diubah

| File | Perubahan |
|---|---|
| `add_revert_columns_audit_logs.sql` | [NEW] Migrasi SQL |
| `src/utils/auditLogService.js` | [MODIFY] Extend logEvent, tambah revertLog |
| `src/pages/admin/AdminDashboard.jsx` | [MODIFY] UI tombol revert + update handler |
| `src/pages/admin/UsersManagement.jsx` | [MODIFY] Update handler dengan snapshot |
| `src/pages/admin/EkskulManagement.jsx` | [MODIFY] Update handler dengan snapshot |
| `src/pages/admin/EnrollmentManagement.jsx` | [MODIFY] Update handler dengan snapshot |

---

## Verifikasi

- Buat entitas → log muncul → klik Batalkan → entitas terhapus → badge "Sudah Dibatalkan" muncul
- Edit entitas → klik Batalkan → nilai kembali ke data lama
- Hapus entitas → klik Batalkan → entitas muncul kembali di database
- Toggle status → klik Batalkan → status kembali ke nilai semula
- Pastikan log yang sudah di-revert tidak bisa di-revert ulang
