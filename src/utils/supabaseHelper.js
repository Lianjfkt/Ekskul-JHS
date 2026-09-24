/**
 * Supabase Helper Utilities
 * Fungsi utilitas untuk mengatasi keterbatasan Supabase, termasuk:
 * - Pagination otomatis untuk menarik seluruh data (bypass batas 1000 baris)
 */

/**
 * Fetch seluruh data dari tabel Supabase secara paginated.
 * Supabase secara default membatasi response hingga 1000 baris per request.
 * Fungsi ini otomatis melakukan fetch berulang hingga semua data terkumpul.
 *
 * @param {function} queryFn - Fungsi query Supabase yang menerima (from, to) untuk `.range(from, to)`.
 *   Contoh: (from, to) => supabase.from('attendances').select('*').range(from, to)
 * @param {number} [pageSize=1000] - Jumlah baris per batch (default: 1000).
 * @returns {Promise<Array>} - Seluruh data yang digabung dari semua batch.
 */
export async function fetchAllPaginated(queryFn, pageSize = 1000) {
  let allData = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await queryFn(from, from + pageSize - 1)
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
