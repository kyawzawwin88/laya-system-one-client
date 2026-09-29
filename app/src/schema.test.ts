import { describe, expect, it } from "vitest";
import { DEFAULT_QUESTIONS } from "./decide";
import {
  blankSchema,
  questionsFromSchema,
  schemaFromQuestions,
} from "./schema";

describe("context schema", () => {
  it("round-trips the sample questions", () => {
    const built = questionsFromSchema(schemaFromQuestions(DEFAULT_QUESTIONS));
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(JSON.stringify(built.questions)).toBe(
        JSON.stringify(DEFAULT_QUESTIONS),
      );
    }
  });

  it("rejects a blank name", () => {
    const object = blankSchema("choice");
    const built = questionsFromSchema([object]);
    expect(built).toEqual({
      ok: false,
      message: "Each context schema needs a name",
      fieldId: "schema-0-name",
    });
  });

  it("rejects a duplicate name", () => {
    const first = blankSchema("noul");
    first.name = "refund";
    const second = blankSchema("score");
    second.name = "refund";
    const built = questionsFromSchema([first, second]);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.fieldId).toBe("schema-1-name");
    }
  });

  it("builds a choice object from typed criteria", () => {
    const object = blankSchema("choice");
    if (object.type !== "choice") throw new Error("expected choice");
    object.name = "department";
    object.instructions = "Which team?";
    object.criteria = [{ key: "billing", text: "Payments" }];
    const built = questionsFromSchema([object]);
    expect(built).toEqual({
      ok: true,
      questions: {
        department: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: "Payments" },
        },
      },
    });
  });
});
