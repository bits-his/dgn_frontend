import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Eye } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { DateRangePreset } from '@/components/DateRangePreset'
import { mediaUrl, parsePhotoUrls } from '@/lib/maintenanceForm'
import { formatDateTime } from '@/lib/dates'
import {
  dateRangeApiParams,
  type DateRangeState,
} from '@/lib/dateRange'
import { cn } from '@/lib/utils'

type SecurityRow = {
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

const KIND_LABEL: Record<SecurityRow['kind'], string> = {
  RAW: 'Raw material',
  FINISHED: 'Finished goods',
  OTHER: 'Other',
}

function applyRangeToParams(current: URLSearchParams, next: DateRangeState) {
  const params = new URLSearchParams(current)
  params.set('rangePreset', next.rangePreset)
  if (next.rangePreset === 'custom' && next.from && next.to) {
    params.set('from', next.from)
    params.set('to', next.to)
  } else {
    params.delete('from')
    params.delete('to')
  }
  return params
}

export function SecurityPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rangeState: DateRangeState = {
    rangePreset: searchParams.get('rangePreset') || 'today',
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }
  const apiParams = dateRangeApiParams(rangeState)

  const setRange = (next: DateRangeState) => {
    setSearchParams(applyRangeToParams(searchParams, next), { replace: true })
  }

  const query = useQuery({
    queryKey: ['security-logs', apiParams],
    queryFn: async () => {
      const { data } = await api.get('/security', { params: apiParams })
      return (data.data || []) as SecurityRow[]
    },
  })

  const rows = query.data || []

  const columns = useMemo<ColumnDef<SecurityRow>[]>(
    () => [
      {
        id: 'recordedAt',
        header: 'When',
        accessorKey: 'recordedAt',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-bold text-zinc-900">{formatDateTime(row.original.recordedAt)}</p>
            {row.original.recordedByName ? (
              <p className="text-[11px] text-zinc-500">{row.original.recordedByName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'direction',
        header: 'In / Out',
        accessorKey: 'direction',
        cell: ({ row }) => {
          const inn = row.original.direction === 'IN'
          return (
            <span
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                inn
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-900',
              )}
            >
              {inn ? 'In' : 'Out'}
            </span>
          )
        },
      },
      {
        id: 'what',
        header: 'What',
        accessorKey: 'description',
        cell: ({ row }) => {
          const r = row.original
          const thumbs = parsePhotoUrls(r.photoUrls).slice(0, 3)
          return (
            <div>
              <p className="text-sm font-semibold text-zinc-900">{r.description}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {KIND_LABEL[r.kind] || r.kind}
                {' · '}
                {Number(r.qty || 0).toLocaleString()} {r.uom}
              </p>
              {thumbs.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  {thumbs.map((src, i) => (
                    <a
                      key={`${src.slice(0, 20)}-${i}`}
                      href={mediaUrl(src)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={mediaUrl(src)}
                        alt=""
                        className="size-10 rounded-md border border-zinc-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'party',
        header: 'Who',
        accessorKey: 'partyName',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-zinc-900">{row.original.partyName}</p>
            {row.original.vehicle ? (
              <p className="text-[11px] text-zinc-500">{row.original.vehicle}</p>
            ) : null}
            {row.original.notes ? (
              <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-zinc-500">
                {row.original.notes}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-medium cursor-pointer"
              onClick={() => navigate(`/security/${row.original.id}`)}
              title="View gate record"
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span className="hidden sm:inline">View</span>
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  )

  return (
    <PageLayout
      title="Security"
      description="Gate record of anything coming in or going out. Photos only — stock does not change here."
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangePreset value={rangeState} onChange={setRange} />
          <Button
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={() => navigate('/security/new')}
          >
            <Plus className="size-3.5 shrink-0" />
            Record movement
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <CustomTable1 data={rows} columns={columns} loading={query.isLoading} card />
      </div>
    </PageLayout>
  )
}
