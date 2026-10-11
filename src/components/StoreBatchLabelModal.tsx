import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ExternalLink, Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatBusinessDate } from '@/lib/dates'
import { batchVerifyUrl } from '@/lib/batchLabel'

function colorLabel(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

export type StoreLabelColorLine = {
  color: string | null
  qtyKg: number
}

export type StoreLabelData = {
  batchNumber: string
  sourceBatchNumber?: string | null
  businessDate?: string | null
  colors: StoreLabelColorLine[]
  usableKg: number
  wasteKg: number
  operatorName?: string | null
  stageLabel?: string
}

type Props = {
  open: boolean
  data: StoreLabelData | null
  onDone: () => void
  doneLabel?: string
}

export function StoreBatchLabelModal({ open, data, onDone, doneLabel }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const verifyUrl = data?.batchNumber ? batchVerifyUrl(data.batchNumber) : ''
  const dateLabel = data?.businessDate
    ? formatBusinessDate(data.businessDate)
    : new Date().toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

  useEffect(() => {
    let cancelled = false
    if (!open || !verifyUrl) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [open, verifyUrl])

  const printedAt = new Date().toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-h-[92vh] w-[min(92vw,40rem)] max-w-[min(92vw,40rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none print:max-h-none print:w-full print:max-w-none print:overflow-visible print:border-0 print:shadow-none">
        <DialogHeader className="mb-0 border-b border-zinc-100 pb-2 print:hidden">
          <DialogTitle className="text-base font-bold tracking-tight">
            Store label
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
            QR opens the verify page with colour, batch number, and date. Print or save for later.
          </DialogDescription>
        </DialogHeader>

        {data && (
          <>
            <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-2 py-1.5 print:hidden">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Print preview
              </p>
            </div>

            <div
              id="store-batch-label-preview"
              className="mt-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm print:rounded-none print:border print:shadow-none"
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-2">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR ${data.batchNumber}`}
                      className="size-[160px] sm:size-[180px]"
                    />
                  ) : (
                    <div className="flex size-[160px] items-center justify-center bg-zinc-50 text-xs text-zinc-400 sm:size-[180px]">
                      QR…
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Batch number
                    </p>
                    <p className="font-mono text-xl font-bold tracking-tight text-zinc-900">
                      {data.batchNumber}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Date
                      </p>
                      <p className="font-semibold text-zinc-800">{dateLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Stage
                      </p>
                      <p className="font-semibold text-zinc-800">
                        {data.stageLabel || 'Re-crushing'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Usable
                      </p>
                      <p className="font-mono font-semibold text-emerald-700">
                        {data.usableKg.toLocaleString()} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Waste
                      </p>
                      <p className="font-mono font-semibold text-zinc-800">
                        {data.wasteKg.toLocaleString()} kg
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-zinc-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="px-3 py-2">Colour</th>
                          <th className="px-3 py-2 text-right">Qty (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.colors.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-zinc-500">
                              No colour lines
                            </td>
                          </tr>
                        ) : (
                          data.colors.map((line) => (
                            <tr
                              key={`${line.color}-${line.qtyKg}`}
                              className="border-t border-zinc-100"
                            >
                              <td className="px-3 py-1.5 font-semibold text-zinc-800">
                                {colorLabel(line.color)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                                {line.qtyKg.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
                    {data.operatorName ? (
                      <p>
                        Operator:{' '}
                        <span className="font-medium text-zinc-700">{data.operatorName}</span>
                      </p>
                    ) : null}
                    {data.sourceBatchNumber ? (
                      <p className="font-mono text-[10px]">
                        From {data.sourceBatchNumber}
                      </p>
                    ) : null}
                    <p>Labelled: {printedAt}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                asChild
              >
                <a href={verifyUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open verify
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="size-3.5" />
                Print
              </Button>
              <Button type="button" size="sm" className="font-semibold" onClick={onDone}>
                {doneLabel || 'Done · go to store'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
