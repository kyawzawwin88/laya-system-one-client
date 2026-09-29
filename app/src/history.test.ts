import { describe, expect, it } from "vitest";
import {
  type HistoryEntry,
  loadHistory,
  rememberRequest,
  rememberResponse,
} from "./history";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

function entry(id: string): HistoryEntry {
  return {
    id,
    sentAt: "2026-09-29T07:00:00.000Z",
    url: "http://192.168.2.50:11435/api/decide",
    request: {
      model: "laya",
      state: "Refund the second charge.",
      questions: {},
      keep_alive: "10m",
    },
    response: { status: "pending" },
  };
}

describe("session history", () => {
  it("stores the request when it is sent, then the response when it arrives", () => {
    const storage = memoryStorage();
    rememberRequest(storage, entry("a"));
    expect(loadHistory(storage)[0]?.response).toEqual({ status: "pending" });

    rememberResponse(storage, "a", {
      status: "received",
      httpStatus: 200,
      body: "{\"ok\":true}",
    });

    const saved = loadHistory(storage);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.response).toEqual({
      status: "received",
      httpStatus: 200,
      body: "{\"ok\":true}",
    });
  });

  it("keeps the newest request first", () => {
    const storage = memoryStorage();
    rememberRequest(storage, entry("older"));
    rememberRequest(storage, entry("newer"));
    expect(loadHistory(storage).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("ignores a stored value that is not history", () => {
    const storage = memoryStorage();
    storage.setItem("layaDecideHistory", "{\"nope\":true}");
    expect(loadHistory(storage)).toEqual([]);
  });
});
