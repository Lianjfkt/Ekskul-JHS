-- ==========================================
-- Migration: Tambah unique constraint pada tabel attendances
-- ==========================================
-- Constraint ini memastikan setiap siswa hanya memiliki satu catatan kehadiran per sesi.
-- Constraint ini DIPERLUKAN agar operasi upsert di CoachAttendances.jsx berjalan dengan benar.

ALTER TABLE public.attendances 
  ADD CONSTRAINT unique_session_student_attendance UNIQUE (session_id, student_id);

-- ==========================================
-- CATATAN:
-- Jalankan script ini di Supabase SQL Editor.
-- Jika terdapat data duplikat (session_id + student_id yang sama), hapus terlebih dahulu 
-- sebelum menjalankan script ini.
-- ==========================================
