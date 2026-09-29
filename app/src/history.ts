import type { DecideBody } from "./decide";

const HISTORY_KEY = "layaDecideHistory";
const HISTORY_LIMIT = 40;

export type HistoryResponse =
  | { status: "pending" }
  | { status: "received"; httpStatus: number; body: string }
  | { status: "failed"; message: string };

export type HistoryEntry = {
  id: string;
  sentAt: string;
  url: string;
  request: DecideBody;
  response: HistoryResponse;
};

export function loadHistory(storage: Storage): HistoryEntry[] {
  let raw: string | null;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function rememberRequest(storage: Storage, entry: HistoryEntry): void {
  writeHistory(storage, [entry, ...loadHistory(storage)].slice(0, HISTORY_LIMIT));
}

export function rememberResponse(
  storage: Storage,
  id: string,
  response: HistoryResponse,
): void {
  writeHistory(
    storage,
    loadHistory(storage).map((entry) =>
      entry.id === id ? { ...entry, response } : entry,
    ),
  );
}

function writeHistory(storage: Storage, entries: HistoryEntry[]): void {
  let next = entries;
  while (next.length > 0) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(next));
      return;
    } catch {
      next = next.slice(0, -1);
    }
  }
  try {
    storage.removeItem(HISTORY_KEY);
  } catch {
    // Session storage can be unavailable.
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.sentAt === "string" &&
    typeof entry.url === "string" &&
    isDecideBody(entry.request) &&
    isHistoryResponse(entry.response)
  );
}

function isDecideBody(value: unknown): value is DecideBody {
  if (value === null || typeof value !== "object") return false;
  const body = value as Partial<DecideBody>;
  return (
    typeof body.model === "string" &&
    typeof body.state === "string" &&
    typeof body.keep_alive === "string" &&
    body.questions !== null &&
    typeof body.questions === "object" &&
    !Array.isArray(body.questions)
  );
}

function isHistoryResponse(value: unknown): value is HistoryResponse {
  if (value === null || typeof value !== "object") return false;
  const response = value as Partial<HistoryResponse>;
  if (response.status === "pending") return true;
  if (response.status === "failed") return typeof response.message === "string";
  if (response.status === "received") {
    return typeof response.httpStatus === "number" && typeof response.body === "string";
  }
  return false;
}
