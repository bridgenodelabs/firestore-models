import { describe, it, expect, vi } from 'vitest';
import { assertSchemaVersion, migratePersisted, readDomain } from './migrate.js';
import { assertObject, assertNumber, createValidator } from './validate.js';
import { defineModel } from './defineModel.js';
import { createPersistedUpdate, createPersistedWrite } from './write.js';

// ---------------------------------------------------------------------------
// assertSchemaVersion
// ---------------------------------------------------------------------------

describe('assertSchemaVersion', () => {
  it('accepts schemaVersion 0', () => {
    expect(() => assertSchemaVersion({ schemaVersion: 0 })).not.toThrow();
  });

  it('accepts positive integer schemaVersions', () => {
    expect(() => assertSchemaVersion({ schemaVersion: 1 })).not.toThrow();
    expect(() => assertSchemaVersion({ schemaVersion: 99 })).not.toThrow();
  });

  it('throws for negative schemaVersion', () => {
    expect(() => assertSchemaVersion({ schemaVersion: -1 })).toThrow('Invalid schemaVersion');
  });

  it('throws for float schemaVersion', () => {
    expect(() => assertSchemaVersion({ schemaVersion: 1.5 })).toThrow('Invalid schemaVersion');
  });

  it('throws when schemaVersion key is missing', () => {
    expect(() => assertSchemaVersion({ x: 1 })).toThrow();
  });

  it('throws when schemaVersion is a string', () => {
    expect(() => assertSchemaVersion({ schemaVersion: '1' })).toThrow('Invalid schemaVersion');
  });

  it('throws for null input', () => {
    expect(() => assertSchemaVersion(null)).toThrow();
  });

  it('throws for non-object input', () => {
    expect(() => assertSchemaVersion(42)).toThrow();
    expect(() => assertSchemaVersion('hello')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// migratePersisted
// ---------------------------------------------------------------------------

describe('migratePersisted', () => {
  const spec = defineModel({
    currentVersion: 2,
    toPersisted: (d: { name: string }) => ({ schemaVersion: 2 as const, fullName: d.name }),
    fromPersisted: (p) => ({ name: p.fullName }),
    migrations: {
      0: (doc: { schemaVersion: number; name: string }) => ({
        schemaVersion: 1 as const,
        fullName: doc.name,
      }),
      1: (doc: { schemaVersion: number; fullName: string }) => ({
        schemaVersion: 2 as const,
        fullName: doc.fullName,
      }),
    },
  });

  it('runs all migrations from v0 to v2', () => {
    const v0 = { schemaVersion: 0, name: 'Ada' };
    const result = migratePersisted(v0, spec);
    expect(result).toEqual({ schemaVersion: 2, fullName: 'Ada' });
  });

  it('runs a single migration from v1 to v2', () => {
    const v1 = { schemaVersion: 1, fullName: 'Ada' };
    const result = migratePersisted(v1, spec);
    expect(result).toEqual({ schemaVersion: 2, fullName: 'Ada' });
  });

  it('is a no-op when already at currentVersion', () => {
    const input = { schemaVersion: 2, fullName: 'Ada' };
    const result = migratePersisted(input, spec);
    expect(result).toEqual(input);
  });

  it('throws when schemaVersion is newer than currentVersion', () => {
    const future = { schemaVersion: 3, fullName: 'Ada' };
    expect(() => migratePersisted(future, spec)).toThrow(/newer than supported/);
  });

  it('throws when a migration step is missing', () => {
    const incompleteSpec = defineModel({
      currentVersion: 2,
      toPersisted: (d: { name: string }) => ({ schemaVersion: 2 as const, name: d.name }),
      fromPersisted: (p) => ({ name: p.name }),
      migrations: {
        // 0 is missing — jump from 0 to 2 is impossible
        1: (doc: { schemaVersion: number; name: string }) => ({
          schemaVersion: 2 as const,
          name: doc.name,
        }),
      },
    });
    const v0 = { schemaVersion: 0, name: 'Ada' };
    expect(() => migratePersisted(v0, incompleteSpec)).toThrow(/Missing migration/);
  });

  it('throws if a migration produces an invalid schemaVersion', () => {
    const brokenSpec = defineModel({
      currentVersion: 1,
      toPersisted: (d: { x: number }) => ({ schemaVersion: 1 as const, x: d.x }),
      fromPersisted: (p) => ({ x: p.x }),
      migrations: {
        0: (_doc: { schemaVersion: number; x: number }) => ({
          schemaVersion: -1 as unknown as 1, // deliberately broken
          x: 0,
        }),
      },
    });
    const v0 = { schemaVersion: 0, x: 1 };
    expect(() => migratePersisted(v0, brokenSpec)).toThrow('Invalid schemaVersion');
  });
});

// ---------------------------------------------------------------------------
// defineModel
// ---------------------------------------------------------------------------

describe('defineModel', () => {
  it('returns the spec object unchanged', () => {
    const spec = {
      currentVersion: 1,
      toPersisted: (d: { x: number }) => ({ schemaVersion: 1 as const, x: d.x }),
      fromPersisted: (p: { schemaVersion: 1; x: number }) => ({ x: p.x }),
    };
    expect(defineModel(spec)).toBe(spec);
  });
});

// ---------------------------------------------------------------------------
// write helpers
// ---------------------------------------------------------------------------

describe('write helpers', () => {
  const spec = defineModel<
    { label: string; enabled: boolean },
    { schemaVersion: 1; label: string; enabled: boolean }
  >({
    currentVersion: 1,
    toPersisted: (domain: { label: string; enabled: boolean }) => ({
      schemaVersion: 1 as const,
      label: domain.label,
      enabled: domain.enabled,
    }),
    toPartialPersisted: (patch: Partial<{ label: string; enabled: boolean }>) => patch,
    fromPersisted: (persisted) => ({
      label: persisted.label,
      enabled: persisted.enabled,
    }),
  });

  it('createPersistedWrite returns the same full write object reference', () => {
    const persisted = { schemaVersion: 1 as const, label: 'Ada', enabled: true };

    expect(createPersistedWrite(spec, persisted)).toBe(persisted);
  });

  it('createPersistedUpdate returns the same patch object reference', () => {
    const patch = { enabled: false };

    expect(createPersistedUpdate(spec, patch)).toBe(patch);
  });

  it('accepts partial persisted updates', () => {
    const patch = createPersistedUpdate(spec, { label: 'Grace' });

    expect(patch).toEqual({ label: 'Grace' });
  });
});

// ---------------------------------------------------------------------------
// readDomain
// ---------------------------------------------------------------------------

describe('readDomain', () => {
  const spec = defineModel({
    currentVersion: 1,
    toPersisted: (d: { label: string }) => ({ schemaVersion: 1 as const, label: d.label }),
    fromPersisted: (p) => ({ label: p.label }),
    migrations: {
      0: (doc: { schemaVersion: number; name: string }) => ({
        schemaVersion: 1 as const,
        label: doc.name,
      }),
    },
  });

  it('converts raw persisted data to a domain object via fromPersisted', () => {
    const result = readDomain({ schemaVersion: 1, label: 'hello' }, spec);
    expect(result).toEqual({ label: 'hello' });
  });

  it('migrates then converts when schema is outdated', () => {
    const result = readDomain({ schemaVersion: 0, name: 'hello' }, spec);
    expect(result).toEqual({ label: 'hello' });
  });

  it('calls validatePersisted before running migration', () => {
    const order: string[] = [];
    const specWithValidation = defineModel({
      currentVersion: 1,
      toPersisted: (d: { x: number }) => ({ schemaVersion: 1 as const, x: d.x }),
      fromPersisted: (p) => ({ x: p.x }),
      migrations: {
        0: (doc: { schemaVersion: number; x: number }) => {
          order.push('migrate');
          return { schemaVersion: 1 as const, x: doc.x };
        },
      },
      validatePersisted: (_value: unknown) => {
        order.push('validate');
      },
    });

    readDomain({ schemaVersion: 0, x: 1 }, specWithValidation);
    expect(order).toEqual(['validate', 'migrate']);
  });

  it('propagates validatePersisted errors and stops migration', () => {
    const migrateSpy = vi.fn();
    const specWithBadValidation = defineModel({
      currentVersion: 1,
      toPersisted: (d: { x: number }) => ({ schemaVersion: 1 as const, x: d.x }),
      fromPersisted: (p) => ({ x: p.x }),
      migrations: {
        0: migrateSpy,
      },
      validatePersisted: (_value: unknown) => {
        throw new Error('Validation failed');
      },
    });

    expect(() => readDomain({ schemaVersion: 0, x: 1 }, specWithBadValidation)).toThrow(
      'Validation failed',
    );
    expect(migrateSpy).not.toHaveBeenCalled();
  });

  it('throws for invalid schemaVersion in raw data', () => {
    expect(() => readDomain({ schemaVersion: -1, label: 'x' }, spec)).toThrow('Invalid schemaVersion');
    expect(() => readDomain({ label: 'x' }, spec)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertObject
// ---------------------------------------------------------------------------

describe('assertObject', () => {
  it('passes for a plain object', () => {
    expect(() => assertObject({ a: 1 })).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => assertObject(null)).toThrow('Expected object');
  });

  it('throws for a string', () => {
    expect(() => assertObject('hello')).toThrow('Expected object');
  });

  it('throws for a number', () => {
    expect(() => assertObject(42)).toThrow('Expected object');
  });

  it('uses a custom message when provided', () => {
    expect(() => assertObject(null, 'need an object here')).toThrow('need an object here');
  });
});

// ---------------------------------------------------------------------------
// assertNumber
// ---------------------------------------------------------------------------

describe('assertNumber', () => {
  it('passes for a valid number', () => {
    expect(() => assertNumber(0)).not.toThrow();
    expect(() => assertNumber(-5.5)).not.toThrow();
  });

  it('throws for NaN', () => {
    expect(() => assertNumber(NaN)).toThrow('Expected number');
  });

  it('throws for a string', () => {
    expect(() => assertNumber('42')).toThrow('Expected number');
  });

  it('throws for undefined', () => {
    expect(() => assertNumber(undefined)).toThrow('Expected number');
  });

  it('uses a custom message when provided', () => {
    expect(() => assertNumber('x', 'need a number')).toThrow('need a number');
  });
});

// ---------------------------------------------------------------------------
// createValidator
// ---------------------------------------------------------------------------

describe('createValidator', () => {
  it('returns a function that passes when the inner validator does not throw', () => {
    const validate = createValidator<{ x: number }>((v) => {
      if (typeof (v as { x?: unknown }).x !== 'number') throw new Error('bad');
    });
    expect(() => validate({ x: 1 })).not.toThrow();
  });

  it('returns a function that propagates errors from the inner validator', () => {
    const validate = createValidator<{ x: number }>(() => {
      throw new Error('inner error');
    });
    expect(() => validate({})).toThrow('inner error');
  });
});
