import { APP_CONFIG } from './config';

export interface DeviceRegistration {
  token: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  notificationsEnabled: boolean;
}

export function joinBackendUrl(baseUrl: string, path = APP_CONFIG.backendPath): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export async function registerDevice(
  baseUrl: string,
  bearerToken: string,
  registration: DeviceRegistration,
  timeoutMs = APP_CONFIG.requestTimeoutMs,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (bearerToken.trim()) headers.Authorization = `Bearer ${bearerToken.trim()}`;
    const response = await fetch(joinBackendUrl(baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(registration),
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Keep the plain response body when it is not JSON.
    }
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    return { status: response.status, body };
  } finally {
    window.clearTimeout(timeout);
  }
}
