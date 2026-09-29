import {
  type SchemaObject,
  blankSchema,
  questionsFromSchema,
} from "./schema";

export type SchemaEditor = {
  read: () => ReturnType<typeof questionsFromSchema>;
};

export function mountSchemaEditor(
  list: HTMLElement,
  addButton: HTMLButtonElement,
  typeSelect: HTMLSelectElement,
  initial: SchemaObject[],
): SchemaEditor {
  const objects = initial.map((object) => structuredClone(object));
  const expanded = objects.map(() => true);

  function clearError(): void {
    const node = document.getElementById("schema-error");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  function render(): void {
    list.replaceChildren();
    if (objects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "schema-empty";
      empty.textContent =
        "No context schema yet. Choose a type and press Add schema.";
      list.append(empty);
      return;
    }
    objects.forEach((object, index) => {
      list.append(renderObject(object, index, expanded[index] !== false));
    });
  }

  list.addEventListener("input", (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    const index = Number(target.dataset.index);
    const object = objects[index];
    if (!object) return;
    clearError();
    const field = target.dataset.field;
    const row = Number(target.dataset.row);
    if (field === "name") object.name = target.value;
    if (field === "instructions") object.instructions = target.value;
    if (object.type === "choice" && field === "key") {
      const criterion = object.criteria[row];
      if (criterion) criterion.key = target.value;
    }
    if (object.type === "choice" && field === "text") {
      const criterion = object.criteria[row];
      if (criterion) criterion.text = target.value;
    }
    if (object.type === "score" && field === "level") {
      object.criteria[row] = target.value;
    }
    if (object.type === "noul" && field === "true") object.trueText = target.value;
    if (object.type === "noul" && field === "false") {
      object.falseText = target.value;
    }
  });

  list.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement | null)?.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const index = Number(button.dataset.index);
    const object = objects[index];
    const action = button.dataset.action;
    if (!object || !action) return;
    clearError();

    if (action === "toggle-object") {
      expanded[index] = !expanded[index];
      const card = button.closest(".schema-object");
      const body = card?.querySelector<HTMLElement>(".schema-body");
      const open = expanded[index] === true;
      if (body) body.hidden = !open;
      setIconButton(button, open ? "Collapse" : "Expand", open ? "collapse" : "expand");
      button.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (action === "remove-object") {
      objects.splice(index, 1);
      expanded.splice(index, 1);
      render();
      addButton.focus();
      return;
    }
    if (action === "add-criterion" && object.type === "choice") {
      object.criteria.push({ key: "", text: "" });
      render();
      document
        .getElementById(`schema-${index}-key-${object.criteria.length - 1}`)
        ?.focus();
      return;
    }
    if (action === "add-criterion" && object.type === "score") {
      object.criteria.push("");
      render();
      document
        .getElementById(`schema-${index}-level-${object.criteria.length - 1}`)
        ?.focus();
      return;
    }
    if (action === "remove-criterion") {
      const row = Number(button.dataset.row);
      if (object.type === "choice" || object.type === "score") {
        object.criteria.splice(row, 1);
        render();
      }
    }
  });

  addButton.addEventListener("click", () => {
    const type = typeSelect.value;
    if (type !== "choice" && type !== "score" && type !== "noul") return;
    clearError();
    objects.push(blankSchema(type));
    expanded.push(true);
    render();
    document.getElementById(`schema-${objects.length - 1}-name`)?.focus();
  });

  render();

  return {
    read: () => questionsFromSchema(objects),
  };
}

function renderObject(
  object: SchemaObject,
  index: number,
  open: boolean,
): HTMLElement {
  const card = el("fieldset", "schema-object");
  card.append(el("legend", undefined, object.type));

  const head = el("div", "schema-head");
  head.append(labeledField("Name", textInput(object.name, index, "name", `schema-${index}-name`)));
  const toggle = iconActionButton(
    open ? "Collapse" : "Expand",
    open ? "collapse" : "expand",
    "toggle-object",
    index,
  );
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-controls", `schema-${index}-body`);
  head.append(toggle);
  head.append(iconActionButton("Remove", "remove", "remove-object", index));
  card.append(head);

  const body = el("div", "schema-body");
  body.id = `schema-${index}-body`;
  body.hidden = !open;
  body.append(
    labeledField(
      "Instructions",
      textArea(
        object.instructions,
        index,
        "instructions",
        `schema-${index}-instructions`,
      ),
    ),
  );
  if (object.type === "choice") body.append(choiceCriteria(object, index));
  if (object.type === "score") body.append(scoreCriteria(object, index));
  if (object.type === "noul") body.append(noulCriteria(object, index));
  card.append(body);
  return card;
}

