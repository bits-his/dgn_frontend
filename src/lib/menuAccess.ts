/** Sidebar pages staff can be granted — mirrors AppShell nav. */
export type MenuAccessItem = {
  key: string
  label: string
  group: string
}

export const SIDEBAR_MENU_ACCESS: MenuAccessItem[] = [
  { group: 'Operations', key: 'receiving', label: 'Scrap buying' },
  { group: 'Operations', key: 'sorting', label: 'Sorting' },
  { group: 'Operations', key: 'crushing', label: 'Crushing' },
  { group: 'Operations', key: 'washing', label: 'Washing' },
  { group: 'Operations', key: 'drying', label: 'Drying' },
  { group: 'Operations', key: 'suppliers', label: 'Suppliers' },
  { group: 'Operations', key: 'production', label: 'Production' },
  { group: 'Operations', key: 'qc', label: 'Quality control' },
  { group: 'Operations', key: 'inventory', label: 'Inventory' },
  { group: 'Operations', key: 'sales', label: 'Sales & dispatch' },
  { group: 'Operations', key: 'batches', label: 'Batches' },
  { group: 'Operations', key: 'masters', label: 'Masters' },
  { group: 'Money & people', key: 'expenses', label: 'Expenses' },
  { group: 'Money & people', key: 'staff', label: 'Staff' },
  { group: 'Money & people', key: 'payroll', label: 'Payroll' },
  { group: 'Intelligence', key: 'machines', label: 'Machines & OEE' },
  { group: 'Intelligence', key: 'sales_margins', label: 'Sales margin' },
  { group: 'Intelligence', key: 'costs', label: 'Cost intelligence' },
  { group: 'Intelligence', key: 'overhead', label: 'Factory overhead' },
  { group: 'Intelligence', key: 'alerts', label: 'Alerts' },
  { group: 'Intelligence', key: 'dashboard', label: 'Executive dashboard' },
]
