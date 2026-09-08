import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Data is immediately considered stale so page navigation always gets fresh data
      gcTime: 5 * 60 * 1000, // Retain cache in memory for 5 minutes for instant back/forward transitions
      refetchOnMount: 'always', // Always fetch fresh data whenever a page or component mounts
      refetchOnWindowFocus: 'always', // Always fetch fresh data when switching back to tab/app on mobile or desktop
      refetchOnReconnect: 'always', // Always refetch when mobile reconnects to the network
      retry: 1,
    },
  },
})
