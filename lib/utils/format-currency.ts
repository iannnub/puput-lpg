/**
 * Format & parse nilai uang Rupiah penuh (BIGINT integer tanpa desimal)
 */

export function formatRupiah(amount: number | string | bigint | null | undefined): string {
  const num = Number(amount ?? 0)
  if (Number.isNaN(num)) return 'Rp 0'
  const sign = num < 0 ? '- ' : ''
  return `${sign}Rp ${Math.abs(Math.round(num)).toLocaleString('id-ID')}`
}

export function formatNumber(value: number | string | bigint | null | undefined): string {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '0'
  return Math.round(num).toLocaleString('id-ID')
}

export function parseRupiahInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '')
  if (!digitsOnly) return 0
  return parseInt(digitsOnly, 10)
}
