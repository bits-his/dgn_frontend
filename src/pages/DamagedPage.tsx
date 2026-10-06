import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2, Trash2, Warehouse } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { ColorCombobox } from '@/components/ui/color-combobox'
import { ProcessingWalletPayBox } from '@/components/ProcessingWalletPayBox'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { colorName } from '@/pages/ProcessStagePage'

type DamagedLot = {
  id: number
  piecesRemaining: number
}

type ColorLine = {
  color: string
  qtyKg: number
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function DamagedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')
  const [labourRate, setLabourRate] = useState('')
  const [colorError, setColorError] = useState('')
  const [notes, setNotes] = useState('')
  const [payFromWallet, setPayFromWallet] = useState(true)
  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const query = useQuery({
    queryKey: ['damaged-goods'],
    queryFn: async () => {
      const { data } = await api.get('/production/damaged')
      return (data.data || []) as DamagedLot[]
    },
  })

  const rows = query.data || []
  const hasDamaged = rows.length > 0
  const totalKg = useMemo(
    () => +colorLines.reduce((sum, line) => sum + Number(line.qtyKg || 0), 0).toFixed(3),
    [colorLines],
  )
  const rateNum = Number(labourRate) || 0
  const labourTotal = +(totalKg * rateNum).toFixed(2)

  function addColorLine() {
    setColorError('')
    const color = String(pickColor || '').toUpperCase().trim()
    const qtyKg = Number(pickKg)
    if (!color) {
      setColorError('Pick a colour.')
      return
    }
    if (!(qtyKg > 0)) {
      setColorError('Enter kg for this colour.')
      return
    }
    if (colorLines.some((line) => line.color === color)) {
      setColorError('That colour is already added.')
      return
    }
    setColorLines((prev) => [...prev, { color, qtyKg: +qtyKg.toFixed(3) }])
    setPickColor('')
    setPickKg('')
  }

  function removeColorLine(color: string) {
    setColorLines((prev) => prev.filter((line) => line.color !== color))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErrors([])
    setSuccess('')
    if (!colorLines.length) {
      setErrors([{ label: 'Colours', message: 'Add at least one colour with kg.' }])
      return
    }
    if (!(rateNum > 0)) {
      setErrors([{ label: 'Labour', message: 'Enter labour ₦/kg.' }])
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/production/damaged/recrush', {
        colorLines,
        labourRatePerKg: rateNum,
        notes: notes.trim() || undefined,
        payFromProcessingWallet: payFromWallet,
      })
      setSuccess(data.message || 'Sent to the material store.')
      setColorLines([])
      setPickColor('')
      setPickKg('')
      setLabourRate('')
      setNotes('')
      setPayFromWallet(true)
      await queryClient.invalidateQueries({ queryKey: ['damaged-goods'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      navigate('/production/store', { replace: true })
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { errors?: Record<string, string>; message?: string; err?: string } }
      }
      setErrors(
        formatApiErrors(
          axiosErr.response?.data?.errors,
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.err ||
            'Re-crush could not be saved.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout
      title="Damaged"
      description="Weigh each colour, enter one labour ₦/kg for all, and send kg to the material store"
    >
      <div className="w-full space-y-4">
        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {success}{' '}
              <Link to="/production/store" className="underline">
                Open material store
              </Link>
            </span>
          </div>
        )}

        {hasDamaged && (
          <p className="text-xs text-zinc-500">
            {rows.length} production damage lot{rows.length === 1 ? '' : 's'} will close automatically when you
            save.
          </p>
        )}

        <form className="space-y-4" onSubmit={submit}>
            <ErrorBanner items={errors} />

            <Card className="!p-4 sm:!p-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
                  Colours · kg
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Add each colour with its weighed kg. Labour is one rate for all colours.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
                <div className="flex-1 shrink-0 min-w-0">
                  <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                    Colour
                  </label>
                  <ColorCombobox
                    value={pickColor}
                    onChange={(code) => {
                      setPickColor(code)
                      setColorError('')
                      setTimeout(() => {
                        document.getElementById('damaged-pick-kg')?.focus()
                      }, 80)
                    }}
                    exclude={colorLines.map((l) => l.color)}
                    placeholder="Pick a colour…"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                    Kg
                  </label>
                  <input
                    id="damaged-pick-kg"
                    inputMode="decimal"
                    className={`dgn-input w-full ${colorError ? 'border-red-400 focus:border-red-500' : ''}`}
                    placeholder="0.000"
                    value={pickKg}
                    onChange={(e) => {
                      setPickKg(e.target.value)
                      setColorError('')
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColorLine())}
                  />
                </div>
                <div className="sm:shrink-0 sm:w-28">
                  <Button
                    type="button"
                    className="w-full h-11 font-semibold"
                    onClick={addColorLine}
                  >
                    + Add
                  </Button>
                </div>
              </div>

              {colorError && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-600">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{colorError}</span>
                </div>
              )}

              {colorLines.length > 0 && (
                <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-100 overflow-hidden">
                  {colorLines.map((line) => (
                    <li key={line.color} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                      <span className="flex-1 text-sm font-medium">{colorName(line.color)}</span>
                      <span className="text-sm font-semibold tabular-nums text-zinc-800">
                        {line.qtyKg.toLocaleString()} kg
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => removeColorLine(line.color)}
                        title="Remove colour"
                      >
                        <Trash2 className="size-3.5 text-zinc-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="!p-2.5 sm:!p-3.5">
              <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
                <Field label="Labour rate / kg (₦)">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="dgn-input"
                    value={labourRate}
                    onChange={(e) => setLabourRate(e.target.value)}
                    placeholder="e.g. 15"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Note">
                    <input
                      className="dgn-input"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional note"
                    />
                  </Field>
                </div>
                {rateNum > 0 && totalKg > 0 && (
                  <div className="sm:col-span-2 rounded-md bg-emerald-50/90 border border-emerald-200/80 px-3 py-1.5 text-xs font-medium text-emerald-900 flex items-center justify-between">
                    <span>
                      Calculated re-crush labour (₦{rateNum.toLocaleString()}/kg ×{' '}
                      {totalKg.toLocaleString()} kg):
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-emerald-700">
                      {money(labourTotal)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <ProcessingWalletPayBox checked={payFromWallet} onChange={setPayFromWallet} />

            <div className="pt-1 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <Button
                type="submit"
                size="default"
                disabled={saving || !colorLines.length || !(rateNum > 0)}
                className="w-full sm:w-auto h-9 sm:h-10 px-5 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-xs cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                    <span>Moving to Material…</span>
                  </>
                ) : (
                  <>
                    <Warehouse className="size-3.5 sm:size-4 shrink-0" />
                    <span>Move to Material Store</span>
                  </>
                )}
              </Button>
            </div>
          </form>
      </div>
    </PageLayout>
  )
}
