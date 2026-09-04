const FIELD_LABELS: Record<string, string> = {
  supplierId: 'Supplier',
  materialId: 'Material',
  locationId: 'Location',
  inboundForm: 'Buy type',
  kg: 'Quantity (kg)',
  tons: 'Quantity (tons)',
  pricePerKg: 'Price / kg',
  inputBatchNumber: 'Input batch',
  qtyInput: 'Qty in',
  qtyUsable: 'Usable qty',
  qtyReject: 'Reject',
  qtyWaste: 'Waste',
  colorLines: 'Colours',
  balance: 'Balance',
  transportCost: 'Transport',
  loadingCost: 'Loading',
  unloadingCost: 'Unloading',
  otherCost: 'Other cost',
  batchNumber: 'Lot number',
  record: 'Record',
  database: 'Database',
  error: 'Error',
  server: 'Server',
}

export type ErrorItem = { field?: string; label: string; message: string }

/** Turn API `{ errors: { field: msg } }` or a single string into a readable list. */
export function formatApiErrors(
  errors?: Record<string, string> | string[] | null,
  fallback?: string | null,
): ErrorItem[] {
  if (errors && !Array.isArray(errors) && typeof errors === 'object') {
    const entries = Object.entries(errors)
    if (entries.length) {
      return entries.map(([field, message]) => ({
        field,
        label:
          FIELD_LABELS[field] ||
          field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        message: String(message),
      }))
    }
  }
  if (Array.isArray(errors) && errors.length) {
    return errors.map((message) => ({ label: 'Error', message: String(message) }))
  }
  if (fallback && fallback !== 'Validation error') {
    return [{ label: 'Error', message: fallback }]
  }
  if (fallback === 'Validation error') {
    return [
      {
        label: 'Save failed',
        message:
          'The server rejected this save (often a duplicate lot number). Try again — if it keeps failing, refresh and re-select the scrap ticket.',
      },
    ]
  }
  return []
}

export function errorsToLines(items: ErrorItem[]): string[] {
  return items.map((item) =>
    item.field || item.label !== 'Error' ? `${item.label}: ${item.message}` : item.message,
  )
}
