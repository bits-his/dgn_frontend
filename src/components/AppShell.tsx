import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes,
  Calculator,
  ChevronDown,
  Factory,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Gauge,
  ShieldCheck,
  Truck,
  TrendingUp,
  Receipt,
  Users,
  HardHat,
  Wallet,
  Layers,
  Bell,
  X,
  PackagePlus,
  Hammer,
  Droplets,
  Store,
  Warehouse,
  Play,
  RotateCcw,
  Download,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { isOutletScoped, outletHomePath, outletNavLabel } from '@/lib/outlet'
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
  permission?: string
  badge?: number
  menuKey?: string
}

export type NavGroup = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  items: NavItem[]
}

export function canAccessNavItem(
  user: ReturnType<typeof useAuthStore.getState>['user'],
  item: NavItem,
): boolean {
  if (!user) return false
  // Overview is the universal home dashboard for all roles and is always accessible
  if (item.to === '/') return true
  // Admin has full access to everything
  if (user.roleCode === 'ADMIN' || user.permissions?.includes('*')) return true

  // If user has specific menuAccess array assigned
  if (user.menuAccess && Array.isArray(user.menuAccess) && user.menuAccess.length > 0) {
    if (item.menuKey) {
      if (user.menuAccess.includes(item.menuKey)) return true
      if (item.menuKey === 'recrushing' && user.menuAccess.includes('crushing')) return true
      if (item.menuKey === 'operators' && user.menuAccess.includes('staff')) return true
      if (item.menuKey === 'distributors' && user.menuAccess.includes('sales')) return true
      if (
        item.menuKey === 'processing_money' &&
        (hasPermission(user, 'float.give') || hasPermission(user, 'float.view') || hasPermission(user, 'float.spend'))
      ) {
        return true
      }
      return false
    }
    // Items without a menuKey
    if (item.permission) {
      return hasPermission(user, item.permission)
    }
    return true
  }

  // Fallback to permission check if no explicit menuAccess is configured on user
  if (item.permission) {
    return hasPermission(user, item.permission)
  }
  return true
}

function resolveNavItem(
  item: NavItem,
  user: ReturnType<typeof useAuthStore.getState>['user'],
): NavItem {
  if (item.menuKey !== 'distributors' || !isOutletScoped(user)) return item
  return {
    ...item,
    to: outletHomePath(user),
    label: outletNavLabel(user),
  }
}

const mainNavTop: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
]

const recyclingGroup: NavGroup = {
  id: 'recycling',
  label: 'Processing',
  icon: Factory,
  items: [
    { to: '/receiving', label: 'Scrap buying', icon: PackagePlus, menuKey: 'receiving', permission: 'receiving.create' },
    { to: '/process/crushing', label: 'Crushing', icon: Hammer, menuKey: 'crushing', permission: 'batch.create' },
    { to: '/process/washing', label: 'Washing', icon: Droplets, menuKey: 'washing', permission: 'batch.create' },
  ],
}

const recyclingNav: NavItem[] = [
  { to: '/process/recrushing', label: 'Re-crushing', icon: RotateCcw, menuKey: 'recrushing', permission: 'batch.create' },
]

const productionNav: NavItem[] = [
  { to: '/production/store', label: 'Material store', icon: Warehouse, menuKey: 'production_store', permission: 'batch.view' },
  { to: '/production', label: 'Production', icon: Play, end: true, menuKey: 'production', permission: 'batch.view' },
]

const mainNavRest: NavItem[] = [
  { to: '/qc', label: 'Quality control', icon: ShieldCheck, menuKey: 'qc', permission: 'batch.view' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, menuKey: 'inventory', permission: 'inventory.view' },
  { to: '/sales', label: 'Sales & dispatch', icon: Truck, end: true, menuKey: 'sales', permission: 'sales.view' },
  { to: '/distributors', label: 'Distributors', icon: Store, menuKey: 'distributors', permission: 'sales.view' },
  { to: '/batches', label: 'Batches', icon: Search, menuKey: 'batches', permission: 'batch.view' },
  // { to: '/suppliers', label: 'Suppliers', icon: Truck, menuKey: 'suppliers', permission: 'batch.view' },
  { to: '/masters', label: 'Masters', icon: Boxes, menuKey: 'masters', permission: 'masters.manage' },
]

