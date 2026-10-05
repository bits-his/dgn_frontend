import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Card } from '@/components/ui'
import { PhotoGallery } from '@/components/MaintenanceLogExtras'
import { parsePhotoUrls } from '@/lib/maintenanceForm'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type SecurityDetail = {
  id: number
  direction: 'IN' | 'OUT'
  kind: 'RAW' | 'FINISHED' | 'OTHER'
  description: string
  qty: number
  uom: string
  partyName: string
  vehicle: string | null
  notes: string | null
  photoUrls: string[]
  recordedAt: string
  recordedByName: string | null
}

const KIND_LABEL: Record<SecurityDetail['kind'], string> = {
  RAW: 'Raw material',
  FINISHED: 'Finished goods',
  OTHER: 'Other',
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="shrink-0 text-sm text-[var(--ink-muted)]">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold text-[var(--ink)] break-words">
        {value}
      </span>
    </li>
  )
}

export function SecurityDetailPage() {
  const { id } = useParams()

  const detail = useQuery({
    queryKey: ['security-log', id],
    queryFn: async () => {
      const { data } = await api.get(`/security/${id}`)
      return data.data as SecurityDetail
    },
    enabled: Boolean(id),
  })

  if (detail.isLoading) {
    return (
      <PageLayout title="Gate record" back backTo="/security" backLabel="Gate list">
        <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
      </PageLayout>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <PageLayout title="Gate record" back backTo="/security" backLabel="Gate list">
        <Card className="!p-4">
          <p className="text-red-600">Gate record not found.</p>
          <Link to="/security" className="mt-2 inline-block text-sm font-medium text-[var(--accent-strong)]">
            Back to Security
          </Link>
        </Card>
      </PageLayout>
    )
  }

  const row = detail.data
  const inn = row.direction === 'IN'
  const photos = parsePhotoUrls(row.photoUrls)

  return (
    <PageLayout
      title={row.description}
      description={`${formatDateTime(row.recordedAt)}${row.recordedByName ? ` · ${row.recordedByName}` : ''}`}
      back
      backTo="/security"
      backLabel="Gate list"
    >
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card className="!overflow-hidden !p-0">
          <div className="border-b border-[var(--line)] px-3 py-2.5 sm:px-4 sm:py-3">
            <h2 className="text-sm font-semibold sm:text-base">Movement details</h2>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            <DetailRow
              label="Direction"
              value={
                <span
                  className={cn(
                    'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    inn
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-amber-300 bg-amber-50 text-amber-900',
                  )}
                >
                  {inn ? 'Coming in' : 'Going out'}
                </span>
              }
            />
            <DetailRow label="Type" value={KIND_LABEL[row.kind] || row.kind} />
            <DetailRow label="What" value={row.description} />
            <DetailRow
              label="Quantity"
              value={`${Number(row.qty || 0).toLocaleString()} ${row.uom}`}
            />
            <DetailRow
              label={inn ? 'Who brought it' : 'Who took it'}
              value={row.partyName}
            />
            {row.vehicle ? <DetailRow label="Vehicle" value={row.vehicle} /> : null}
            {row.notes ? <DetailRow label="Note" value={row.notes} /> : null}
            <DetailRow label="Recorded" value={formatDateTime(row.recordedAt)} />
            {row.recordedByName ? (
              <DetailRow label="Recorded by" value={row.recordedByName} />
            ) : null}
          </ul>
        </Card>

        {photos.length > 0 && (
          <Card className="!p-3 sm:!p-4">
            <h2 className="text-sm font-semibold sm:text-base">Photos</h2>
            <p className="mt-0.5 text-[11px] text-[var(--ink-muted)] sm:text-xs">
              Attached at the gate
            </p>
            <div className="mt-3">
              <PhotoGallery photos={photos} size="lg" />
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
