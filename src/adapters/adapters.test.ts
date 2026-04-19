import { describe, it, expect, vi } from 'vitest';
import {
  createDocumentDomain as clientCreateDocumentDomain,
  toTypedSnapshot as clientToTypedSnapshot,
  toTypedQuerySnapshot as clientToTypedQuerySnapshot,
  readDocumentDomain as clientReadDocumentDomain,
  setDocumentDomain as clientSetDocumentDomain,
  updateDocumentDomain as clientUpdateDocumentDomain,
  updateDocumentPersisted as clientUpdateDocumentPersisted,
  type BrowserDocumentSnapshot,
  type BrowserDocumentWriter,
  type BrowserQuerySnapshot,
} from './firebase-client/index.js';
import {
  createDocumentDomain as adminCreateDocumentDomain,
  toTypedSnapshot as adminToTypedSnapshot,
  toTypedQuerySnapshot as adminToTypedQuerySnapshot,
  readDocumentDomain as adminReadDocumentDomain,
  setDocumentDomain as adminSetDocumentDomain,
  updateDocumentDomain as adminUpdateDocumentDomain,
  updateDocumentPersisted as adminUpdateDocumentPersisted,
  type AdminDocumentSnapshot,
  type AdminDocumentWriter,
  type AdminQuerySnapshot,
} from './firebase-admin/index.js';
import { defineModel } from '../core/defineModel.js';
import type { TimestampLike } from '../time/timestampLike.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBrowserSnap(
  id: string,
  exists: boolean,
  docData?: Record<string, unknown>,
): BrowserDocumentSnapshot<Record<string, unknown>> {
  return { id, exists: () => exists, data: () => docData };
}

function makeAdminSnap(
  id: string,
  exists: boolean,
  docData?: Record<string, unknown>,
): AdminDocumentSnapshot<Record<string, unknown>> {
  return { id, exists, data: () => docData };
}

