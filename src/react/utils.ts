import type { DocumentData } from "../types.js";

export function normalizeErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

export function stripUndefinedFields<T extends DocumentData>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}
