import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { queryClient } from './lib/queryClient'
import { PreviewProvider } from './lib/preview'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreviewProvider>
        <App />
      </PreviewProvider>
    </QueryClientProvider>
  </StrictMode>,
)
