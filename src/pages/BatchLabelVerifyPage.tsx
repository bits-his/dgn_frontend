import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { PublicBatchLabel } from '@/lib/batchLabel'

export function BatchLabelVerifyPage() {
  const { batchNumber: raw } = useParams()
  const batchNumber = decodeURIComponent(raw || '').trim()

  const lookup = useQuery({
    queryKey: ['public-batch-label', batchNumber],
    enabled: Boolean(batchNumber),
    queryFn: async () => {
      const { data } = await api.get(`/public/batch-label/${encodeURIComponent(batchNumber)}`)
      return data.data as PublicBatchLabel
    },
    retry: 1,
  })

  const payload = lookup.data
  const colorText =
    (payload?.colors || [])
      .map((row) => row.colorName || row.color)
      .filter(Boolean)
      .join(', ') || '—'

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_#eef2ff_0%,_#fafafa_45%,_#f4f4f5_100%)] text-zinc-900">
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">
            DGN · Verify
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Batch label</h1>
        </header>

        {!batchNumber ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing batch number in the URL.
          </p>
        ) : lookup.isLoading ? (
          <p className="text-sm text-zinc-500">Looking up batch…</p>
        ) : lookup.isError || !payload ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="font-semibold">Batch not found</p>
            <p className="mt-1 font-mono text-xs">{batchNumber}</p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <tbody>
                <tr className="border-b border-zinc-100">
                  <th className="w-[35%] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Batch number
                  </th>
                  <td className="px-4 py-3 break-all font-mono text-base font-bold tracking-tight">
                    {payload.batchNumber}
                  </td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Date
                  </th>
                  <td className="px-4 py-3 font-semibold">{payload.date || '—'}</td>
                </tr>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Colour
                  </th>
                  <td className="px-4 py-3 font-semibold">{colorText}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Total
                  </th>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                    {(payload.usableKg ?? 0).toLocaleString()} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}