const financeNav: NavItem[] = [
  { to: '/wallet', label: 'Wallet', icon: Wallet, menuKey: 'processing_money', permission: 'float.spend' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, menuKey: 'expenses', permission: 'expense.view' },
  { to: '/staff', label: 'Staff', icon: Users, menuKey: 'staff', permission: 'labour.view' },
  { to: '/operators', label: 'Operators', icon: HardHat, menuKey: 'operators', permission: 'labour.view' },
  { to: '/payroll', label: 'Payroll', icon: Wallet, menuKey: 'payroll', permission: 'labour.view' },
]

const intelligenceNav: NavItem[] = [
  { to: '/dashboard', label: 'Command centre', icon: LayoutDashboard, menuKey: 'dashboard', permission: 'dashboard.executive' },
  { to: '/machines', label: 'Machines & maintenance', icon: Gauge, menuKey: 'machines', permission: 'batch.view' },
  { to: '/sales/margins', label: 'Sales margin', icon: TrendingUp, menuKey: 'sales_margins', permission: 'sales.view' },
  { to: '/costs', label: 'Cost intelligence', icon: Calculator, end: true, menuKey: 'costs', permission: 'costs.view' },
  { to: '/costs/overhead', label: 'Factory overhead', icon: Layers, menuKey: 'overhead', permission: 'costs.view' },
]

