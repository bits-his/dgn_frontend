import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const OPERATORS_QUERY_KEY = ['masters-employees', 'operators'] as const

export type OperatorOption = {
  id: number
  firstname?: string
  lastname?: string
  employeeCode?: string
  designation?: string | null
}

export function useOperators(enabled = true) {
  return useQuery({
    queryKey: OPERATORS_QUERY_KEY,
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/masters/employees', {
        params: { kind: 'operators' },
        signal,
      })
      return (data.data || []) as OperatorOption[]
    },
  })
}
