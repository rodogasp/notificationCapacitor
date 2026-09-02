export type LogWriter = (line: string) => void;
export type AppLogger = ReturnType<typeof createLogger>;

export function errorToString(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Every log line is also mirrored to the WebView console, which Capacitor
 * forwards to `adb logcat` (tag "Capacitor/Console"). This lets device-side
 * logs be inspected from the PC without needing to look at the phone screen.
 */
export function createLogger(write: LogWriter) {
  const emit = (level: 'debug' | 'info' | 'warn' | 'error', message: string, value?: unknown) => {
    const line = formatLine(message, value);
    write(line);
    // eslint-disable-next-line no-console
    console[level](`[fcm-test] ${line}`);
  };

  return {
    debug(message: string, value?: unknown) {
      emit('debug', message, value);
    },
    info(message: string, value?: unknown) {
      emit('info', message, value);
    },
    warn(message: string, value?: unknown) {
      emit('warn', message, value);
    },
    error(message: string, error?: unknown) {
      emit('error', message, error === undefined ? undefined : errorToString(error));
    },
  };
}

export function formatLine(message: string, value?: unknown): string {
  const timestamp = new Date().toISOString();
  if (value === undefined) return `[${timestamp}] ${message}`;
  const formatted = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return `[${timestamp}] ${message} ${formatted}`;
}
