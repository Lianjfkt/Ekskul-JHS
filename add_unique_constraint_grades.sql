-- ==========================================
-- Migration: Tambah unique constraint pada tabel grades
-- ==========================================
-- Constraint ini memastikan setiap siswa hanya memiliki satu catatan nilai
-- per ekskul, per semester, dan per tahun ajaran.
-- Constraint ini DIPERLUKAN agar operasi upsert di CoachGrades.jsx berjalan dengan benar.

ALTER TABLE public.grades 
  ADD CONSTRAINT unique_student_ekskul_semester_year 
  UNIQUE (student_id, extracurricular_id, semester, academic_year);

-- ==========================================
-- CATATAN:
-- Jalankan script ini di Supabase SQL Editor.
-- Jika terdapat data duplikat, hapus duplikat terlebih dahulu sebelum menjalankan.
-- ==========================================
