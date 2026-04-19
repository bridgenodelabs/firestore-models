import type { ModelSpec, PersistedBase } from './types.js';

export function createPersistedWrite<
  Domain,
  PersistedLatest extends PersistedBase,
>(_spec: ModelSpec<Domain, PersistedLatest>, value: PersistedLatest): PersistedLatest {
  return value;
}

export function createPersistedUpdate<
  Domain,
  PersistedLatest extends PersistedBase,
>(
  _spec: ModelSpec<Domain, PersistedLatest>,
  patch: Partial<PersistedLatest>,
): Partial<PersistedLatest> {
  return patch;
}
