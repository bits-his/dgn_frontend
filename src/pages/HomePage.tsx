import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calculator,
  Cog,
  Gauge,
  Boxes,
  ShieldCheck,
  PackagePlus,
  Filter,
  Hammer,
  Droplets,
  Flame,
  Search,
  Truck,
  Store,
  Users,
  Receipt,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { DashboardPage } from '@/pages/DashboardPage'

const actions = [
  {
    to: '/receiving',
    title: 'Scrap buying',
    desc: 'Buy raw or crushed material and issue the factory lot',
    icon: PackagePlus,
    permission: 'receiving.create',
    tone: 'from-amber-500 to-orange-600',
  },
  {
    to: '/process/sorting',
    title: 'Sorting',
    desc: 'Sort usable vs waste from raw scrap lots',
    icon: Filter,
    permission: 'batch.create',
    tone: 'from-slate-700 to-slate-900',
  },
  {
    to: '/process/crushing',
    title: 'Crushing',
    desc: 'Crush sorted material',
    icon: Hammer,
    permission: 'batch.create',
    tone: 'from-slate-700 to-slate-900',
  },
  {
    to: '/process/washing',
    title: 'Washing',
    desc: 'Wash crushed material (also for bought-crushed inbound)',
    icon: Droplets,
    permission: 'batch.create',
    tone: 'from-slate-700 to-slate-900',
  },
  {
    to: '/process/drying',
    title: 'Drying',
    desc: 'Dry washed material ready for production',
    icon: Flame,
    permission: 'batch.create',
    tone: 'from-slate-700 to-slate-900',
  },
  {
    to: '/qc',
    title: 'Quality control',
    desc: 'Inspect batches, pass, fail or send to rework',
    icon: ShieldCheck,
    permission: 'batch.view',
    tone: 'from-emerald-600 to-emerald-800',
  },
  {
    to: '/inventory',
    title: 'Inventory',
    desc: 'Stock on hand, alerts and movement ledger',
    icon: Boxes,
    permission: 'inventory.view',
    tone: 'from-sky-600 to-sky-800',
  },
  {
    to: '/sales',
    title: 'Sales & dispatch',
    desc: 'Sell accepted goods and track what each batch earned',
    icon: Truck,
    permission: 'sales.view',
    tone: 'from-indigo-600 to-indigo-800',
  },
  {
    to: '/distributors',
    title: 'Distributors',
    desc: 'Credit limits, what they owe, and who is blocked',
    icon: Store,
    permission: 'sales.view',
    tone: 'from-orange-600 to-amber-800',
  },
  {
    to: '/staff',
    title: 'Staff',
    desc: 'Staff directory, attendance, roles and system access',
    icon: Users,
    permission: 'labour.view',
    tone: 'from-rose-600 to-rose-800',
  },
  {
    to: '/expenses',
    title: 'Expenses',
    desc: 'Record and approve what the factory spends',
    icon: Receipt,
    permission: 'expense.view',
    tone: 'from-stone-600 to-stone-800',
  },
  {
    to: '/production',
    title: 'Production',
    desc: 'Make finished goods from dried lots',
    icon: Cog,
    permission: 'batch.view',
    tone: 'from-violet-600 to-violet-800',
  },
  {
    to: '/machines',
    title: 'Machines & insights',
    desc: 'Downtime, operators, products & OEE',
    icon: Gauge,
    permission: 'batch.view',
    tone: 'from-cyan-700 to-cyan-900',
  },
  {
    to: '/costs',
    title: 'Cost intelligence',
    desc: 'True cost per kg across the lineage',
    icon: Calculator,
    permission: 'costs.view',
    tone: 'from-amber-700 to-amber-900',
  },
  {
    to: '/batches',
    title: 'Find a batch',
    desc: 'Search any factory lot and open Batch 360°',
    icon: Search,
    permission: 'batch.view',
    tone: 'from-zinc-700 to-zinc-900',
  },
]

export function HomePage() {
  const user = useAuthStore((s) => s.user)

  if (hasPermission(user, 'dashboard.executive')) {
    return <DashboardPage />
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          if (action.permission && !hasPermission(user, action.permission)) return null
          const Icon = action.icon
          return (
            <Link
              key={action.to}
              to={action.to}
              className="dgn-card group flex min-h-24 flex-col justify-between p-3.5 transition hover:-translate-y-0.5 hover:border-amber-300"
            >
              <div
                className={`flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-white shadow-lg`}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{action.title}</h3>
                <ArrowRight className="size-4 text-[var(--ink-faint)] transition group-hover:text-[var(--accent-strong)]" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
