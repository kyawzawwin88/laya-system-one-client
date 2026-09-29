export type ChoiceCriterion = { key: string; text: string };

export type SchemaObject =
  | {
      name: string;
      type: "choice";
      instructions: string;
      criteria: ChoiceCriterion[];
    }
  | {
      name: string;
      type: "score";
      instructions: string;
      criteria: string[];
    }
  | {
      name: string;
      type: "noul";
      instructions: string;
      trueText: string;
      falseText: string;
    };

export type SchemaType = SchemaObject["type"];

export type SchemaBuildResult =
  | { ok: true; questions: Record<string, unknown> }
  | { ok: false; message: string; fieldId: string };

export function blankSchema(type: SchemaType): SchemaObject {
  if (type === "choice") {
    return {
      name: "",
      type: "choice",
      instructions: "",
      criteria: [{ key: "", text: "" }],
    };
  }
  if (type === "score") {
    return { name: "", type: "score", instructions: "", criteria: [""] };
  }
  return {
    name: "",
    type: "noul",
    instructions: "",
    trueText: "",
    falseText: "",
  };
}

export function schemaFromQuestions(questions: object): SchemaObject[] {
  const objects: SchemaObject[] = [];
  for (const [name, value] of Object.entries(questions)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const item = value as Record<string, unknown>;
    const instructions =
      typeof item.instructions === "string" ? item.instructions : "";
    if (item.type === "choice" && isRecord(item.criteria)) {
      objects.push({
        name,
        type: "choice",
        instructions,
        criteria: Object.entries(item.criteria).map(([key, text]) => ({
          key,
          text: String(text),
        })),
      });
    } else if (item.type === "score" && Array.isArray(item.criteria)) {
      objects.push({
        name,
        type: "score",
        instructions,
        criteria: item.criteria.map((entry) => String(entry)),
      });
    } else if (item.type === "noul" && isRecord(item.criteria)) {
      objects.push({
        name,
        type: "noul",
        instructions,
        trueText: String(item.criteria.true ?? ""),
        falseText: String(item.criteria.false ?? ""),
      });
    }
  }
  return objects;
}

export function questionsFromSchema(objects: SchemaObject[]): SchemaBuildResult {
  const questions: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) continue;
    const name = object.name.trim();
    if (!name) {
      return {
        ok: false,
        message: "Each context schema needs a name",
        fieldId: `schema-${index}-name`,
      };
    }
    if (seen.has(name)) {
      return {
        ok: false,
        message: "Context schema names must be unique",
        fieldId: `schema-${index}-name`,
      };
    }
    seen.add(name);

    if (object.type === "choice") {
      const criteria: Record<string, string> = {};
      for (let row = 0; row < object.criteria.length; row += 1) {
        const criterion = object.criteria[row];
        if (!criterion) continue;
        const key = criterion.key.trim();
        if (!key) {
          return {
            ok: false,
            message: "Each choice criterion needs a key",
            fieldId: `schema-${index}-key-${row}`,
          };
        }
        criteria[key] = criterion.text;
      }
      questions[name] = {
        type: "choice",
        instructions: object.instructions,
        criteria,
      };
    } else if (object.type === "score") {
      questions[name] = {
        type: "score",
        instructions: object.instructions,
        criteria: [...object.criteria],
      };
    } else {
      questions[name] = {
        type: "noul",
        instructions: object.instructions,
        criteria: { true: object.trueText, false: object.falseText },
      };
    }
  }

  return { ok: true, questions };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
