export type LogWriter = (line: string) => void;

export function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function createLogger(write: LogWriter) {
  return {
    info(message: string, value?: unknown) {
      write(formatLine(message, value));
    },
    error(message: string, error?: unknown) {
      write(formatLine(message, error === undefined ? undefined : errorToString(error)));
    },
  };
}

export function formatLine(message: string, value?: unknown): string {
  const timestamp = new Date().toISOString();
  if (value === undefined) return `[${timestamp}] ${message}`;
  const formatted = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return `[${timestamp}] ${message} ${formatted}`;
}