function NavList({
  items,
  onNavigate,
  user,
  nested = false,
}: {
  items: NavItem[]
  onNavigate?: () => void
  user: ReturnType<typeof useAuthStore.getState>['user']
  nested?: boolean
}) {
  return (
    <div className="space-y-1">
      {items.map((raw) => {
        const item = resolveNavItem(raw, user)
        if (!canAccessNavItem(user, item)) return null
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl text-sm font-medium transition-colors',
                nested ? 'px-3 py-2' : 'px-3 py-2.5',
                isActive
                  ? 'bg-[var(--bg-sidebar-active)] text-white shadow-inner'
                  : 'text-zinc-300 hover:bg-[var(--bg-sidebar-hover)] hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex items-center justify-center rounded-lg',
                    nested ? 'size-7' : 'size-8',
                    isActive ? 'bg-[var(--accent)] text-[#1a1205]' : 'bg-white/5 text-zinc-300',
                  )}
                >
                  <Icon className={nested ? 'size-3.5' : 'size-4'} />
                </span>
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold',
                      isActive ? 'bg-[var(--accent)] text-[#1a1205]' : 'bg-red-500 text-white',
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </div>
  )
}

function CollapsibleNavGroup({
  group,
  user,
  onNavigate,
}: {
  group: NavGroup
  user: ReturnType<typeof useAuthStore.getState>['user']
  onNavigate?: () => void
}) {
  const location = useLocation()
  const visibleItems = group.items
    .map((item) => resolveNavItem(item, user))
    .filter((item) => canAccessNavItem(user, item))
  const childActive = visibleItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  if (!visibleItems.length) return null

  const Icon = group.icon

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          childActive
            ? 'bg-[var(--bg-sidebar-hover)] text-white'
            : 'text-zinc-300 hover:bg-[var(--bg-sidebar-hover)] hover:text-white',
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg',
            childActive ? 'bg-[var(--accent)] text-[#1a1205]' : 'bg-white/5 text-zinc-300',
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn('size-4 text-zinc-500 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="ml-3 border-l border-white/10 pl-2">
          <NavList items={visibleItems} user={user} onNavigate={onNavigate} nested />
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall()

  const canSeeAlerts = hasPermission(user, 'alert.view')
  const alertSummary = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/summary')
      return data.data as { total: number; unacknowledged: number; bySeverity: Record<string, number> }
    },
    enabled: canSeeAlerts,
    refetchInterval: 30_000,
  })

  const openCount = alertSummary.data?.total ?? 0
  const criticalCount = alertSummary.data?.bySeverity.CRITICAL ?? 0

  const intelligenceItems: NavItem[] = [
    ...intelligenceNav,
    { to: '/alerts', label: 'Alerts', icon: Bell, menuKey: 'alerts', permission: 'alert.view', badge: openCount },
  ]

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-sidebar)] text-white">
      <div className="shrink-0 border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#1a1205] shadow-lg shadow-amber-900/30">
            <Factory className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">DGN Factory</p>
            <p className="text-xs text-zinc-400">Control System</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {isOutletScoped(user) ? 'Shop' : 'Operations'}
        </p>
        {isOutletScoped(user) ? (
          <NavList
            items={[
              { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
              { to: '/shop/sales/new', label: 'Record sale', icon: Truck, permission: 'outlet.sell' },
              {
                to: outletHomePath(user),
                label: outletNavLabel(user),
                icon: Store,
                menuKey: 'distributors',
                permission: 'sales.view',
              },
            ]}
            user={user}
            onNavigate={() => setMobileOpen(false)}
          />
        ) : (
          <div className="space-y-1">
            <NavList items={mainNavTop} user={user} onNavigate={() => setMobileOpen(false)} />
            <CollapsibleNavGroup
              group={recyclingGroup}
              user={user}
              onNavigate={() => setMobileOpen(false)}
            />
            <NavList items={recyclingNav} user={user} onNavigate={() => setMobileOpen(false)} />
            <NavList items={productionNav} user={user} onNavigate={() => setMobileOpen(false)} />
            <NavList items={mainNavRest} user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        )}

        {!isOutletScoped(user) && financeNav.some((i) => canAccessNavItem(user, i)) && (
          <div className="mt-4 pb-1">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Money &amp; people
            </p>
            <NavList items={financeNav} user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        )}

        {!isOutletScoped(user) && intelligenceItems.some((i) => canAccessNavItem(user, i)) && (
          <div className="mt-4 pb-1">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Intelligence
            </p>
            <NavList items={intelligenceItems} user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="mb-3 rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-sm font-medium">
            {user?.firstname} {user?.lastname}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{user?.roleCode}</p>
        </div>

        <button
          type="button"
          className="dgn-btn dgn-btn-ghost w-full justify-start text-zinc-300 hover:bg-white/5 hover:text-white"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 hidden h-svh overflow-hidden bg-[var(--bg-sidebar)] lg:block pt-safe">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-80 overflow-hidden bg-[var(--bg-sidebar)] shadow-2xl pt-safe pb-safe">
            {sidebar}
          </div>
        </div>
      )}

      <div className="min-w-0 pb-safe">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/80 backdrop-blur-md pt-safe">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-white p-2 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
              <div>
                <p className="text-sm font-semibold tracking-tight">Factory floor control</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  Batch-first operations · NGN · Africa/Lagos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isInstalled && isInstallable && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80 px-2.5 py-1 text-xs font-bold transition-colors hover:bg-violet-100 shadow-xs"
                  onClick={() => promptInstall()}
                  title="Install DGN Factory Control App"
                >
                  <Download className="size-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="hidden sm:inline">Install App</span>
                </button>
              )}
              {canSeeAlerts && openCount > 0 && (
                <button
                  type="button"
                  className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex ${
                    criticalCount > 0
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                  onClick={() => navigate('/alerts')}
                >
                  <Bell className="size-3.5" />
                  {openCount} alert{openCount === 1 ? '' : 's'}
                </button>
              )}
              <div className="hidden items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)] sm:flex">
                <GitBranch className="size-3.5" />
                Traceable batches
              </div>
            </div>
          </div>
        </header>

        <main className="px-0 py-0">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <PwaInstallPrompt />
    </div>
  )
}
