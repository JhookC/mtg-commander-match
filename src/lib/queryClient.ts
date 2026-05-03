import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60_000,
      gcTime: 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
