import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, ShieldCheck, X, Award, CheckCircle2 } from 'lucide-react'

const RATING_LABELS = {
  1: 'Kurang Sekali',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik'
}

export default function CoachEvaluationModal({
  isOpen,
  onClose,
  extracurricular,
  coach,
  studentId,
  semester = 'Ganjil',
  academicYear = '2024/2025',
  existingEvaluation = null,
  onSuccess
}) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (existingEvaluation) {
      setRating(existingEvaluation.rating || 0)
      setFeedback(existingEvaluation.feedback || '')
    } else {
      setRating(0)
      setFeedback('')
    }
    setErrorMsg('')
  }, [existingEvaluation, isOpen])

  if (!isOpen || !extracurricular) return null

  const isReadOnly = !!existingEvaluation
  const activeRating = hoverRating || rating

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating < 1 || rating > 5) {
      setErrorMsg('Silakan pilih rating bintang terlebih dahulu (1 - 5).')
      return
    }

    if (!extracurricular?.id || !studentId) {
      setErrorMsg('Data ekstrakurikuler atau siswa tidak lengkap.')
      return
    }

    const coachId = coach?.id || extracurricular?.coach_id
    if (!coachId) {
      setErrorMsg('Data pelatih tidak ditemukan pada ekstrakurikuler ini.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const payload = {
        extracurricular_id: extracurricular.id,
        coach_id: coachId,
        student_id: studentId,
        semester: semester,
        academic_year: academicYear,
        rating: rating,
        feedback: feedback.trim() || null
      }

      const { data, error } = await supabase
        .from('coach_evaluations')
        .insert([payload])
        .select()
        .single()

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('uq_student_coach_eval')) {
          throw new Error('Anda sudah pernah memberikan penilaian untuk pelatih ekskul ini di semester ini.')
        }
        throw error
      }

      if (onSuccess) {
        onSuccess(data || payload)
      }
      onClose()
    } catch (err) {
      console.error('Error submitting coach evaluation:', err)
      setErrorMsg(err.message || 'Gagal mengirim penilaian.')
    } finally {
      setSubmitting(false)
    }
  }

  const coachName = coach?.full_name || extracurricular?.coach?.full_name || 'Pelatih Ekskul'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="bg-pixel-panel border-4 border-pixel-blue rounded-none shadow-pixel-lg w-full max-w-lg overflow-hidden pixel-slide-in">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-pixel-navy border-b-2 border-pixel-gray/40">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-pixel-yellow" />
            <h3 className="font-pixel text-xs text-pixel-white tracking-wide">
              {isReadOnly ? 'Detail Penilaian Pelatih' : 'Penilaian Pelatih Ekskul'}
            </h3>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none text-pixel-lavender hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info Card */}
          <div className="bg-pixel-navy/70 border border-pixel-gray/40 p-4 space-y-1">
            <div className="text-[10px] font-pixel uppercase tracking-widest text-pixel-peach">
              {extracurricular.name}
            </div>
            <div className="text-base font-retro font-bold text-pixel-white flex items-center gap-2">
              Pelatih: <span className="text-pixel-lavender">{coachName}</span>
            </div>
            <div className="text-xs text-pixel-lavender font-retro">
              Semester: {semester} | Tahun Ajaran: {academicYear}
            </div>
          </div>

          {/* Anonim Notice */}
          <div className="flex items-center gap-2.5 bg-pixel-green/10 border border-pixel-green/30 p-3 text-xs text-pixel-green">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-pixel-green" />
            <span>
              <strong>Penilaian Anonim:</strong> Identitas nama & NIS Anda tidak akan ditampilkan kepada pelatih.
            </span>
          </div>

          {/* Star Rating Picker */}
          <div className="space-y-2 text-center py-2 bg-pixel-navy/40 border border-pixel-gray/20 p-4">
            <Label className="block font-pixel text-[9px] uppercase tracking-wider text-pixel-lavender mb-2">
              Beri Skor Kepuasan / Kinerja Pelatih
            </Label>
            <div className="flex justify-center items-center gap-2">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const filled = starVal <= activeRating
                return (
                  <button
                    key={starVal}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setRating(starVal)}
                    onMouseEnter={() => !isReadOnly && setHoverRating(starVal)}
                    onMouseLeave={() => !isReadOnly && setHoverRating(0)}
                    className={`p-1.5 transition-transform ${
                      isReadOnly ? 'cursor-default' : 'hover:scale-125 cursor-pointer active:scale-95'
                    }`}
                  >
                    <Star
                      className={`w-8 h-8 ${
                        filled
                          ? 'fill-pixel-yellow text-pixel-yellow drop-shadow-[0_0_8px_rgba(255,204,0,0.6)]'
                          : 'text-pixel-gray/60 stroke-2'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <div className="h-6 flex items-center justify-center">
              {activeRating > 0 ? (
                <span className="font-pixel text-[10px] text-pixel-yellow">
                  {RATING_LABELS[activeRating]} ({activeRating} / 5)
                </span>
              ) : (
                <span className="text-xs text-pixel-lavender/60 italic font-retro">
                  Klik bintang untuk memberi skor (1 - 5)
                </span>
              )}
            </div>
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="coach_feedback" className="font-pixel text-[9px] uppercase tracking-wider text-pixel-lavender">
              Kesan, Pesan & Saran untuk Pelatih (Opsional)
            </Label>
            <Textarea
              id="coach_feedback"
              rows={3}
              disabled={isReadOnly}
              placeholder={
                isReadOnly
                  ? 'Tidak ada saran yang dituliskan.'
                  : 'Contoh: Pelatih sangat sabar dan jelas saat mengajarkan materi...'
              }
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="bg-pixel-navy border-pixel-gray/50 text-pixel-white rounded-none font-retro focus-visible:ring-pixel-blue"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-pixel-red/20 border border-pixel-red text-pixel-red text-xs">
              <span className="font-bold">Perhatian: </span> {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="rounded-none border-pixel-gray text-pixel-white"
            >
              {isReadOnly ? 'Tutup' : 'Batal'}
            </Button>
            {!isReadOnly && (
              <Button
                type="submit"
                disabled={submitting || rating === 0}
                className="rounded-none bg-pixel-blue hover:bg-pixel-blue/90 text-pixel-white font-pixel text-[9px] gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-pixel-green" /> Kirim Penilaian
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
