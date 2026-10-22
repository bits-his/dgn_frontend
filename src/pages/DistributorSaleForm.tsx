import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field } from '@/components/ui'
import { fmtDozenPcs, isPieceUom } from '@/lib/units'

type Credit = {
  creditLimit: number
  outstanding: number
  available: number
  atLimit: boolean
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

// API now returns one row per product with embedded batches[]
type SellableProduct = {
  id: number
  productId: number | null
  productName: string | null
  qtyAvailable: number
  uom: string
  unitCost: number | null
  sellingPrice?: number | null
  standardPrice?: number | null
  // oldest batchNumber kept for backward-compat hint to backend
  batchNumber?: string | null
  batches?: { batchId: number; batchNumber: string; qty: number }[]
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
      return data.data as SellableProduct[]
    },
  })

  // Products are already one-per-product from the API — just sort by name
  const products = useMemo(() => {
    return (sellable.data ?? [])
      .slice()
      .sort((a, b) => (a.productName || '').localeCompare(b.productName || ''))
  }, [sellable.data])

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.productId ?? p.id) === productKey) ?? null,
    [products, productKey],
  )

  const qtyNum = Number(qty) || 0
  const priceNum = Number(unitPrice) || 0
  const lineTotal = qtyNum * priceNum
  const paidNum = Number(amountPaid) || 0
  const thisSaleDue = Math.max(0, lineTotal - paidNum)
  const projected = (credit.outstanding || 0) + thisSaleDue
  const creditBlocked = Boolean(
    thisSaleDue > 0.001 && projected > (credit.creditLimit || 0) + 0.001,
  )

  const overQty = qtyNum > 0 && selectedProduct != null && qtyNum > selectedProduct.qtyAvailable

  const canSubmit = Boolean(
    selectedProduct && qtyNum > 0 && priceNum > 0 && !saving && !creditBlocked && !overQty,
  )

  const submit = async (confirmLowMargin: boolean) => {
    if (!selectedProduct) return
    setError(null)
    setWarning(null)
    setSaving(true)
    try {
      const { data } = await api.post('/sales', {
        customerId,
        saleType,
        lines: [
          {
            productId: selectedProduct.productId,
            // batchNumber hint so backend can validate + resolve product if needed
            batchNumber: selectedProduct.batchNumber ?? undefined,
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
      setProductKey('')
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

  return (
    <Card className={wrapClass}>
      <h2 className="text-base font-semibold">{nested ? 'New sale' : 'Sell to this distributor'}</h2>

      <div className="mt-4 grid gap-3">
        {/* Product picker — one row per product, qty is total across all batches */}
        <Field
          label="Product"
          hint={
            selectedProduct
              ? `${
                  isPieceUom(selectedProduct.uom)
                    ? fmtDozenPcs(selectedProduct.qtyAvailable)
                    : `${fmt(selectedProduct.qtyAvailable)} ${selectedProduct.uom}`
                } available`
              : undefined
          }
        >
          <select
            className="dgn-input"
            value={productKey}
            onChange={(e) => {
              const key = e.target.value
              setProductKey(key)
              setQty('')
              // Pre-fill the standard selling price when a product is chosen
              const prod = products.find((p) => String(p.productId ?? p.id) === key)
              const price = Number(prod?.standardPrice ?? prod?.sellingPrice)
              setUnitPrice(Number.isFinite(price) && price > 0 ? String(price) : '')
            }}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.productId ?? p.id} value={String(p.productId ?? p.id)}>
                {p.productName || 'Finished goods'} —{' '}
                {isPieceUom(p.uom)
                  ? fmtDozenPcs(p.qtyAvailable)
                  : `${fmt(p.qtyAvailable)} ${p.uom}`}
              </option>
            ))}
          </select>
        </Field>

        {selectedProduct && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Quantity (${selectedProduct.uom})`}>
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
        )}
      </div>

      {selectedProduct && lineTotal > 0 && (
        <p className="mt-3 text-sm font-semibold text-zinc-800">Total {money(lineTotal)}</p>
      )}

      {!sellable.isLoading && products.length === 0 && (
        <p className="mt-3 text-sm font-medium text-zinc-800">
          No finished goods ready to sell. Quality control must accept finished goods first.
        </p>
      )}

      {overQty && selectedProduct && (
        <p className="mt-2 text-sm font-semibold text-red-700">
          Only {fmt(selectedProduct.qtyAvailable)} {selectedProduct.uom} available for{' '}
          {selectedProduct.productName}.
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

      {selectedProduct && (
        <button
          type="button"
          className="dgn-btn dgn-btn-primary mt-4"
          disabled={!canSubmit}
          onClick={() => submit(false)}
        >
          <Truck className="h-4 w-4" />
          {saving ? 'Recording…' : creditBlocked ? 'Credit limit reached' : 'Record sale'}
        </button>
      )}
    </Card>
  )
}
