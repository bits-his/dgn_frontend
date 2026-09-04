import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'

type Grouped = {
  key: string
  label: string
  checks: number
  defects: number
  rejected: number
  rework: number
  inspected: number
  failed: number
  rejectRatePercent: number
  failRatePercent: number
}

type Trends = {
  totals: {
    checks: number
    passed: number
    failed: number
    held: number
    passRatePercent: number
    inspectedQty: number
    rejectedQty: number
    reworkQty: number
    rejectRatePercent: number
    defectCount: number
  }
  byDefect: Array<{ code: string; severity: string; count: number; occurrences: number }>
  byProduct: Grouped[]
  byMachine: Grouped[]
  byShift: Grouped[]
}

const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: 'text-red-600',
  MAJOR: 'text-[var(--accent-strong)]',
  MINOR: 'text-[var(--ink-muted)]',
}

function fmt(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function GroupTable({ title, rows }: { title: string; rows: Grouped[] }) {
  return (
    <Card>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Checks</th>
              <th className="py-2 pr-4 font-semibold">Defects</th>
              <th className="py-2 font-semibold">Reject rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-zinc-100">
                <td className="py-2 pr-4 font-semibold">{row.label}</td>
                <td className="py-2 pr-4">{row.checks}</td>
                <td className="py-2 pr-4">{row.defects}</td>
                <td className="py-2">
                  <span
                    className={
                      row.rejectRatePercent > 5 ? 'font-semibold text-red-600' : 'font-semibold'
                    }
                  >
                    {row.rejectRatePercent}%
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-4 text-[var(--ink-muted)]">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function QcTrendsPage() {
  const trends = useQuery({
    queryKey: ['qc-trends'],
    queryFn: async () => {
      const { data } = await api.get('/qc/defect-trends')
      return data.data as Trends
    },
  })

  const totals = trends.data?.totals

  return (
    <div>
      <PageHeader
        eyebrow="Quality control"
        title="Defect trends"
        description="Where quality problems come from, broken down by defect type, product, machine and shift."
        actions={
          <Link to="/qc" className="dgn-btn dgn-btn-secondary">
            <ArrowLeft className="size-4" />
            Back to queue
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatPill label="Inspections" value={String(totals?.checks ?? 0)} />
        <StatPill
          label="Pass rate"
          value={`${totals?.passRatePercent ?? 0}%`}
          tone={(totals?.passRatePercent ?? 0) >= 90 ? 'success' : 'accent'}
        />
        <StatPill label="Quantity inspected" value={fmt(totals?.inspectedQty ?? 0)} />
        <StatPill
          label="Reject + rework rate"
          value={`${totals?.rejectRatePercent ?? 0}%`}
          tone={(totals?.rejectRatePercent ?? 0) > 5 ? 'danger' : 'success'}
        />
        <StatPill label="Defects logged" value={String(totals?.defectCount ?? 0)} tone="accent" />
      </div>

      <Card className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Most common defects</h2>
        <div className="mt-4 space-y-2 text-sm">
          {trends.data?.byDefect.map((defect) => (
            <div key={defect.code} className="flex items-center justify-between gap-3">
              <span>
                {defect.code.replace(/_/g, ' ').toLowerCase()}
                <span className={`ml-2 text-xs font-semibold ${SEVERITY_TONE[defect.severity] ?? ''}`}>
                  {defect.severity.toLowerCase()}
                </span>
              </span>
              <strong>
                {defect.count} across {defect.occurrences}{' '}
                {defect.occurrences === 1 ? 'inspection' : 'inspections'}
              </strong>
            </div>
          ))}
          {!trends.isLoading && !trends.data?.byDefect.length && (
            <p className="text-[var(--ink-muted)]">No defects recorded yet.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <GroupTable title="By product" rows={trends.data?.byProduct ?? []} />
        <GroupTable title="By machine" rows={trends.data?.byMachine ?? []} />
        <GroupTable title="By shift" rows={trends.data?.byShift ?? []} />
      </div>
    </div>
  )
}
