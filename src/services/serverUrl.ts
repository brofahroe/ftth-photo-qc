const SERVER_URL_KEY = 'ftth_qc_server_url';

export function getApiBaseUrl(): string {
  // 1. Check custom user override in localStorage
  const saved = localStorage.getItem(SERVER_URL_KEY)?.trim();
  if (saved) return saved.replace(/\/+$/, '');

  // 2. Check Vite Environment Variable (configured in Vercel Dashboard)
  const envUrl = (import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL)?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // 3. In dev mode on port 5173, point to backend on port 3001
  if (window.location.port === '5173') {
    return `http://${window.location.hostname}:3001`;
  }

  // 4. Default: same origin as frontend
  return '';
}

export function getSocketBaseUrl(): string {
  return getApiBaseUrl() || window.location.origin;
}

export function setCustomServerUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem(SERVER_URL_KEY, clean);
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}
