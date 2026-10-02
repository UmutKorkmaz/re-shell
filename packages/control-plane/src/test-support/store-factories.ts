import { migrate } from '../db/migrations.js';
import { SqliteTenantStore } from '../db/sqlite-store.js';
import { openDatabase } from '../db/sqlite.js';
import { InMemoryTenantStore, TenantAdminStore } from '../tenant.js';

/**
 * Store factories for the parameterised isolation suites: every isolation and
 * authorization test runs against BOTH the in-memory store and the SQLite store,
 * so the two implementations are held to one contract.
 */

export interface StoreSnapshot {
  tenants?: readonly unknown[];
  workspaces?: readonly unknown[];
  members?: readonly unknown[];
}

export interface StoreFactory {
  name: string;
  create(snapshot: StoreSnapshot): TenantAdminStore;
}

export const STORE_FACTORIES: readonly StoreFactory[] = [
  {
    name: 'InMemoryTenantStore',
    create: (snapshot) => new InMemoryTenantStore(snapshot),
  },
  {
    name: 'SqliteTenantStore',
    create: (snapshot) => {
      const db = openDatabase(':memory:');
      migrate(db);
      return SqliteTenantStore.fromSnapshot(db, snapshot);
    },
  },
];
