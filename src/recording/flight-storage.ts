import type { FlightRecord } from './types';

export interface FlightRecordStore { save(record: FlightRecord): Promise<void>; list(limit?: number): Promise<FlightRecord[]>; get(id: string): Promise<FlightRecord | undefined>; }

export class MemoryFlightRecordStore implements FlightRecordStore {
  private records: FlightRecord[] = [];
  async save(record: FlightRecord) { this.records = [record, ...this.records.filter((item) => item.id !== record.id)].slice(0, 20); }
  async list(limit = 20) { return this.records.slice(0, limit); }
  async get(id: string) { return this.records.find((record) => record.id === id); }
}

export class IndexedDbFlightRecordStore implements FlightRecordStore {
  private readonly databaseName = 'apollo11-flight-recorder';
  private readonly storeName = 'flight-records';
  private openPromise?: Promise<IDBDatabase>;
  private open() {
    if (this.openPromise) return this.openPromise;
    this.openPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) { reject(new Error('IndexedDB unavailable')); return; }
      const request = indexedDB.open(this.databaseName, 1);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onupgradeneeded = () => { const database = request.result; if (!database.objectStoreNames.contains(this.storeName)) { const store = database.createObjectStore(this.storeName, { keyPath: 'id' }); store.createIndex('createdAt', 'createdAt'); } };
      request.onsuccess = () => resolve(request.result);
    });
    return this.openPromise;
  }
  async save(record: FlightRecord) {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => { const request = database.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(record); request.onerror = () => reject(request.error ?? new Error('IndexedDB save failed')); request.onsuccess = () => resolve(); });
    const records = await this.list(1000);
    for (const stale of records.slice(20)) await this.remove(stale.id);
  }
  async list(limit = 20) {
    const database = await this.open();
    return new Promise<FlightRecord[]>((resolve, reject) => { const request = database.transaction(this.storeName, 'readonly').objectStore(this.storeName).index('createdAt').getAll(); request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed')); request.onsuccess = () => resolve((request.result as FlightRecord[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)); });
  }
  async get(id: string) { const database = await this.open(); return new Promise<FlightRecord | undefined>((resolve, reject) => { const request = database.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(id); request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed')); request.onsuccess = () => resolve(request.result as FlightRecord | undefined); }); }
  private async remove(id: string) { const database = await this.open(); await new Promise<void>((resolve, reject) => { const request = database.transaction(this.storeName, 'readwrite').objectStore(this.storeName).delete(id); request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed')); request.onsuccess = () => resolve(); }); }
}
