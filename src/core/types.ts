import type { TimestampLike } from '../time/timestampLike.js';

export interface PersistedBase {
  schemaVersion: number;
}

export type Migration<From extends PersistedBase, To extends PersistedBase> = (
  persisted: From,
) => To;

/**
 * Converts a Date to the SDK-specific timestamp type at the persistence boundary.
 * Pass `Timestamp.fromDate` (Web SDK) or `admin.firestore.Timestamp.fromDate`
 * (Admin SDK). The result conforms to TimestampLike so persisted shapes can
 * type their timestamp fields as `TimestampLike`.
 */
export type ToTimestamp = (date: Date) => TimestampLike;

export interface ModelSpec<Domain, PersistedLatest extends PersistedBase> {
  currentVersion: number;
  /**
   * Convert a domain object to its persisted representation.
   *
   * @param domain - The in-memory domain object.
   * @param toTimestamp - Optional factory for converting Date values to the
   *   SDK-specific Timestamp type. Pass this when the persisted shape contains
   *   TimestampLike fields. If omitted, Date fields must be handled by the caller.
   */
  toPersisted: (domain: Domain, toTimestamp?: ToTimestamp) => PersistedLatest;
  toPartialPersisted?: (
    patch: Partial<Domain>,
    toTimestamp?: ToTimestamp,
  ) => Partial<PersistedLatest>;
  fromPersisted: (persisted: PersistedLatest) => Domain;
  migrations?: Record<number, Migration<any, any>>;
  validatePersisted?: (value: unknown) => void;
}
