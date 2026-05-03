import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { queryClient } from './lib/queryClient'
import { PreviewProvider } from './lib/preview'
import { WishlistProvider } from './lib/wishlist'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WishlistProvider>
        <PreviewProvider>
          <App />
        </PreviewProvider>
      </WishlistProvider>
    </QueryClientProvider>
  </StrictMode>,
)
