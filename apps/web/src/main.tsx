import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@re-shell/ui';
import App from './App';
import { BrandProvider } from './brand/BrandProvider';
import { SettingsProvider } from './settings/useSettings';
import { ThemePackProvider } from './theme/useThemePacks';
// Fonts are a separate stylesheet (real, hashed woff2 files fetched on demand), not inlined CSS.
import '@re-shell/ui/fonts.css';
import '@re-shell/ui/styles.css';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Hub reads are inexpensive but not instantaneous; keep them fresh for a
      // short window and don't refetch on window focus inside a local dashboard.
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" was not found in the document.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrandProvider>
        <SettingsProvider>
          <ThemePackProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ThemePackProvider>
        </SettingsProvider>
      </BrandProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
