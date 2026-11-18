import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { config } from '../config.js';

const defaultPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/agents.json');

function emptyStore() {
  return { inventories: {}, heartbeats: {}, activities: {} };
}

export class AgentDataStore {
  constructor(path = config.AGENT_DATA_PATH || defaultPath) {
    this.path = resolve(path);
    this.data = null;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = emptyStore();
    }
    return this.data;
  }

  async listDeviceSnapshots() {
    const data = await this.load();
    return Object.entries(data.inventories).map(([deviceId, record]) => ({
      deviceId,
      inventory: record.inventory,
      heartbeat: data.heartbeats[deviceId] ?? null
    }));
  }

  persist(change) {
    const result = this.queue.then(async () => {
      const current = await this.load();
      const next = structuredClone(current);
      const response = change(next);
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, JSON.stringify(next), { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, this.path);
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
      this.data = next;
      return response;
    });
    this.queue = result.catch(() => {});
    return result;
  }

  acceptInventory(deviceId, inventory, receivedAtUtc) {
    return this.persist((data) => {
      const previous = data.inventories[deviceId];
      const acceptedIds = data.inventoryIds ?? (data.inventoryIds = {});
      const deviceIds = acceptedIds[deviceId] ?? (acceptedIds[deviceId] = {});
      const accepted = deviceIds[inventory.inventoryId];
      if (accepted) {
        if (!isDeepStrictEqual(accepted, inventory)) {
          throw Object.assign(new Error('El inventoryId ya existe con otros datos.'), { status: 409, code: 'ID_CONFLICT' });
        }
        return { duplicate: true };
      }
      deviceIds[inventory.inventoryId] = inventory;
      const ids = Object.keys(deviceIds);
      if (ids.length > 1000) delete deviceIds[ids[0]];
      if (!previous || Date.parse(inventory.collectedAtUtc) >= Date.parse(previous.inventory.collectedAtUtc)) {
        data.inventories[deviceId] = { inventory, receivedAtUtc };
      }
      return { duplicate: false };
    });
  }

  acceptHeartbeat(deviceId, heartbeat, receivedAtUtc) {
    return this.persist((data) => {
      data.heartbeats[deviceId] = { ...heartbeat, lastSeenAtUtc: receivedAtUtc };
      return { accepted: true };
    });
  }

  acceptActivity(deviceId, envelope, receivedAtUtc) {
    return this.persist((data) => {
      const batches = data.activities[deviceId] ?? (data.activities[deviceId] = {});
      const batchId = envelope.activity.batchId.toLowerCase();
      const previous = batches[batchId];
      if (previous) {
        if (previous.userSid !== envelope.userSid || !isDeepStrictEqual(previous.activity, envelope.activity)) {
          throw Object.assign(new Error('El batchId ya existe con otros datos.'), { status: 409, code: 'ID_CONFLICT' });
        }
        return { batchId, duplicate: true };
      }
      batches[batchId] = {
        userSid: envelope.userSid,
        userName: envelope.userName,
        receivedAtUtc: envelope.receivedAtUtc,
        activity: envelope.activity,
        serverReceivedAtUtc: receivedAtUtc
      };
      return { batchId, duplicate: false };
    });
  }
}