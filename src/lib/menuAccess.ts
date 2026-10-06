/** Single source of truth for sidebar pages, staff access checkboxes, and role defaults. */

export type MenuAccessItem = {
  key: string
  label: string
  group: string
}

export type MenuPage = MenuAccessItem & {
  to: string
  permission: string
  end?: boolean
  nav: 'processing' | 'processingMore' | 'production' | 'operations' | 'finance' | 'intelligence'
}

export const MENU_PAGES: MenuPage[] = [
  { group: 'Operations', key: 'receiving', label: 'Scrap buying', to: '/receiving', permission: 'receiving.create', nav: 'processing' },
  { group: 'Operations', key: 'crushing', label: 'Crushing', to: '/process/crushing', permission: 'batch.create', nav: 'processing' },
  { group: 'Operations', key: 'washing', label: 'Washing', to: '/process/washing', permission: 'batch.create', nav: 'processing' },
  { group: 'Operations', key: 'second_grade', label: 'Second grade', to: '/process/second-grade', permission: 'batch.view', nav: 'processing' },
  { group: 'Operations', key: 'drying', label: 'Drying', to: '/process/drying', permission: 'batch.create', nav: 'processingMore' },
  { group: 'Operations', key: 'recrushing', label: 'Re-crushing', to: '/process/recrushing', permission: 'batch.create', nav: 'processingMore' },
  { group: 'Operations', key: 'recycling', label: 'Recycling', to: '/process/recycling', permission: 'batch.create', nav: 'processingMore' },
  { group: 'Operations', key: 'production_store', label: 'Material store', to: '/production/store', permission: 'batch.view', nav: 'production' },
  { group: 'Operations', key: 'production', label: 'Production', to: '/production', permission: 'batch.view', end: true, nav: 'production' },
  { group: 'Operations', key: 'damaged', label: 'Damaged', to: '/production/damaged', permission: 'batch.view', nav: 'production' },
  { group: 'Operations', key: 'qc', label: 'Quality control', to: '/qc', permission: 'batch.view', nav: 'operations' },
  { group: 'Operations', key: 'inventory', label: 'Inventory', to: '/inventory', permission: 'inventory.view', nav: 'operations' },
  { group: 'Operations', key: 'security', label: 'Security Post', to: '/security', permission: 'batch.view', nav: 'operations' },
  { group: 'Operations', key: 'sales', label: 'Sales & dispatch', to: '/sales', permission: 'sales.view', end: true, nav: 'operations' },
  { group: 'Operations', key: 'pricing', label: 'Product pricing', to: '/pricing', permission: 'sales.create', nav: 'operations' },
  { group: 'Operations', key: 'distributors', label: 'Distributors', to: '/distributors', permission: 'sales.view', nav: 'operations' },
  { group: 'Operations', key: 'batches', label: 'Batches', to: '/batches', permission: 'batch.view', nav: 'operations' },
  { group: 'Operations', key: 'masters', label: 'Masters', to: '/masters', permission: 'masters.manage', nav: 'operations' },
  { group: 'Money & people', key: 'processing_money', label: 'Wallet', to: '/wallet', permission: 'float.spend', nav: 'finance' },
  { group: 'Money & people', key: 'expenses', label: 'Expenses', to: '/expenses', permission: 'expense.view', nav: 'finance' },
  { group: 'Money & people', key: 'staff', label: 'Staff', to: '/staff', permission: 'labour.view', nav: 'finance' },
  { group: 'Money & people', key: 'operators', label: 'Operators', to: '/operators', permission: 'labour.view', nav: 'finance' },
  { group: 'Money & people', key: 'payroll', label: 'Payroll', to: '/payroll', permission: 'labour.view', nav: 'finance' },
  { group: 'Intelligence', key: 'dashboard', label: 'Command centre', to: '/dashboard', permission: 'dashboard.executive', nav: 'intelligence' },
  { group: 'Intelligence', key: 'machines', label: 'Machines & maintenance', to: '/machines', permission: 'batch.view', nav: 'intelligence' },
  { group: 'Intelligence', key: 'sales_margins', label: 'Sales margin', to: '/sales/margins', permission: 'sales.view', nav: 'intelligence' },
  { group: 'Intelligence', key: 'costs', label: 'Cost intelligence', to: '/costs', permission: 'costs.view', end: true, nav: 'intelligence' },
  { group: 'Intelligence', key: 'overhead', label: 'Factory overhead', to: '/costs/overhead', permission: 'costs.view', nav: 'intelligence' },
  { group: 'Intelligence', key: 'alerts', label: 'Alerts', to: '/alerts', permission: 'alert.view', nav: 'intelligence' },
]

