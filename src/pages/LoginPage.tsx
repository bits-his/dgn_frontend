import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Factory } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@dgn.factory', password: 'admin123' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError('')
    try {
      await login(values.email, values.password)
      navigate('/')
    } catch {
      setError('Login failed. Check email and password.')
    }
  })

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f59e0b33,transparent_35%),linear-gradient(160deg,#0f141a_0%,#1c2733_45%,#3b2a14_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-white/95 p-7 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#1a1205]">
            <Factory className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">DGN Factory</h1>
            <p className="text-sm text-[var(--ink-muted)]">Sign in to the control system</p>
          </div>
        </div>

        <label className="block">
          <span className="dgn-label">Email</span>
          <input type="email" className="dgn-input" {...register('email')} />
          {errors.email && (
            <span className="mt-1 block text-sm text-red-600">{errors.email.message}</span>
          )}
        </label>

        <label className="block">
          <span className="dgn-label">Password</span>
          <input type="password" className="dgn-input" {...register('password')} />
          {errors.password && (
            <span className="mt-1 block text-sm text-red-600">{errors.password.message}</span>
          )}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isSubmitting} className="dgn-btn dgn-btn-primary w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
