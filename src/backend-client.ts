import { APP_CONFIG } from './config';
import type { AppLogger } from './logger';

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
  log?: AppLogger,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException(`Request timed out after ${timeoutMs} ms`, 'TimeoutError')),
    timeoutMs,
  );
  const url = joinBackendUrl(baseUrl);
  const t0 = performance.now();
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (bearerToken.trim()) headers.Authorization = `Bearer ${bearerToken.trim()}`;

    log?.debug('HTTP request starting', {
      method: 'POST',
      url,
      headers: { ...headers, Authorization: headers.Authorization ? '<redacted>' : undefined },
      body: registration,
      timeoutMs,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(registration),
      signal: controller.signal,
    });
    const elapsedMs = Math.round(performance.now() - t0);
    log?.debug('HTTP response received', {
      url,
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    });

    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Keep the plain response body when it is not JSON.
    }
    log?.debug('HTTP response body', body);
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    return { status: response.status, body };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - t0);
    log?.debug('HTTP request failed', {
      url,
      elapsedMs,
      aborted: controller.signal.aborted,
      abortReason: controller.signal.reason instanceof Error ? controller.signal.reason.message : controller.signal.reason,
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
