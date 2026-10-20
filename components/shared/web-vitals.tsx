'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window !== 'undefined') {
      const rating = metric.rating || 'good'
      const color =
        rating === 'good'
          ? '#10b981'
          : rating === 'needs-improvement'
            ? '#f59e0b'
            : '#ef4444'

      const valueFormatted =
        metric.name === 'CLS'
          ? metric.value.toFixed(3)
          : `${Math.round(metric.value)}ms`

      // Tampilkan indikator Web Vitals di console
      console.log(
        `%c[Web Vitals] ${metric.name}: ${valueFormatted} (${rating.toUpperCase()})`,
        `color: ${color}; font-weight: bold; padding: 2px 4px;`
      )
    }
  })

  return null
}
