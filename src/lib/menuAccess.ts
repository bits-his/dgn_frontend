/** Sidebar pages staff can be granted — mirrors AppShell nav. */
export type MenuAccessItem = {
  key: string
  label: string
  group: string
}

export const SIDEBAR_MENU_ACCESS: MenuAccessItem[] = [
  // Operations
  { group: 'Operations', key: 'receiving', label: 'Scrap buying' },
  { group: 'Operations', key: 'crushing', label: 'Crushing' },
  { group: 'Operations', key: 'washing', label: 'Washing' },
  { group: 'Operations', key: 'drying', label: 'Drying' },
  { group: 'Operations', key: 'recrushing', label: 'Re-crushing' },
  { group: 'Operations', key: 'recycling', label: 'Recycling' },
  { group: 'Operations', key: 'production', label: 'Production runs' },
  { group: 'Operations', key: 'production_store', label: 'Production store' },
  { group: 'Operations', key: 'qc', label: 'Quality control' },
  { group: 'Operations', key: 'inventory', label: 'Inventory' },
  { group: 'Operations', key: 'sales', label: 'Sales & dispatch' },
  { group: 'Operations', key: 'distributors', label: 'Distributors & shops' },
  { group: 'Operations', key: 'batches', label: 'Batches' },
  { group: 'Operations', key: 'masters', label: 'Masters' },

  // Money & people
  { group: 'Money & people', key: 'processing_money', label: 'Wallet' },
  { group: 'Money & people', key: 'expenses', label: 'Expenses' },
  { group: 'Money & people', key: 'staff', label: 'Staff' },
  { group: 'Money & people', key: 'payroll', label: 'Payroll' },

  // Intelligence
  { group: 'Intelligence', key: 'dashboard', label: 'Command centre' },
  { group: 'Intelligence', key: 'machines', label: 'Machines & maintenance' },
  { group: 'Intelligence', key: 'sales_margins', label: 'Sales margin' },
  { group: 'Intelligence', key: 'costs', label: 'Cost intelligence' },
  { group: 'Intelligence', key: 'overhead', label: 'Factory overhead' },
  { group: 'Intelligence', key: 'alerts', label: 'Alerts' },
]

export const DEPARTMENT_OPTIONS = [
  'Production',
  'Recycling',
  'Sales',
  'Quality Control',
  'Inventory & Store',
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

export const ROLE_DEFAULT_MENU_ACCESS: Record<string, string[]> = {
  WORKER: ['crushing', 'washing', 'drying', 'recrushing', 'recycling', 'processing_money'],
  OPERATOR: ['receiving', 'crushing', 'washing', 'drying', 'recrushing', 'recycling', 'production', 'production_store', 'processing_money'],
  STAFF: [
    'receiving',
    'crushing',
    'washing',
    'drying',
    'recrushing',
    'recycling',
    'production',
    'production_store',
    'inventory',
    'batches',
    'processing_money',
  ],
  PROD_SUPERVISOR: [
    'receiving',
    'crushing',
    'washing',
    'drying',
    'recrushing',
    'recycling',
    'production',
    'production_store',
    'qc',
    'inventory',
    'batches',
    'machines',
    'alerts',
    'processing_money',
  ],
  QC_OFFICER: ['qc', 'batches', 'production', 'production_store', 'inventory', 'alerts'],
  INVENTORY_OFFICER: ['inventory', 'receiving', 'batches', 'production', 'production_store', 'alerts'],
  STOREKEEPER: ['inventory', 'receiving', 'production', 'production_store', 'batches', 'processing_money'],
  SALES_OFFICER: ['sales', 'distributors', 'inventory', 'production_store', 'sales_margins', 'alerts'],
  OUTLET_SELLER: ['distributors'],
  FINANCE_OFFICER: ['expenses', 'processing_money', 'payroll', 'costs', 'overhead', 'sales', 'distributors', 'sales_margins', 'alerts'],
  FACTORY_MANAGER: SIDEBAR_MENU_ACCESS.map((i) => i.key),
  ADMIN: SIDEBAR_MENU_ACCESS.map((i) => i.key),
}