function choiceCriteria(
  object: Extract<SchemaObject, { type: "choice" }>,
  index: number,
): HTMLElement {
  const block = el("div", "criteria");
  block.append(el("p", "criteria-label", "Criteria"));
  object.criteria.forEach((criterion, row) => {
    const line = el("div", "criterion-row");
    line.append(
      labeledField(
        "Key",
        textInput(criterion.key, index, "key", `schema-${index}-key-${row}`, row),
      ),
    );
    line.append(
      labeledField(
        "Text",
        textInput(
          criterion.text,
          index,
          "text",
          `schema-${index}-text-${row}`,
          row,
        ),
      ),
    );
    line.append(iconActionButton("Remove", "remove", "remove-criterion", index, row));
    block.append(line);
  });
  block.append(actionButton("Add criterion", "add-criterion", index, "quiet"));
  return block;
}

function scoreCriteria(
  object: Extract<SchemaObject, { type: "score" }>,
  index: number,
): HTMLElement {
  const block = el("div", "criteria");
  block.append(el("p", "criteria-label", "Levels"));
  object.criteria.forEach((level, row) => {
    const line = el("div", "criterion-row score-row");
    line.append(
      labeledField(
        `Level ${row}`,
        textInput(level, index, "level", `schema-${index}-level-${row}`, row),
      ),
    );
    line.append(iconActionButton("Remove", "remove", "remove-criterion", index, row));
    block.append(line);
  });
  block.append(actionButton("Add level", "add-criterion", index, "quiet"));
  return block;
}

function noulCriteria(
  object: Extract<SchemaObject, { type: "noul" }>,
  index: number,
): HTMLElement {
  const block = el("div", "criteria");
  block.append(el("p", "criteria-label", "Criteria"));
  block.append(
    labeledField(
      "true",
      textInput(object.trueText, index, "true", `schema-${index}-true`),
    ),
  );
  block.append(
    labeledField(
      "false",
      textInput(object.falseText, index, "false", `schema-${index}-false`),
    ),
  );
  return block;
}

function labeledField(labelText: string, control: HTMLElement): HTMLElement {
  const wrap = el("div", "field");
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = labelText;
  wrap.append(label, control);
  return wrap;
}

function textInput(
  value: string,
  index: number,
  field: string,
  id: string,
  row?: number,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.index = String(index);
  input.dataset.field = field;
  if (row !== undefined) input.dataset.row = String(row);
  return input;
}

function textArea(
  value: string,
  index: number,
  field: string,
  id: string,
): HTMLTextAreaElement {
  const area = document.createElement("textarea");
  area.id = id;
  area.rows = 3;
  area.value = value;
  area.dataset.index = String(index);
  area.dataset.field = field;
  return area;
}

function iconActionButton(
  label: string,
  icon: "collapse" | "expand" | "remove",
  action: string,
  index: number,
  row?: number,
): HTMLButtonElement {
  const button = actionButton(label, action, index, "quiet icon-button", row);
  setIconButton(button, label, icon);
  return button;
}

function setIconButton(
  button: HTMLButtonElement,
  label: string,
  icon: "collapse" | "expand" | "remove",
): void {
  button.setAttribute("aria-label", label);
  button.replaceChildren(iconSvg(icon));
}

function iconSvg(icon: "collapse" | "expand" | "remove"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  if (icon === "collapse") path.setAttribute("d", "M3 10.5 L8 5.5 L13 10.5");
  else if (icon === "expand") path.setAttribute("d", "M3 5.5 L8 10.5 L13 5.5");
  else path.setAttribute("d", "M4 4 L12 12 M12 4 L4 12");
  svg.append(path);
  return svg;
}

function actionButton(
  text: string,
  action: string,
  index: number,
  className: string,
  row?: number,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.dataset.action = action;
  button.dataset.index = String(index);
  if (row !== undefined) button.dataset.row = String(row);
  return button;
}

function el(
  tag: keyof HTMLElementTagNameMap,
  className?: string,
  text?: string,
): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
