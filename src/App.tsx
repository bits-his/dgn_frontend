import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { api } from '@/lib/api'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { ScrapReceivingListPage } from '@/pages/ScrapReceivingListPage'
import { ScrapReceivingPage } from '@/pages/ScrapReceivingPage'
import { BatchesPage } from '@/pages/BatchesPage'
import { BatchDetailPage } from '@/pages/BatchDetailPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { MastersPage } from '@/pages/MastersPage'
import { ProcessStageListPage } from '@/pages/ProcessStageListPage'
import { ProcessStagePage } from '@/pages/ProcessStagePage'
import { CostIntelligencePage } from '@/pages/CostIntelligencePage'
import { ProductionPage } from '@/pages/ProductionPage'
import { ProductionStorePage } from '@/pages/ProductionStorePage'
import { RecordProductionPage } from '@/pages/RecordProductionPage'
import { CompleteProductionPage } from '@/pages/CompleteProductionPage'
import { MachinePerformancePage } from '@/pages/MachinePerformancePage'
import { MachineDetailPage } from '@/pages/MachineDetailPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { StockLedgerPage } from '@/pages/StockLedgerPage'
import { QcPage } from '@/pages/QcPage'
import { QcTrendsPage } from '@/pages/QcTrendsPage'
import { SalesPage } from '@/pages/SalesPage'
import { NewSalePage } from '@/pages/NewSalePage'
import { SaleDetailPage } from '@/pages/SaleDetailPage'
import { SaleInvoicePage, SaleReceiptPage } from '@/pages/SaleDocumentPage'
import { DistributorsPage } from '@/pages/DistributorsPage'
import { DistributorDetailPage } from '@/pages/DistributorDetailPage'
import { SalesMarginPage } from '@/pages/SalesMarginPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { LabourPage } from '@/pages/LabourPage'
import { PayrollPage } from '@/pages/PayrollPage'
import { OverheadPage } from '@/pages/OverheadPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { useAuthStore } from '@/stores/auth-store'

function ProductionRunRedirect() {
  const { id } = useParams()
  const runs = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return (data.data || []) as Array<{ id: number; batch?: { batchNumber: string } }>
    },
  })
  const run = runs.data?.find((r) => String(r.id) === id)
  if (runs.isLoading) return <p className="p-4 text-xs text-zinc-500">Loading batch details…</p>
  if (run?.batch?.batchNumber) {
    return <Navigate to={`/batches/${run.batch.batchNumber}`} replace />
  }
  return <Navigate to="/production" replace />
}

function AuthHydrator({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
  }, [hydrate])
  return children
}

function App() {
  // On mobile devices and web browsers, refetch active page queries immediately
  // whenever returning from another app, backgrounding/foregrounding, or tab switching.
  useEffect(() => {
    const handleActive = () => {
      if (document.visibilityState === 'visible') {
        queryClient.refetchQueries({ type: 'active' })
      }
    }
    document.addEventListener('visibilitychange', handleActive)
    window.addEventListener('pageshow', handleActive)
    window.addEventListener('focus', handleActive)
    return () => {
      document.removeEventListener('visibilitychange', handleActive)
      window.removeEventListener('pageshow', handleActive)
      window.removeEventListener('focus', handleActive)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/sales/:saleNumber/invoice" element={<SaleInvoicePage />} />
              <Route path="/sales/:saleNumber/receipt" element={<SaleReceiptPage />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/floor" element={<Navigate to="/receiving" replace />} />
                <Route path="/receiving" element={<ScrapReceivingListPage />} />
                <Route path="/receiving/new" element={<ScrapReceivingPage />} />
                <Route path="/process/:stage" element={<ProcessStageListPage />} />
                <Route path="/process/:stage/new" element={<ProcessStagePage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/production/store" element={<ProductionStorePage />} />
                <Route path="/production/new" element={<RecordProductionPage />} />
                <Route path="/production/:id" element={<ProductionRunRedirect />} />
                <Route path="/production/:id/complete" element={<CompleteProductionPage />} />
                <Route path="/machines" element={<MachinePerformancePage />} />
                <Route path="/machines/:id" element={<MachineDetailPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/inventory/ledger" element={<StockLedgerPage />} />
                <Route path="/qc" element={<QcPage />} />
                <Route path="/qc/trends" element={<QcTrendsPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/new" element={<NewSalePage />} />
                <Route path="/sales/margins" element={<SalesMarginPage />} />
                <Route path="/sales/:saleNumber" element={<SaleDetailPage />} />
                <Route path="/distributors" element={<DistributorsPage />} />
                <Route path="/distributors/:code" element={<DistributorDetailPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/batches/:batchNumber" element={<BatchDetailPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/staff" element={<LabourPage />} />
                <Route path="/labour" element={<Navigate to="/staff" replace />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route path="/costs/overhead" element={<OverheadPage />} />
                <Route path="/costs" element={<CostIntelligencePage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/masters" element={<MastersPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthHydrator>
    </QueryClientProvider>
  )
}

export default App
