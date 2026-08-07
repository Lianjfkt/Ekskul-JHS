-- ==========================================
-- Tambah kolom revert ke tabel audit_logs
-- ==========================================
-- Kolom ini mendukung fitur pembatalan (revert) tindakan admin.
-- before_state: snapshot data sebelum aksi (null untuk CREATE)
-- after_state:  snapshot data sesudah aksi (null untuk DELETE)
-- target_table: nama tabel yang terdampak (misal 'announcements', 'extracurriculars')
-- target_id:    UUID row yang dimodifikasi
-- is_reverted:  apakah log ini sudah pernah di-revert
-- reverted_by:  user ID admin yang melakukan revert
-- reverted_at:  waktu revert dilakukan

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_state  JSONB,
  ADD COLUMN IF NOT EXISTS after_state   JSONB,
  ADD COLUMN IF NOT EXISTS target_table  TEXT,
  ADD COLUMN IF NOT EXISTS target_id     UUID,
  ADD COLUMN IF NOT EXISTS is_reverted   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverted_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reverted_at   TIMESTAMP WITH TIME ZONE;

-- Policy agar admin bisa update kolom revert di audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Admin bisa update status revert log'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin bisa update status revert log"
      ON public.audit_logs FOR UPDATE
      USING (public.get_user_role() = ''admin'')';
  END IF;
END
$$;
