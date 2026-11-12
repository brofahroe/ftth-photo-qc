export function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  return window.location.port === '5173'
    ? `http://${window.location.hostname}:3001`
    : '';
}

export function getSocketBaseUrl(): string {
  return getApiBaseUrl() || window.location.origin;
}
