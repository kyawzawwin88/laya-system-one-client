import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_URL,
  MSG_BASE_REQUIRED,
  MSG_QUESTIONS,
  MSG_SCHEME,
  SAMPLE_RESPONSE_JSON,
  buildDecideBody,
  formatDurationNs,
  isChoiceAnswer,
  isNoulAnswer,
  isScoreAnswer,
  joinDecideUrl,
  parseDecideResponse,
  parseQuestionsJson,
  validateBaseUrl,
} from "./decide";

describe("joinDecideUrl", () => {
  it("joins the decide path", () => {
    expect(joinDecideUrl(DEFAULT_BASE_URL)).toBe(
      "http://192.168.2.50:11435/api/decide",
    );
  });

  it("strips one trailing slash before joining", () => {
    expect(joinDecideUrl("http://192.168.2.50:11435/")).toBe(
      "http://192.168.2.50:11435/api/decide",
    );
  });
});

describe("validateBaseUrl", () => {
  it("rejects blank base URL", () => {
    expect(validateBaseUrl("")).toEqual({
      ok: false,
      message: MSG_BASE_REQUIRED,
    });
    expect(validateBaseUrl("   ")).toEqual({
      ok: false,
      message: MSG_BASE_REQUIRED,
    });
  });

  it("rejects non-http schemes", () => {
    expect(validateBaseUrl("ftp://example.com")).toEqual({
      ok: false,
      message: MSG_SCHEME,
    });
    expect(validateBaseUrl("file:///tmp")).toEqual({
      ok: false,
      message: MSG_SCHEME,
    });
  });

  it("accepts http and https", () => {
    expect(validateBaseUrl("http://192.168.2.50:11435")).toEqual({
      ok: true,
      url: "http://192.168.2.50:11435/api/decide",
    });
    expect(validateBaseUrl("https://example.com/")).toEqual({
      ok: true,
      url: "https://example.com/api/decide",
    });
  });
});

describe("parseQuestionsJson", () => {
  it("rejects non-JSON", () => {
    expect(parseQuestionsJson("not json")).toEqual({
      ok: false,
      message: MSG_QUESTIONS,
    });
  });

  it("rejects arrays", () => {
    expect(parseQuestionsJson("[1,2]")).toEqual({
      ok: false,
      message: MSG_QUESTIONS,
    });
  });

  it("rejects primitives", () => {
    expect(parseQuestionsJson('"hello"')).toEqual({
      ok: false,
      message: MSG_QUESTIONS,
    });
  });

  it("accepts a JSON object", () => {
    const result = parseQuestionsJson('{"a":1}');
    expect(result).toEqual({ ok: true, questions: { a: 1 } });
  });
});

describe("formatDurationNs", () => {
  it("formats nanoseconds as seconds with two decimals", () => {
    expect(formatDurationNs(2091129824)).toBe("2.09s");
  });

  it("leaves non-safe-integers unchanged", () => {
    expect(formatDurationNs(2.5)).toBe("2.5");
    expect(formatDurationNs(Number.MAX_SAFE_INTEGER + 2)).toBe(
      String(Number.MAX_SAFE_INTEGER + 2),
    );
  });
});

describe("parseDecideResponse sample", () => {
  it("parses choice, score, noul, and keeps unknown types as JSON", () => {
    const parsed = parseDecideResponse(SAMPLE_RESPONSE_JSON);
    const department = parsed.answers?.department;
    const urgency = parsed.answers?.urgency;
    const refund = parsed.answers?.refund;

    expect(department && isChoiceAnswer(department)).toBe(true);
    if (department && isChoiceAnswer(department)) {
      expect(department.choice).toBe("billing");
      expect(department.probabilities.billing).toBe(0.9823);
    }

    expect(urgency && isScoreAnswer(urgency)).toBe(true);
    if (urgency && isScoreAnswer(urgency)) {
      expect(urgency.score).toBe(1.8055);
      expect(urgency.legend["1"]).toBe("Needs attention this week");
    }

    expect(refund && isNoulAnswer(refund)).toBe(true);
    if (refund && isNoulAnswer(refund)) {
      expect(refund.noul).toBe(0.8328);
    }

    const withUnknown = parseDecideResponse(
      JSON.stringify({
        ...parsed,
        answers: {
          ...parsed.answers,
          custom: { type: "custom", value: 42 },
        },
      }),
    );
    const custom = withUnknown.answers?.custom;
    expect(custom?.type).toBe("custom");
    expect(JSON.stringify(custom)).toContain('"value":42');
    expect(isChoiceAnswer(null)).toBe(false);
    expect(isChoiceAnswer({ type: "choice" })).toBe(false);
    expect(isScoreAnswer({ type: "score", score: 1 })).toBe(false);
    expect(isNoulAnswer({ type: "noul" })).toBe(false);
    expect(withUnknown.answers?.department && isChoiceAnswer(withUnknown.answers.department)).toBe(
      true,
    );
  });

  it("builds a body with only the four keys", () => {
    const body = buildDecideBody({
      model: "laya",
      state: "hello",
      questions: { a: 1 },
      keep_alive: "10m",
    });
    expect(Object.keys(body).sort()).toEqual([
      "keep_alive",
      "model",
      "questions",
      "state",
    ]);
  });
});
