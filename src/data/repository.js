import { courseCatalog, seedAssignments } from "./mock.js?v=mobile-reset-7";

const STORAGE_KEY = "kmu-vd-time-analyzer.records";

function readLocalRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export const timeRepository = {
  async listCatalog() {
    return courseCatalog;
  },

  async listRecords() {
    return [...seedAssignments, ...readLocalRecords()];
  },

  async createRecord(recordInput) {
    const nextRecord = {
      id: crypto.randomUUID(),
      source: "local",
      createdAt: new Date().toISOString(),
      ...recordInput,
    };

    const currentRecords = readLocalRecords();
    currentRecords.unshift(nextRecord);
    writeLocalRecords(currentRecords);
    return nextRecord;
  },
};

export function createApiCompatibleRepository(apiClient) {
  return {
    async listCatalog() {
      return apiClient.get("/catalog");
    },
    async listRecords() {
      return apiClient.get("/records");
    },
    async createRecord(recordInput) {
      return apiClient.post("/records", recordInput);
    },
  };
}
