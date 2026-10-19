'use client'

import { useState, useTransition } from 'react'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    startTransition(async () => {
      const result = await loginAction(email, password)
      if (result?.error) {
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <Alert variant="danger">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="identifier">Username atau Email</Label>
        <Input
          id="identifier"
          type="text"
          required
          autoComplete="username"
          placeholder="adminlpg"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Masukkan password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={isPending}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Memverifikasi...' : 'Masuk ke Sistem'}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Lupa password? Hubungi Owner Pangkalan.
      </p>
    </form>
  )
}
