const HEARTBEAT_ACTIVE_WINDOW_MS = 180_000;
const byteUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];

function shortSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 's/d';
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < byteUnits.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 10 || Number.isInteger(size) ? 0 : 1;
  const formatted = size.toLocaleString('es-CL', { maximumFractionDigits: precision });
  return `${formatted} ${byteUnits[unitIndex]}`;
}

function isDeviceActive(heartbeat, now) {
  if (!heartbeat?.lastSeenAtUtc) return false;
  const elapsed = now - Date.parse(heartbeat.lastSeenAtUtc);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= HEARTBEAT_ACTIVE_WINDOW_MS;
}

export class AgentAssetService {
  constructor(agentDataStore, now = () => Date.now()) {
    this.agentDataStore = agentDataStore;
    this.now = now;
  }

  async list() {
    const snapshots = await this.agentDataStore.listDeviceSnapshots();
    const now = this.now();
    const items = snapshots.map(({ deviceId, inventory, heartbeat }) => {
      const ram = shortSize(inventory.ramInstalledBytes);
      const diskBytes = inventory.volumes.reduce((total, volume) => total + volume.totalBytes, 0);
      const disk = shortSize(diskBytes);
      const active = isDeviceActive(heartbeat, now);
      return {
        id: deviceId,
        name: inventory.computerName,
        type: null,
        serial: inventory.serialNumber,
        status: `${active ? 'Activo' : 'Inactivo'} · RAM ${ram} · Disco ${disk}`,
        condition: null,
        assignedTo: null,
        location: ''
      };
    });
    return { items, total: items.length };
  }
}