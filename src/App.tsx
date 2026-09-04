import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { ScrapReceivingPage } from '@/pages/ScrapReceivingPage'
import { BatchesPage } from '@/pages/BatchesPage'
import { BatchDetailPage } from '@/pages/BatchDetailPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { MastersPage } from '@/pages/MastersPage'
import { ProcessStagePage } from '@/pages/ProcessStagePage'
import { CostIntelligencePage } from '@/pages/CostIntelligencePage'
import { ProductionPage } from '@/pages/ProductionPage'
import { MachinePerformancePage } from '@/pages/MachinePerformancePage'
import { InventoryPage } from '@/pages/InventoryPage'
import { StockLedgerPage } from '@/pages/StockLedgerPage'
import { QcPage } from '@/pages/QcPage'
import { QcTrendsPage } from '@/pages/QcTrendsPage'
import { SalesPage } from '@/pages/SalesPage'
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthHydrator({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
  }, [hydrate])
  return children
}

function App() {
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
                <Route path="/receiving" element={<ScrapReceivingPage />} />
                <Route path="/process/:stage" element={<ProcessStagePage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/machines" element={<MachinePerformancePage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/inventory/ledger" element={<StockLedgerPage />} />
                <Route path="/qc" element={<QcPage />} />
                <Route path="/qc/trends" element={<QcTrendsPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/margins" element={<SalesMarginPage />} />
                <Route path="/sales/:saleNumber" element={<SaleDetailPage />} />
                <Route path="/distributors" element={<DistributorsPage />} />
                <Route path="/distributors/:code" element={<DistributorDetailPage />} />
                <Route path="/batches" element={<BatchesPage />} />
                <Route path="/batches/:batchNumber" element={<BatchDetailPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/labour" element={<LabourPage />} />
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
