export const DEFAULT_BASE_URL = "http://192.168.2.50:11435";
export const DEFAULT_MODEL = "laya";
export const DEFAULT_KEEP_ALIVE = "10m";
export const DEFAULT_STATE =
  "I was charged twice for my subscription this month. Please refund the second charge.";

export const DEFAULT_QUESTIONS = {
  department: {
    type: "choice",
    instructions: "Which team should handle this ticket?",
    criteria: {
      billing: "Payments, invoices and refunds",
      technical: "Bugs, errors and outages",
      account: "Login, profile and settings",
    },
  },
  urgency: {
    type: "score",
    instructions: "How urgent is this ticket?",
    criteria: [
      "Can wait",
      "Needs attention this week",
      "Needs attention today",
    ],
  },
  refund: {
    type: "noul",
    instructions: "The customer asks for money back.",
    criteria: {
      true: "Asks for a refund",
      false: "Does not ask for a refund",
    },
  },
} as const;

export const MSG_BASE_REQUIRED = "The base URL is required";
export const MSG_SCHEME = "The scheme must be http or https";
export const MSG_QUESTIONS = "Questions must be a JSON object";

export type DecideBody = {
  model: string;
  state: string;
  questions: Record<string, unknown>;
  keep_alive: string;
};

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
};

export type NoulAnswer = {
  type: "noul";
  noul: number;
};

export type UnknownAnswer = {
  type: string;
  [key: string]: unknown;
};

export type DecideAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer | UnknownAnswer;

export type DecideResponse = {
  model?: string;
  answers?: Record<string, DecideAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
  routing?: {
    router?: string;
    model?: string;
    route?: string;
    reason?: string;
  };
  state_truncated?: boolean;
  done_reason?: string;
  created_at?: string;
  total_duration?: number;
  load_duration?: number;
  eval_duration?: number;
  [key: string]: unknown;
};

export type BaseUrlResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export type QuestionsResult =
  | { ok: true; questions: Record<string, unknown> }
  | { ok: false; message: string };

export function joinDecideUrl(base: string): string {
  const trimmed = base.trim();
  const withoutSlash = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return `${withoutSlash}/api/decide`;
}

export function validateBaseUrl(base: string): BaseUrlResult {
  const trimmed = base.trim();
  if (!trimmed) {
    return { ok: false, message: MSG_BASE_REQUIRED };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: MSG_SCHEME };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: MSG_SCHEME };
  }
  return { ok: true, url: joinDecideUrl(trimmed) };
}

export function parseQuestionsJson(raw: string): QuestionsResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: MSG_QUESTIONS };
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return { ok: false, message: MSG_QUESTIONS };
  }
  return { ok: true, questions: value as Record<string, unknown> };
}

export function buildDecideBody(input: {
  model: string;
  state: string;
  questions: Record<string, unknown>;
  keep_alive: string;
}): DecideBody {
  return {
    model: input.model,
    state: input.state,
    questions: input.questions,
    keep_alive: input.keep_alive,
  };
}

/** API durations are nanoseconds; show seconds with two decimals. */
export function formatDurationNs(value: unknown): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return String(value);
  }
  return `${(value / 1_000_000_000).toFixed(2)}s`;
}

export function parseDecideResponse(raw: string): DecideResponse {
  const data = JSON.parse(raw) as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Response is not a JSON object");
  }
  return data as DecideResponse;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isChoiceAnswer(answer: unknown): answer is ChoiceAnswer {
  if (!isPlainObject(answer) || answer.type !== "choice") return false;
  return (
    typeof answer.choice === "string" && isPlainObject(answer.probabilities)
  );
}

export function isScoreAnswer(answer: unknown): answer is ScoreAnswer {
  if (!isPlainObject(answer) || answer.type !== "score") return false;
  return (
    typeof answer.score === "number" &&
    isPlainObject(answer.legend) &&
    isPlainObject(answer.probabilities)
  );
}

export function isNoulAnswer(answer: unknown): answer is NoulAnswer {
  if (!isPlainObject(answer) || answer.type !== "noul") return false;
  return typeof answer.noul === "number";
}

export const SAMPLE_RESPONSE_JSON = `{"model":"laya:en","answers":{"department":{"type":"choice","choice":"billing","confidence":0.9734,"probabilities":{"billing":0.9823,"technical":0.0089,"account":0.0088}},"urgency":{"type":"score","score":1.8055,"confidence":0.7488,"legend":{"0":"Can wait","1":"Needs attention this week","2":"Needs attention today"},"probabilities":{"0":0.027,"1":0.1404,"2":0.8325}},"refund":{"type":"noul","noul":0.8328}},"usage":{"input_tokens":159,"output_tokens":0},"routing":{"router":"laya:latest","model":"laya:en","route":"english","reason":"English Latin text"},"state_truncated":false,"done_reason":"decide","created_at":"2026-09-29T04:18:07.807232987Z","total_duration":2091129824,"load_duration":1873583197,"eval_duration":217276729}`;