function makeBrowserWriter(): BrowserDocumentWriter<{
  schemaVersion: 1;
  name: string;
  updatedAt?: TimestampLike;
}> {
  return {
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAdminWriter(): AdminDocumentWriter<{
  schemaVersion: 1;
  name: string;
  updatedAt?: TimestampLike;
}> {
  return {
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

const simpleSpec = defineModel({
  currentVersion: 1,
  toPersisted: (d: { name: string }) => ({ schemaVersion: 1 as const, name: d.name }),
  fromPersisted: (p) => ({ name: p.name }),
  migrations: {
    0: (doc: { schemaVersion: number; oldName: string }) => ({
      schemaVersion: 1 as const,
      name: doc.oldName,
    }),
  },
});

const partialSpec = defineModel<
  { name: string; updatedAt?: Date },
  { schemaVersion: 1; name: string; updatedAt?: TimestampLike }
>({
  currentVersion: 1,
  toPersisted: (d, toTimestamp) => ({
    schemaVersion: 1 as const,
    name: d.name,
    updatedAt: d.updatedAt ? toTimestamp?.(d.updatedAt) : undefined,
  }),
  toPartialPersisted: (patch, toTimestamp) => ({
    name: patch.name,
    updatedAt: patch.updatedAt ? toTimestamp?.(patch.updatedAt) : undefined,
  }),
  fromPersisted: (p) => ({ name: p.name }),
});

// ---------------------------------------------------------------------------
// firebase-client adapter
// ---------------------------------------------------------------------------

describe('firebase-client: toTypedSnapshot', () => {
  it('sets exists to true when exists() returns true', () => {
    const snap = makeBrowserSnap('doc1', true, { schemaVersion: 1, name: 'Alice' });
    expect(clientToTypedSnapshot(snap).exists).toBe(true);
  });

  it('sets exists to false when exists() returns false', () => {
    const snap = makeBrowserSnap('doc2', false);
    expect(clientToTypedSnapshot(snap).exists).toBe(false);
  });

  it('preserves the document id', () => {
    const snap = makeBrowserSnap('my-id', true, { schemaVersion: 1, name: 'x' });
    expect(clientToTypedSnapshot(snap).id).toBe('my-id');
  });

  it('data() passes through the underlying data', () => {
    const data = { schemaVersion: 1 as const, name: 'Bob' };
    const snap = makeBrowserSnap('doc3', true, data);
    expect(clientToTypedSnapshot(snap).data()).toEqual(data);
  });

  it('data() returns undefined for non-existent doc', () => {
    const snap = makeBrowserSnap('doc4', false, undefined);
    expect(clientToTypedSnapshot(snap).data()).toBeUndefined();
  });
});

describe('firebase-client: toTypedQuerySnapshot', () => {
  it('wraps each doc in the docs array', () => {
    const querySnap: BrowserQuerySnapshot<Record<string, unknown>> = {
      docs: [
        makeBrowserSnap('a', true, { schemaVersion: 1, name: 'A' }),
        makeBrowserSnap('b', true, { schemaVersion: 1, name: 'B' }),
      ],
      empty: false,
      size: 2,
    };
    const result = clientToTypedQuerySnapshot(querySnap);
    expect(result.docs).toHaveLength(2);
    expect(result.docs[0].id).toBe('a');
    expect(result.docs[1].id).toBe('b');
  });

  it('preserves empty and size', () => {
    const querySnap: BrowserQuerySnapshot<never> = { docs: [], empty: true, size: 0 };
    const result = clientToTypedQuerySnapshot(querySnap);
    expect(result.empty).toBe(true);
    expect(result.size).toBe(0);
  });
});

describe('firebase-client: readDocumentDomain', () => {
  it('returns the hydrated domain object', () => {
    const snap = makeBrowserSnap('doc1', true, { schemaVersion: 1, name: 'Ada' });
    const result = clientReadDocumentDomain(snap, simpleSpec);
    expect(result).toEqual({ name: 'Ada' });
  });

  it('runs migration before hydrating', () => {
    const snap = makeBrowserSnap('doc1', true, { schemaVersion: 0, oldName: 'Ada' });
    const result = clientReadDocumentDomain(snap, simpleSpec);
    expect(result).toEqual({ name: 'Ada' });
  });

  it('throws when the document does not exist', () => {
    const snap = makeBrowserSnap('doc2', false);
    expect(() => clientReadDocumentDomain(snap, simpleSpec)).toThrow(
      'Document "doc2" does not exist.',
    );
  });

  it('throws when exists() is true but data() returns undefined', () => {
    const snap: BrowserDocumentSnapshot<Record<string, unknown>> = {
      id: 'doc3',
      exists: () => true,
      data: () => undefined,
    };
    expect(() => clientReadDocumentDomain(snap, simpleSpec)).toThrow(
      'Document "doc3" returned no data.',
    );
  });
});

describe('firebase-client: write helpers', () => {
  it('setDocumentDomain converts through toPersisted', async () => {
    const ref = makeBrowserWriter();

    await clientSetDocumentDomain(
      ref,
      { name: 'Ada', updatedAt: new Date('2026-04-19T00:00:00.000Z') },
      partialSpec,
      {
        toTimestamp: (date) => ({
          seconds: Math.floor(date.getTime() / 1000),
          nanoseconds: 0,
        }),
      },
    );

    expect(ref.set).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: 'Ada',
      updatedAt: {
        seconds: 1776556800,
        nanoseconds: 0,
      },
    });
  });

  it('createDocumentDomain performs a full write without merge options', async () => {
    const ref = makeBrowserWriter();

    await clientCreateDocumentDomain(ref, { name: 'Ada' }, partialSpec);

    expect(ref.set).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: 'Ada',
      updatedAt: undefined,
    });
  });

  it('updateDocumentDomain converts through toPartialPersisted', async () => {
    const ref = makeBrowserWriter();

    await clientUpdateDocumentDomain(
      ref,
      { updatedAt: new Date('2026-04-20T00:00:00.000Z') },
      partialSpec,
      {
        toTimestamp: (date) => ({
          seconds: Math.floor(date.getTime() / 1000),
          nanoseconds: 0,
        }),
      },
    );

    expect(ref.update).toHaveBeenCalledWith({
      updatedAt: {
        seconds: 1776643200,
        nanoseconds: 0,
      },
    });
  });

  it('updateDocumentDomain throws when toPartialPersisted is missing', async () => {
    const ref = makeBrowserWriter();

    await expect(clientUpdateDocumentDomain(ref, { name: 'Grace' }, simpleSpec)).rejects.toThrow(
      'Model is missing toPartialPersisted. Provide toPartialPersisted or use updateDocumentPersisted.',
    );
  });

  it('updateDocumentPersisted bypasses model conversion', async () => {
    const ref = makeBrowserWriter();

    await clientUpdateDocumentPersisted(ref, {
      updatedAt: { seconds: 1, nanoseconds: 0 },
    });

    expect(ref.update).toHaveBeenCalledWith({
      updatedAt: { seconds: 1, nanoseconds: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// firebase-admin adapter
// ---------------------------------------------------------------------------

describe('firebase-admin: toTypedSnapshot', () => {
  it('sets exists to true when the property is true', () => {
    const snap = makeAdminSnap('doc1', true, { schemaVersion: 1, name: 'Alice' });
    expect(adminToTypedSnapshot(snap).exists).toBe(true);
  });

  it('sets exists to false when the property is false', () => {
    const snap = makeAdminSnap('doc2', false);
    expect(adminToTypedSnapshot(snap).exists).toBe(false);
  });

  it('preserves the document id', () => {
    const snap = makeAdminSnap('admin-id', true, { schemaVersion: 1, name: 'x' });
    expect(adminToTypedSnapshot(snap).id).toBe('admin-id');
  });

  it('data() passes through the underlying data', () => {
    const data = { schemaVersion: 1 as const, name: 'Carol' };
    const snap = makeAdminSnap('doc3', true, data);
    expect(adminToTypedSnapshot(snap).data()).toEqual(data);
  });

  it('data() returns undefined for non-existent doc', () => {
    const snap = makeAdminSnap('doc4', false, undefined);
    expect(adminToTypedSnapshot(snap).data()).toBeUndefined();
  });
});

describe('firebase-admin: toTypedQuerySnapshot', () => {
  it('wraps each doc in the docs array', () => {
    const querySnap: AdminQuerySnapshot<Record<string, unknown>> = {
      docs: [
        makeAdminSnap('a', true, { schemaVersion: 1, name: 'A' }),
        makeAdminSnap('b', true, { schemaVersion: 1, name: 'B' }),
      ],
      empty: false,
      size: 2,
    };
    const result = adminToTypedQuerySnapshot(querySnap);
    expect(result.docs).toHaveLength(2);
    expect(result.docs[0].id).toBe('a');
    expect(result.docs[1].id).toBe('b');
  });

  it('preserves empty and size', () => {
    const querySnap: AdminQuerySnapshot<never> = { docs: [], empty: true, size: 0 };
    const result = adminToTypedQuerySnapshot(querySnap);
    expect(result.empty).toBe(true);
    expect(result.size).toBe(0);
  });
});

describe('firebase-admin: readDocumentDomain', () => {
  it('returns the hydrated domain object', () => {
    const snap = makeAdminSnap('doc1', true, { schemaVersion: 1, name: 'Ada' });
    const result = adminReadDocumentDomain(snap, simpleSpec);
    expect(result).toEqual({ name: 'Ada' });
  });

  it('runs migration before hydrating', () => {
    const snap = makeAdminSnap('doc1', true, { schemaVersion: 0, oldName: 'Ada' });
    const result = adminReadDocumentDomain(snap, simpleSpec);
    expect(result).toEqual({ name: 'Ada' });
  });

  it('throws when the document does not exist', () => {
    const snap = makeAdminSnap('doc2', false);
    expect(() => adminReadDocumentDomain(snap, simpleSpec)).toThrow(
      'Document "doc2" does not exist.',
    );
  });

  it('throws when exists is true but data() returns undefined', () => {
    const snap: AdminDocumentSnapshot<Record<string, unknown>> = {
      id: 'doc3',
      exists: true,
      data: () => undefined,
    };
    expect(() => adminReadDocumentDomain(snap, simpleSpec)).toThrow(
      'Document "doc3" returned no data.',
    );
  });
});

describe('firebase-admin: write helpers', () => {
  it('setDocumentDomain converts through toPersisted', async () => {
    const ref = makeAdminWriter();

    await adminSetDocumentDomain(
      ref,
      { name: 'Ada', updatedAt: new Date('2026-04-19T00:00:00.000Z') },
      partialSpec,
      {
        toTimestamp: (date) => ({
          seconds: Math.floor(date.getTime() / 1000),
          nanoseconds: 0,
        }),
      },
    );

    expect(ref.set).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: 'Ada',
      updatedAt: {
        seconds: 1776556800,
        nanoseconds: 0,
      },
    });
  });

  it('createDocumentDomain performs a full write without merge options', async () => {
    const ref = makeAdminWriter();

    await adminCreateDocumentDomain(ref, { name: 'Ada' }, partialSpec);

    expect(ref.set).toHaveBeenCalledWith({
      schemaVersion: 1,
      name: 'Ada',
      updatedAt: undefined,
    });
  });

  it('updateDocumentDomain converts through toPartialPersisted', async () => {
    const ref = makeAdminWriter();

    await adminUpdateDocumentDomain(
      ref,
      { updatedAt: new Date('2026-04-20T00:00:00.000Z') },
      partialSpec,
      {
        toTimestamp: (date) => ({
          seconds: Math.floor(date.getTime() / 1000),
          nanoseconds: 0,
        }),
      },
    );

    expect(ref.update).toHaveBeenCalledWith({
      updatedAt: {
        seconds: 1776643200,
        nanoseconds: 0,
      },
    });
  });

  it('updateDocumentDomain throws when toPartialPersisted is missing', async () => {
    const ref = makeAdminWriter();

    await expect(adminUpdateDocumentDomain(ref, { name: 'Grace' }, simpleSpec)).rejects.toThrow(
      'Model is missing toPartialPersisted. Provide toPartialPersisted or use updateDocumentPersisted.',
    );
  });

  it('updateDocumentPersisted bypasses model conversion', async () => {
    const ref = makeAdminWriter();

    await adminUpdateDocumentPersisted(ref, {
      updatedAt: { seconds: 1, nanoseconds: 0 },
    });

    expect(ref.update).toHaveBeenCalledWith({
      updatedAt: { seconds: 1, nanoseconds: 0 },
    });
  });
});
