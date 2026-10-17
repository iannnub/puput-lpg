'use client'

import * as React from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { getWibTodayString } from '@/lib/utils/date-wib'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, CheckCircle2 } from 'lucide-react'

export async function uploadCompressedProof(
  file: File,
  bucket: 'transaction-proofs' | 'payment-proofs'
): Promise<{ storagePath: string; signedPreviewUrl: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG/PNG/WebP)')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file asli maksimal 5MB')
  }

  const compressedFile = await imageCompression(file, {
    maxSizeMB: 0.1, // Target ~100KB
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp'
  })

  const supabase = createClient()
  const monthFolder = getWibTodayString().slice(0, 7) // 'YYYY-MM'
  const fileName = `${monthFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, compressedFile, {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: false
    })

  if (error || !data) {
    throw new Error('Gagal mengunggah bukti foto: ' + (error?.message ?? 'Unknown error'))
  }

  const { data: signedData, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 3600)

  if (signErr || !signedData) {
    throw new Error('Gagal membuat signed URL preview')
  }

  return {
    storagePath: data.path,
    signedPreviewUrl: signedData.signedUrl
  }
}

interface ImageUploadFieldProps {
  bucket: 'transaction-proofs' | 'payment-proofs'
  label?: string
  value: string | null
  onChange: (storagePath: string | null) => void
}

export function ImageUploadField({
  bucket,
  label = 'Upload Foto Bukti (Opsional, Maks 5MB - Otomatis Kompres WebP)',
  value,
  onChange
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg(null)
    setUploading(true)
    try {
      const result = await uploadCompressedProof(file, bucket)
      onChange(result.storagePath)
      setPreviewUrl(result.signedPreviewUrl)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunggah gambar')
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleClear = () => {
    onChange(null)
    setPreviewUrl(null)
    setErrorMsg(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-slate-800">{label}</div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {!value ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            <span>{uploading ? 'Mengompres & Mengunggah...' : 'Pilih Foto'}</span>
          </Button>
          <span className="text-xs text-slate-600">
            JPG/PNG/WebP maks 5MB, dikompres otomatis ke ~100KB
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate font-mono text-xs">{value}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
              <span>Hapus</span>
            </Button>
          </div>
          {previewUrl && (
            <div className="overflow-hidden rounded border border-slate-200 bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview bukti foto"
                className="max-h-48 w-auto object-contain"
              />
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
