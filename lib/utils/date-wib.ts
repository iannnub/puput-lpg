/**
 * Helper tanggal zona waktu WIB (Asia/Jakarta, UTC+7)
 * Mencegah pergeseran hari (off-by-one date) antara server UTC dan jam operasional Indonesia.
 */

export function getWibTodayString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export function getWibCurrentMonthYear(): { month: number; year: number } {
  const today = getWibTodayString()
  const [yearStr, monthStr] = today.split('-')
  return {
    year: Number(yearStr),
    month: Number(monthStr)
  }
}

export function addDaysWib(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+07:00`)
  d.setDate(d.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

export function formatWibDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(`${dateStr}T00:00:00+07:00`)
  if (Number.isNaN(d.getTime())) return String(dateStr)

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d)
}

export function formatWibDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return String(isoStr)

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function calculateDaysOverdue(dueDateStr: string | null | undefined): number {
  if (!dueDateStr) return 0
  const todayMs = new Date(`${getWibTodayString()}T00:00:00+07:00`).getTime()
  const dueMs = new Date(`${dueDateStr}T00:00:00+07:00`).getTime()
  return Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24))
}
