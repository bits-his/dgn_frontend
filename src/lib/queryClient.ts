import { QueryClient } from '@tanstack/react-query'

/** Shared defaults: reuse warm cache on navigation; live floor pages can override with shorter staleTime / polling. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
})
