import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { queryClient } from './lib/queryClient'
import { PreviewProvider } from './lib/preview'
import { WishlistProvider } from './lib/wishlist'
import { CollectionProvider } from './lib/collection'

// Provider stack order (locked — see design §12):
//   QueryClientProvider > WishlistProvider > CollectionProvider > PreviewProvider > App
// CollectionProvider is inside QueryClientProvider so Scryfall fetches triggered by
// collection mutations can use TanStack Query keys. WishlistProvider is outermost
// to preserve its existing position (no inter-dependency with CollectionProvider).

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WishlistProvider>
        <CollectionProvider>
          <PreviewProvider>
            <App />
          </PreviewProvider>
        </CollectionProvider>
      </WishlistProvider>
    </QueryClientProvider>
  </StrictMode>,
)
