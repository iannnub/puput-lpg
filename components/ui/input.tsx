import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numericOnly?: boolean
  allowDecimal?: boolean
  autoSelectOnFocus?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      inputMode,
      pattern,
      numericOnly,
      allowDecimal = false,
      autoSelectOnFocus = true,
      onKeyDown,
      onChange,
      onFocus,
      onWheel,
      ...props
    },
    ref
  ) => {
    const isNumeric =
      type === 'number' || type === 'tel' || inputMode === 'numeric' || inputMode === 'tel' || numericOnly === true

    // Mengaktifkan inputMode="numeric" dan pattern="[0-9]*" agar keyboard virtual HP langsung membuka keypad angka
    const resolvedInputMode =
      inputMode ?? (type === 'tel' ? 'numeric' : isNumeric ? 'numeric' : undefined)
    const resolvedPattern =
      pattern ?? (isNumeric && !allowDecimal ? '[0-9]*' : undefined)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isNumeric) {
        // Blokir notasi eksponensial ilmiah ('e', 'E') dan tanda minus/plus
        if (['e', 'E', '+', '-'].includes(e.key)) {
          e.preventDefault()
          return
        }
        // Blokir titik dan koma jika desimal tidak diizinkan
        if (!allowDecimal && (e.key === '.' || e.key === ',')) {
          e.preventDefault()
          return
        }
        // Jika numericOnly aktif pada input text/tel, blokir seluruh huruf & simbol selain digit & tombol kontrol
        if (numericOnly || type === 'tel') {
          const isControlKey = [
            'Backspace',
            'Delete',
            'Tab',
            'Escape',
            'Enter',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End'
          ].includes(e.key)
          const isShortcut = e.ctrlKey || e.metaKey
          const isDigit = /^[0-9]$/.test(e.key)

          if (!isControlKey && !isShortcut && !isDigit) {
            e.preventDefault()
            return
          }
        }
      }
      onKeyDown?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumeric && !allowDecimal) {
        // Otomatis buang angka 0 di depan jika diikuti angka lain (misal user mengetik di sebelah 0: '0100000' -> '100000')
        if (e.target.value.length > 1 && /^0\d+/.test(e.target.value)) {
          e.target.value = e.target.value.replace(/^0+(?=\d)/, '')
        }
      }
      onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ketika input angka diklik/difokuskan, otomatis seleksi teks agar angka default (seperti 0) langsung tertimpa
      if (isNumeric && autoSelectOnFocus) {
        e.target.select()
      }
      onFocus?.(e)
    }

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      // Mencegah perubahan angka tanpa sengaja saat scroll mouse
      if (isNumeric) {
        e.currentTarget.blur()
      }
      onWheel?.(e)
    }

    return (
      <input
        type={type}
        inputMode={resolvedInputMode}
        pattern={resolvedPattern}
        className={cn(
          'flex min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
          isNumeric &&
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className
        )}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onFocus={handleFocus}
        onWheel={handleWheel}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
