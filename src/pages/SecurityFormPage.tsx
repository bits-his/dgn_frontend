import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/ui'
import { MaintenancePhotoPicker } from '@/components/MaintenanceLogExtras'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { cn } from '@/lib/utils'

type Direction = 'IN' | 'OUT'
type Kind = 'RAW' | 'FINISHED' | 'OTHER'

function ChoiceButton({
  active,
  children,
  onClick,
  className,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-12 rounded-xl border text-sm font-semibold transition-colors active:scale-[0.99]',
        active
          ? 'border-zinc-900 bg-zinc-900 text-white'
          : 'border-zinc-200 bg-white text-zinc-700',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SecurityFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [direction, setDirection] = useState<Direction>('IN')
  const [kind, setKind] = useState<Kind>('RAW')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('')
  const [uom, setUom] = useState('kg')
  const [partyName, setPartyName] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErrors([])
    setSaved(false)
    if (!photos.length) {
      setErrors([{ label: 'Photo', message: 'Take or attach at least one photo.' }])
      return
    }
    setSaving(true)
    try {
      await api.post('/security', {
        direction,
        kind,
        description: description.trim(),
        qty: Number(qty),
        uom: uom.trim(),
        partyName: partyName.trim(),
        vehicle: vehicle.trim() || undefined,
        notes: notes.trim() || undefined,
        photoUrls: photos,
      })
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['security-logs'] })
      setTimeout(() => navigate('/security'), 700)
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { errors?: Record<string, string>; message?: string; err?: string } }
      }
      setErrors(
        formatApiErrors(
          axiosErr.response?.data?.errors,
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.err ||
            'Could not save this gate record.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout
      title="Record movement"
      description="Gate log only. Does not change stock."
      back
      backTo="/security"
      backLabel="Gate list"
    >
      <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-4 pb-24 sm:pb-6">
        <ErrorBanner items={errors} />

        {saved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0" />
            Saved. Going back to the list…
          </div>
        )}

        <section className="space-y-2">
          <Label className="text-sm font-bold text-zinc-800">Direction</Label>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={direction === 'IN'}
              onClick={() => setDirection('IN')}
              className={
                direction === 'IN'
                  ? '!border-emerald-700 !bg-emerald-700 !text-white'
                  : ''
              }
            >
              Coming in
            </ChoiceButton>
            <ChoiceButton
              active={direction === 'OUT'}
              onClick={() => setDirection('OUT')}
              className={
                direction === 'OUT' ? '!border-amber-700 !bg-amber-700 !text-white' : ''
              }
            >
              Going out
            </ChoiceButton>
          </div>
        </section>

        <section className="space-y-2">
          <Label className="text-sm font-bold text-zinc-800">Type</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ChoiceButton active={kind === 'RAW'} onClick={() => setKind('RAW')}>
              Raw material
            </ChoiceButton>
            <ChoiceButton active={kind === 'FINISHED'} onClick={() => setKind('FINISHED')}>
              Finished goods
            </ChoiceButton>
            <ChoiceButton active={kind === 'OTHER'} onClick={() => setKind('OTHER')}>
              Other
            </ChoiceButton>
          </div>
        </section>

        <section className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-800">What is moving</Label>
          <Input
            className="h-12 text-base"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scrap, cartons, diesel…"
            autoComplete="off"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-zinc-800">Quantity</Label>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              className="h-12 text-base"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-zinc-800">Unit</Label>
            <Input
              className="h-12 text-base"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="kg, pcs, bags"
              autoComplete="off"
            />
          </div>
        </section>

        <section className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-800">
            {direction === 'OUT' ? 'Who took it' : 'Who brought it'}
          </Label>
          <Input
            className="h-12 text-base"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="Name"
            autoComplete="name"
          />
        </section>

        <section className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-800">Vehicle (optional)</Label>
          <Input
            className="h-12 text-base"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Plate number"
            autoComplete="off"
          />
        </section>

        <section className="space-y-1.5">
          <Label className="text-sm font-bold text-zinc-800">Note (optional)</Label>
          <Input
            className="h-12 text-base"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else to remember"
            autoComplete="off"
          />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
          <MaintenancePhotoPicker
            label="Photo of the goods"
            photos={photos}
            onChange={setPhotos}
            variant="phone"
            required
          />
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            type="submit"
            disabled={saving || saved}
            className="h-12 w-full text-base font-semibold sm:h-11 sm:text-sm"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save gate record'}
          </Button>
        </div>
      </form>
    </PageLayout>
  )
}
