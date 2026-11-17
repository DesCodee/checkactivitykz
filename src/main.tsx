import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeLanguageProvider } from './utils/i18n';

createRoot(document.getElementById('root')!).render(
  <ThemeLanguageProvider>
    <App />
  </ThemeLanguageProvider>
);
