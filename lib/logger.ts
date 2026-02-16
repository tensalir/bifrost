/**
 * Structured logging for Heimdall. Writes to KV (capped at 500) and console.
 */

import { appendLog, type LogEntry, type LogLevel, type LogCategory } from './kv.js'

function genId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function serializeError(err: unknown): LogEntry['error'] {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      code: (err as { code?: string }).code,
    }
  }
  return { message: String(err) }
}

async function write(entry: LogEntry): Promise<void> {
  const withId = { ...entry, id: entry.id || genId(), timestamp: entry.timestamp || new Date().toISOString() }
  const level = withId.level
  const prefix = `[${withId.category}] ${withId.message}`
  if (level === 'error') {
    console.error(prefix, withId.error ?? withId.context ?? '')
  } else if (level === 'warn') {
    console.warn(prefix, withId.context ?? '')
  } else {
    console.log(prefix, withId.context ?? '')
  }
  try {
    await appendLog(withId)
  } catch (e) {
    console.error('[logger] Failed to persist log:', e)
  }
}

export const logger = {
  debug(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    write({
      id: genId(),
      timestamp: new Date().toISOString(),
      level: 'debug',
      category,
      message,
      context,
    }).catch(() => {})
  },

  info(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    write({
      id: genId(),
      timestamp: new Date().toISOString(),
      level: 'info',
      category,
      message,
      context,
    }).catch(() => {})
  },

  warn(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    write({
      id: genId(),
      timestamp: new Date().toISOString(),
      level: 'warn',
      category,
      message,
      context,
    }).catch(() => {})
  },

  error(
    category: LogCategory,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ): void {
    write({
      id: genId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      category,
      message,
      error: error != null ? serializeError(error) : undefined,
      context,
    }).catch(() => {})
  },

  time(category: LogCategory, message: string): { done: (context?: Record<string, unknown>) => void } {
    const start = Date.now()
    return {
      done(context?: Record<string, unknown>) {
        const duration = Date.now() - start
        write({
          id: genId(),
          timestamp: new Date().toISOString(),
          level: 'info',
          category,
          message,
          duration,
          context,
        }).catch(() => {})
      },
    }
  },
}
