/**
 * Supabase Helper Utilities
 * Fungsi utilitas untuk mengatasi keterbatasan Supabase, termasuk:
 * - Pagination otomatis untuk menarik seluruh data (bypass batas 1000 baris)
 * - Timeout guard untuk mencegah loading menggantung (stuck) selamanya
 */

/**
 * Wrapper Promise dengan timeout otomatis agar UI tidak menggantung (stuck) selamanya.
 * @param {Promise} promise - Promise query Supabase / asynchronous task.
 * @param {number} [timeoutMs=15000] - Batas waktu dalam milidetik (default: 15 detik).
 * @param {string} [errorMessage] - Pesan error kustom saat timeout terjadi.
 * @returns {Promise}
 */
export async function withTimeout(
  promise,
  timeoutMs = 15000,
  errorMessage = 'Permintaan data melebihi batas waktu (timeout). Silakan periksa koneksi internet Anda atau coba lagi.'
) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch seluruh data dari tabel Supabase secara paginated dengan timeout protection.
 * Supabase secara default membatasi response hingga 1000 baris per request.
 * Fungsi ini otomatis melakukan fetch berulang hingga semua data terkumpul.
 *
 * @param {function} queryFn - Fungsi query Supabase yang menerima (from, to) untuk `.range(from, to)`.
 *   Contoh: (from, to) => supabase.from('attendances').select('*').range(from, to)
 * @param {number} [pageSize=1000] - Jumlah baris per batch (default: 1000).
 * @param {number} [timeoutMs=20000] - Timeout per batch agar tidak menggantung (default: 20 detik).
 * @returns {Promise<Array>} - Seluruh data yang digabung dari semua batch.
 */
export async function fetchAllPaginated(queryFn, pageSize = 1000, timeoutMs = 20000) {
  let allData = []
  let from = 0
  let hasMore = true
  const maxBatches = 20 // Guardrail: maksimal 20.000 baris per panggilan

  let batchCount = 0
  while (hasMore && batchCount < maxBatches) {
    batchCount++
    const { data, error } = await withTimeout(
      queryFn(from, from + pageSize - 1),
      timeoutMs,
      `Gagal memuat batch data ke-${batchCount} (koneksi timeout). Silakan coba lagi.`
    )
    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }
    allData = allData.concat(data)
    if (data.length < pageSize) {
      hasMore = false
      break
    }
    from += pageSize
  }
  return allData
}
