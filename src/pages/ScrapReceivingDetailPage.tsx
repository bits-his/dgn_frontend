import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Card } from '@/components/ui'

/**
 * Scrap buying view uses the same batch detail page so all later stages
 * (crush / wash / dry / re-crush) show on one screen.
 */
export function ScrapReceivingDetailPage() {
  const { id } = useParams<{ id: string }>()

  const detail = useQuery({
    queryKey: ['scrap-receipt', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get(`/receiving/scrap/${id}`)
      return data.data as { batch?: { batchNumber?: string } | null }
    },
  })

  if (detail.isLoading) {
    return (
      <PageLayout title="Scrap buying details" back backTo="/receiving">
        <Card className="p-4 text-sm text-[var(--ink-muted)] sm:p-6">Loading receipt…</Card>
      </PageLayout>
    )
  }

  const batchNumber = detail.data?.batch?.batchNumber
  if (batchNumber) {
    return <Navigate to={`/batches/${encodeURIComponent(batchNumber)}`} replace />
  }

  return (
    <PageLayout title="Scrap buying details" back backTo="/receiving">
      <Card className="p-4 text-sm text-red-700 sm:p-6">Scrap receipt not found.</Card>
    </PageLayout>
  )
}
