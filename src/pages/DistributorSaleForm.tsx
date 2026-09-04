import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field } from '@/components/ui'

type Credit = {
  creditLimit: number
  outstanding: number
  available: number
  atLimit: boolean
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

type SellableBatch = {
  id: number
  batchNumber: string
  productId: number | null
  productName: string | null
  qtyAvailable: number
  uom: string
  locationName: string | null
  unitCost: number | null
}

type ProductOption = {
  id: string
  name: string
  uom: string
  qty: number
  batchCount: number
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function DistributorSaleForm({
  customerId,
  credit,
  destination,
  nested = false,
}: {
  customerId: number
  credit: Credit
  destination?: string | null
  nested?: boolean
}) {
  const queryClient = useQueryClient()
  const [productKey, setProductKey] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [saleType, setSaleType] = useState('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const sellable = useQuery({
    queryKey: ['sellable-batches'],
    queryFn: async () => {
      const { data } = await api.get('/sales/sellable-batches')
      return data.data as SellableBatch[]
    },
  })

  const products = useMemo(() => {
    const map = new Map<string, ProductOption>()
    for (const batch of sellable.data ?? []) {
      const key = String(batch.productId ?? batch.productName ?? 'unknown')
      const name = batch.productName || 'Finished goods'
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          id: key,
          name,
          uom: batch.uom,
          qty: batch.qtyAvailable,
          batchCount: 1,
        })
      } else {
        existing.qty += batch.qtyAvailable
        existing.batchCount += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [sellable.data])

  const batchesForProduct = useMemo(() => {
    if (!productKey) return []
    return (sellable.data ?? []).filter(
      (batch) => String(batch.productId ?? batch.productName ?? 'unknown') === productKey,
    )
  }, [sellable.data, productKey])

  const selectedBatch = batchesForProduct.find((b) => b.batchNumber === batchNumber) || null
  const qtyNum = Number(qty) || 0
  const priceNum = Number(unitPrice) || 0
  const lineTotal = qtyNum * priceNum
  const paidNum = Number(amountPaid) || 0
  const thisSaleDue = Math.max(0, lineTotal - paidNum)
  const projected = (credit.outstanding || 0) + thisSaleDue
  const creditBlocked = Boolean(
    thisSaleDue > 0.001 && projected > (credit.creditLimit || 0) + 0.001,
  )

  const canSubmit = Boolean(
    selectedBatch && qtyNum > 0 && priceNum > 0 && !saving && !creditBlocked,
  )

  const submit = async (confirmLowMargin: boolean) => {
    if (!selectedBatch) return
    setError(null)
    setWarning(null)
    setSaving(true)
    try {
      const { data } = await api.post('/sales', {
        customerId,
        saleType,
        lines: [
          {
            batchNumber: selectedBatch.batchNumber,
            qty: qtyNum,
            unitPrice: priceNum,
          },
        ],
        amountPaid: paidNum,
        destination: destination || undefined,
        confirmLowMargin,
      })
      setResult(data.saleNumber)
      setQty('')
      setUnitPrice('')
      setAmountPaid('')
      setBatchNumber('')
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      await queryClient.invalidateQueries({ queryKey: ['sales-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['distributors'] })
      await queryClient.invalidateQueries({ queryKey: ['distributor'] })
      await queryClient.invalidateQueries({ queryKey: ['distributor-credit'] })
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.code === 'CREDIT_LIMIT_EXCEEDED') {
        setError(String(body.err || 'Credit limit reached'))
      } else if (body && body.warning) {
        setWarning(String(body.message))
      } else if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the sale'))
      }
    } finally {
      setSaving(false)
    }
  }

  const wrapClass = nested ? 'mb-0 !border-0 !p-0 !shadow-none' : 'mb-4 !p-4'

  if (result) {
    return (
      <Card className={wrapClass}>
        <p className="text-sm font-semibold text-zinc-800">Sale recorded</p>
        <p className="mt-1 font-mono text-lg font-semibold">{result}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="dgn-btn dgn-btn-primary" to={`/sales/${result}`}>
            Open dispatch note
          </Link>
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            onClick={() => setResult(null)}
          >
            Sell again
          </button>
        </div>
      </Card>
    )
  }

  const selectedProduct = products.find((p) => p.id === productKey) || null

  return (
    <Card className={wrapClass}>
      <h2 className="text-base font-semibold">{nested ? 'New sale' : 'Sell to this distributor'}</h2>

      <div className="mt-4 grid gap-3">
        <Field
          label="Product"
          hint={
            selectedProduct
              ? `${fmt(selectedProduct.qty)} ${selectedProduct.uom} ready in ${selectedProduct.batchCount} batch${
                  selectedProduct.batchCount === 1 ? '' : 'es'
                }`
              : undefined
          }
        >
          <select
            className="dgn-input"
            value={productKey}
            onChange={(e) => {
              setProductKey(e.target.value)
              setBatchNumber('')
              setQty('')
            }}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {productKey ? (
          <Field label="Production batch">
            <select
              className="dgn-input"
              value={batchNumber}
              onChange={(e) => {
                setBatchNumber(e.target.value)
                setQty('')
              }}
            >
              <option value="">Select batch with stock</option>
              {batchesForProduct.map((batch) => (
                <option key={batch.batchNumber} value={batch.batchNumber}>
                  {batch.batchNumber} — {fmt(batch.qtyAvailable)} {batch.uom} left
                  {batch.locationName ? ` (${batch.locationName})` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {selectedBatch ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Quantity (${selectedBatch.uom})`}>
              <input
                className="dgn-input"
                type="number"
                inputMode="decimal"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Unit price (₦)">
              <input
                className="dgn-input"
                type="number"
                inputMode="decimal"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Field>
            <Field label="Payment">
              <select
                className="dgn-input"
                value={saleType}
                onChange={(e) => setSaleType(e.target.value)}
              >
                <option value="CASH">Cash — paid on collection</option>
                <option value="CREDIT">Credit — pay later</option>
                <option value="TRANSFER">Bank transfer</option>
              </select>
            </Field>
            <Field label="Amount paid now (₦)">
              <input
                className="dgn-input"
                type="number"
                inputMode="decimal"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
        ) : null}
      </div>

      {selectedBatch && lineTotal > 0 && (
        <p className="mt-3 text-sm font-semibold text-zinc-800">Total {money(lineTotal)}</p>
      )}

      {!sellable.isLoading && products.length === 0 && (
        <p className="mt-3 text-sm font-medium text-zinc-800">
          No production batches are ready to sell. Quality control must accept finished goods first.
        </p>
      )}

      {qtyNum > 0 && selectedBatch && qtyNum > selectedBatch.qtyAvailable && (
        <p className="mt-2 text-sm font-semibold text-red-700">
          Only {fmt(selectedBatch.qtyAvailable)} {selectedBatch.uom} left in this batch.
        </p>
      )}

      {creditBlocked && (
        <p className="mt-3 text-sm font-semibold text-red-700">
          Credit limit reached. Collect payment first, or reduce the unpaid amount. They owe{' '}
          {money(credit.outstanding)} of {money(credit.creditLimit)}.
        </p>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {warning && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p>{warning}</p>
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary mt-2"
            disabled={saving}
            onClick={() => submit(true)}
          >
            Sell anyway
          </button>
        </div>
      )}

      {selectedBatch && (
        <button
          type="button"
          className="dgn-btn dgn-btn-primary mt-4"
          disabled={!canSubmit || qtyNum > selectedBatch.qtyAvailable}
          onClick={() => submit(false)}
        >
          <Truck className="h-4 w-4" />
          {saving ? 'Recording…' : creditBlocked ? 'Credit limit reached' : 'Record sale'}
        </button>
      )}
    </Card>
  )
}
