/**
 * Grade Utilities — Single Source of Truth
 * Kalkulasi rata-rata nilai dan predikat digunakan secara konsisten
 * di seluruh aplikasi: useGrades, ParentDashboard, ParentGrades, dsb.
 */

/**
 * Hitung rata-rata dari score sikap, keterampilan, dan keaktifan.
 * Hanya score yang tidak null/undefined yang masuk hitungan.
 *
 * @param {number|null} attitudeScore
 * @param {number|null} skillScore
 * @param {number|null} activityScore
 * @returns {number} Rata-rata dibulatkan ke integer
 */
export function calculateAvgScore(attitudeScore, skillScore, activityScore) {
  const scores = [attitudeScore, skillScore, activityScore].filter(
    (v) => v !== null && v !== undefined
  )
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

/**
 * Tentukan predikat dari nilai rata-rata.
 * Standar: A >= 90, B >= 75, C >= 60, D < 60
 *
 * @param {number} avg
 * @returns {'A'|'B'|'C'|'D'}
 */
export function getPredikat(avg) {
  if (avg >= 90) return 'A'
  if (avg >= 75) return 'B'
  if (avg >= 60) return 'C'
  return 'D'
}

/**
 * Hitung statistik nilai lengkap dari satu record grade.
 *
 * @param {{ attitude_score?: number|null, skill_score?: number|null, activity_score?: number|null }} grade
 * @returns {{ avg: number, predikat: 'A'|'B'|'C'|'D' }}
 */
export function enrichGradeStats(grade) {
  const avg = calculateAvgScore(grade.attitude_score, grade.skill_score, grade.activity_score)
  return { avg, predikat: getPredikat(avg) }
}
