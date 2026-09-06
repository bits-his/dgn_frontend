import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Factory, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      setError('Invalid email or password. Please try again.')
    }
  })

  return (
    <div className="relative min-h-svh flex items-center justify-center p-4 bg-zinc-50/80 dark:bg-zinc-950">
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e730_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e730_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#27272a25_1px,transparent_1px),linear-gradient(to_bottom,#27272a25_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative w-full max-w-[380px]">
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-7 shadow-xs">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="size-11 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center shadow-xs mb-3">
              <Factory className="size-5" />
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              DGN Factory
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Sign in to operations & management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@dgn.factory"
                className="h-9 text-xs"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-9 pr-9 text-xs"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-9 text-xs font-semibold mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 mt-4">
          DGN Recycling & Manufacturing · Control System
        </p>
      </div>
    </div>
  )
}