export const SIDEBAR_MENU_ACCESS: MenuAccessItem[] = MENU_PAGES.map(({ key, label, group }) => ({
  key,
  label,
  group,
}))

export const DEPARTMENT_OPTIONS = [
  'Production',
  'Recycling',
  'Sales',
  'Quality Control',
  'Inventory & Store',
  'Security',
  'Maintenance',
  'Finance & Accounts',
  'Administration',
] as const

export const ROLE_OPTIONS = [
  { code: 'WORKER', label: 'Worker' },
  { code: 'OPERATOR', label: 'Operator' },
  { code: 'STAFF', label: 'Staff' },
  { code: 'PROD_SUPERVISOR', label: 'Supervisor' },
  { code: 'QC_OFFICER', label: 'QC Officer' },
  { code: 'INVENTORY_OFFICER', label: 'Inventory Officer' },
  { code: 'SALES_OFFICER', label: 'Sales Officer' },
  { code: 'OUTLET_SELLER', label: 'Shop / distributor seller' },
  { code: 'STOREKEEPER', label: 'Storekeeper' },
  { code: 'FINANCE_OFFICER', label: 'Finance Officer' },
  { code: 'FACTORY_MANAGER', label: 'Manager' },
  { code: 'ADMIN', label: 'Administrator' },
] as const

const ALL_KEYS = SIDEBAR_MENU_ACCESS.map((i) => i.key)

export const ROLE_DEFAULT_MENU_ACCESS: Record<string, string[]> = {
  WORKER: ['crushing', 'washing', 'second_grade', 'drying', 'recrushing', 'recycling', 'processing_money'],
  OPERATOR: [
    'receiving',
    'crushing',
    'washing',
    'second_grade',
    'drying',
    'recrushing',
    'recycling',
    'production',
    'production_store',
    'damaged',
    'processing_money',
  ],
  STAFF: [
    'receiving',
    'crushing',
    'washing',
    'second_grade',
    'drying',
    'recrushing',
    'recycling',
    'production',
    'production_store',
    'damaged',
    'inventory',
    'batches',
    'processing_money',
  ],
  PROD_SUPERVISOR: [
    'receiving',
    'crushing',
    'washing',
    'second_grade',
    'drying',
    'recrushing',
    'recycling',
    'production',
    'production_store',
    'damaged',
    'qc',
    'inventory',
    'batches',
    'machines',
    'alerts',
    'processing_money',
  ],
  QC_OFFICER: ['qc', 'batches', 'production', 'production_store', 'inventory', 'alerts'],
  INVENTORY_OFFICER: ['inventory', 'receiving', 'batches', 'production', 'production_store', 'alerts'],
  STOREKEEPER: [
    'inventory',
    'receiving',
    'production',
    'production_store',
    'damaged',
    'batches',
    'processing_money',
    'security',
  ],
  SALES_OFFICER: ['sales', 'pricing', 'distributors', 'inventory', 'production_store', 'sales_margins', 'alerts'],
  OUTLET_SELLER: ['distributors'],
  FINANCE_OFFICER: [
    'expenses',
    'processing_money',
    'payroll',
    'staff',
    'operators',
    'costs',
    'overhead',
    'sales',
    'pricing',
    'distributors',
    'sales_margins',
    'alerts',
  ],
  FACTORY_MANAGER: ALL_KEYS,
  ADMIN: ALL_KEYS,
}

/** Older grants still unlock the matching new page. */
export const MENU_KEY_ALIASES: Record<string, string[]> = {
  second_grade: ['washing'],
  damaged: ['production'],
  operators: ['staff'],
  recrushing: ['crushing'],
  distributors: ['sales'],
  processing_money: [],
}

export function userHasMenuKey(keys: string[] | undefined, menuKey: string | undefined) {
  if (!menuKey) return false
  if (!keys?.length) return false
  if (keys.includes(menuKey)) return true
  return (MENU_KEY_ALIASES[menuKey] || []).some((alias) => keys.includes(alias))
}
