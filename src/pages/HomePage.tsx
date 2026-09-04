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
import { Card, PageHeader } from '@/components/ui'
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
    title: 'Machines & OEE',
    desc: 'Machine performance and downtime',
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
      <PageHeader
        eyebrow="Operations hub"
        title={`Welcome back, ${user?.firstname || 'team'}`}
        description="Buy scrap, then at sorting mint a BAT- lot per colour. Crush, wash and dry keep that colour’s number."
      />

      <Card className="mb-6 overflow-hidden !p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-[linear-gradient(135deg,#12171d_0%,#243040_55%,#b45309_140%)] p-6 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Today’s flow
            </p>
            <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
              Buy scrap. Sort by colour. Process each colour lot.
            </h2>
            <p className="mt-3 max-w-md text-sm text-zinc-300">
              Scrap buying issues an SCR- ticket. Sorting creates one BAT- number per colour —
              that number stays through crushing, washing and drying.
            </p>
          </div>
          <div className="space-y-3 bg-zinc-50 p-6">
            <FlowStep n="01" label="Buy raw or crushed scrap" />
            <FlowStep n="02" label="Sort → one BAT- per colour" />
            <FlowStep n="03" label="Crush → Wash → Dry on that BAT-" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          if (action.permission && !hasPermission(user, action.permission)) return null
          const Icon = action.icon
          return (
            <Link
              key={action.to}
              to={action.to}
              className="dgn-card group flex min-h-40 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-amber-300"
            >
              <div
                className={`flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-white shadow-lg`}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">{action.title}</h3>
                  <ArrowRight className="size-4 text-[var(--ink-faint)] transition group-hover:text-[var(--accent-strong)]" />
                </div>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{action.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function FlowStep({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-[var(--line)]">
      <span className="text-xs font-bold text-[var(--accent-strong)]">{n}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
