# Pencarian Siswa di Presensi Pelatih Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan input teks pencarian siswa berdasarkan nama/kelas saat input kehadiran.

**Architecture:** Menambahkan state `searchTerm` di `CoachAttendances.jsx` untuk menyimpan kata kunci pencarian. Melakukan filter data `students` secara client-side, dan merender `filteredStudents` ke dalam tabel.

**Tech Stack:** React, Supabase, Lucide-React icons (Search, X).

## Global Constraints
- Saringan pencarian bersifat case-insensitive.
- Input pencarian diletakkan tepat di atas tabel siswa.

---

### Task 1: Integrasi State dan Pencarian Siswa

**Files:**
- Modify: `src/pages/coach/CoachAttendances.jsx`

**Interfaces:**
- Consumes: `students` state dari database fetch.
- Produces: `searchTerm` state dan `filteredStudents` array ter-filter.

- [ ] **Step 1: Import icon Search dan X**

Modifikasi baris import dari `lucide-react` untuk menyertakan `Search` dan `X`.

```javascript
import { 
  ClipboardCheck, Calendar, ShieldAlert, Check, 
  Users, AlertCircle, Save, Info, Trophy, Search, X
} from 'lucide-react'
```

- [ ] **Step 2: Deklarasikan state searchTerm**

Tambahkan deklarasi state di awal komponen `CoachAttendances`:

```javascript
const [searchTerm, setSearchTerm] = useState('')
```

- [ ] **Step 3: Reset searchTerm ketika sesi atau ekskul berubah**

Tambahkan `setSearchTerm('')` di dalam useEffect pemuatan data kehadiran atau ketika ekskul/sesi berubah:

```javascript
  useEffect(() => {
    if (selectedEkskul && selectedSession) {
      setSearchTerm('') // Reset pencarian saat sesi baru dimuat
      loadAttendanceData(selectedEkskul, selectedSession)
    } else {
      setStudents([])
      setAttendanceSheet({})
      setSearchTerm('')
    }
  }, [selectedEkskul, selectedSession])
```

- [ ] **Step 4: Buat variabel ter-filter filteredStudents**

Tambahkan definisi `filteredStudents` sebelum rendering:

```javascript
  const filteredStudents = students.filter(student => 
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.class?.toLowerCase().includes(searchTerm.toLowerCase())
  )
```

- [ ] **Step 5: Render Input Pencarian di atas tabel**

Tambahkan elemen input pencarian di atas tabel di dalam `<CardContent>`:

```javascript
  <Card className="border-pixel-gray/30 shadow-pixel-sm bg-pixel-panel overflow-hidden">
    <div className="p-4 border-b border-pixel-gray/30 bg-pixel-navy/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-pixel-lavender" />
        <Input
          type="text"
          placeholder="Cari nama atau kelas siswa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-8 h-9 text-xs w-full bg-pixel-panel border-pixel-gray/30"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-2.5 text-pixel-lavender hover:text-pixel-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="text-xs text-pixel-lavender">
        Menampilkan {filteredStudents.length} dari {students.length} siswa
      </div>
    </div>
    <CardContent className="p-0">
```

- [ ] **Step 6: Update mapping tabel**

Ubah mapping tabel yang sebelumnya `students.map(...)` menjadi `filteredStudents.map(...)`.
Jika `filteredStudents.length === 0`, tampilkan baris informasi bahwa pencarian tidak ditemukan:

```javascript
  <tbody className="divide-y-2 divide-pixel-gray/30 text-sm text-pixel-peach">
    {filteredStudents.length === 0 ? (
      <tr>
        <td colSpan={5} className="px-6 py-8 text-center text-pixel-lavender">
          Tidak ada siswa yang cocok dengan pencarian "{searchTerm}"
        </td>
      </tr>
    ) : (
      filteredStudents.map(student => {
        // ... mapping render ...
      })
    )}
  </tbody>
```

- [ ] **Step 7: Verifikasi Manual**

Buka halaman absensi pelatih, ketik nama/kelas siswa untuk memastikan saringan berjalan secara real-time dan pesan pencarian kosong tampil dengan benar.

- [ ] **Step 8: Commit**

```bash
git add src/pages/coach/CoachAttendances.jsx
git commit -m "feat: add client-side student search by name/class in CoachAttendances"
```
