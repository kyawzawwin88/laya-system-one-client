// src/decide.ts
var DEFAULT_BASE_URL = "http://192.168.2.50:11435";
var DEFAULT_MODEL = "laya";
var DEFAULT_KEEP_ALIVE = "10m";
var DEFAULT_STATE = "I was charged twice for my subscription this month. Please refund the second charge.";
var DEFAULT_QUESTIONS = {
  department: {
    type: "choice",
    instructions: "Which team should handle this ticket?",
    criteria: {
      billing: "Payments, invoices and refunds",
      technical: "Bugs, errors and outages",
      account: "Login, profile and settings"
    }
  },
  urgency: {
    type: "score",
    instructions: "How urgent is this ticket?",
    criteria: [
      "Can wait",
      "Needs attention this week",
      "Needs attention today"
    ]
  },
  refund: {
    type: "noul",
    instructions: "The customer asks for money back.",
    criteria: {
      true: "Asks for a refund",
      false: "Does not ask for a refund"
    }
  }
};
var MSG_BASE_REQUIRED = "The base URL is required";
var MSG_SCHEME = "The scheme must be http or https";
function joinDecideUrl(base) {
  const trimmed = base.trim();
  const withoutSlash = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return `${withoutSlash}/api/decide`;
}
function validateBaseUrl(base) {
  const trimmed = base.trim();
  if (!trimmed) {
    return { ok: false, message: MSG_BASE_REQUIRED };
  }
  let parsed;
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
function buildDecideBody(input) {
  return {
    model: input.model,
    state: input.state,
    questions: input.questions,
    keep_alive: input.keep_alive
  };
}
function formatDurationNs(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return String(value);
  }
  return `${(value / 1e9).toFixed(2)}s`;
}
function parseDecideResponse(raw) {
  const data = JSON.parse(raw);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Response is not a JSON object");
  }
  return data;
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isChoiceAnswer(answer) {
  if (!isPlainObject(answer) || answer.type !== "choice") return false;
  return typeof answer.choice === "string" && isPlainObject(answer.probabilities);
}
function isScoreAnswer(answer) {
  if (!isPlainObject(answer) || answer.type !== "score") return false;
  return typeof answer.score === "number" && isPlainObject(answer.legend) && isPlainObject(answer.probabilities);
}
function isNoulAnswer(answer) {
  if (!isPlainObject(answer) || answer.type !== "noul") return false;
  return typeof answer.noul === "number";
}

// src/render.ts
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function highestKey(probs) {
  let best = null;
  let bestVal = -Infinity;
  for (const [key, value] of Object.entries(probs)) {
    if (value > bestVal) {
      bestVal = value;
      best = key;
    }
  }
  return best;
}
function renderProbabilities(probs) {
  const list = el("ul", "prob-list");
  const top = highestKey(probs);
  for (const [key, value] of Object.entries(probs)) {
    const item = el("li", "prob-item");
    const label = el("span", "prob-label", key);
    const track = el("div", "prob-track");
    const isTop = top !== null && key === top;
    const bar = el("div", isTop ? "prob-bar accent" : "prob-bar");
    const pct = Math.max(0, Math.min(100, value * 100));
    bar.style.width = `${pct}%`;
    track.append(bar);
    const num = el("span", "prob-value", value.toString());
    item.append(label, track, num);
    list.append(item);
  }
  return list;
}
function renderChoice(name, answer) {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  if (!isChoiceAnswer(answer)) return card;
  const chosen = el("p", "answer-chosen accent-text");
  chosen.textContent = `choice: ${answer.choice}`;
  card.append(chosen);
  card.append(el("p", "answer-meta", `confidence: ${answer.confidence}`));
  card.append(renderProbabilities(answer.probabilities));
  return card;
}
function renderScore(name, answer) {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  if (!isScoreAnswer(answer)) return card;
  const score = el("p", "answer-chosen accent-text");
  score.textContent = `score: ${answer.score}`;
  card.append(score);
  card.append(el("p", "answer-meta", `confidence: ${answer.confidence}`));
  const legend = el("dl", "legend");
  for (const [key, label] of Object.entries(answer.legend)) {
    legend.append(el("dt", void 0, key));
    legend.append(el("dd", void 0, label));
  }
  card.append(legend);
  card.append(renderProbabilities(answer.probabilities));
  return card;
}
function renderNoul(name, answer) {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  if (!isNoulAnswer(answer)) return card;
  card.append(el("p", "answer-chosen", `noul: ${answer.noul}`));
  return card;
}
function renderUnknown(name, answer) {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  const pre = el("pre", "answer-json");
  pre.textContent = JSON.stringify(answer, null, 2);
  card.append(pre);
  return card;
}
function renderAnswer(name, answer) {
  if (isChoiceAnswer(answer)) return renderChoice(name, answer);
  if (isScoreAnswer(answer)) return renderScore(name, answer);
  if (isNoulAnswer(answer)) return renderNoul(name, answer);
  const payload = answer !== null && typeof answer === "object" ? answer : { type: "unknown", value: answer };
  return renderUnknown(name, payload);
}
function renderMetadata(response) {
  const block = el("section", "meta");
  block.append(el("h3", void 0, "Response metadata"));
  const rows = [
    ["model", String(response.model ?? "")],
    [
      "usage",
      `input_tokens: ${response.usage?.input_tokens ?? ""}, output_tokens: ${response.usage?.output_tokens ?? ""}`
    ],
    [
      "routing",
      `router: ${response.routing?.router ?? ""}, model: ${response.routing?.model ?? ""}, route: ${response.routing?.route ?? ""}, reason: ${response.routing?.reason ?? ""}`
    ],
    ["state_truncated", String(response.state_truncated ?? "")],
    ["done_reason", String(response.done_reason ?? "")],
    ["created_at", String(response.created_at ?? "")],
    ["total_duration", formatDurationNs(response.total_duration)],
    ["load_duration", formatDurationNs(response.load_duration)],
    ["eval_duration", formatDurationNs(response.eval_duration)]
  ];
  const list = el("dl", "meta-list");
  for (const [key, value] of rows) {
    list.append(el("dt", void 0, key));
    list.append(el("dd", void 0, value));
  }
  block.append(list);
  return block;
}
function renderSuccess(response) {
  const frag = document.createDocumentFragment();
  const answers = el("section", "answers");
  if (response.answers) {
    for (const [name, answer] of Object.entries(response.answers)) {
      answers.append(renderAnswer(name, answer));
    }
  }
  frag.append(answers);
  frag.append(renderMetadata(response));
  return frag;
}
function prettyJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
function setRawState(region, raw) {
  region.className = "response raw";
  region.replaceChildren();
  region.append(el("pre", "answer-json", prettyJson(raw)));
}
function setEmptyState(region) {
  region.className = "response empty";
  region.replaceChildren();
  region.append(
    el(
      "p",
      "response-message",
      "Nothing has been sent yet. Fill the form and press Send."
    )
  );
}
function setLoadingState(region) {
  region.className = "response loading";
  region.replaceChildren();
  region.append(
    el("p", "response-message", "Sending.")
  );
}
function setErrorState(region, message) {
  region.className = "response error";
  region.replaceChildren();
  const title = el("p", "response-message", "Request failed");
  const detail = el("pre", "error-body", message);
  region.append(title, detail);
}
function setSuccessState(region, response) {
  region.className = "response success";
  region.replaceChildren();
  region.append(renderSuccess(response));
}

// src/history.ts
var HISTORY_KEY = "layaDecideHistory";
var HISTORY_LIMIT = 40;
function loadHistory(storage) {
  let raw;
  try {
    raw = storage.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}
function rememberRequest(storage, entry) {
  writeHistory(storage, [entry, ...loadHistory(storage)].slice(0, HISTORY_LIMIT));
}
function rememberResponse(storage, id, response) {
  writeHistory(
    storage,
    loadHistory(storage).map(
      (entry) => entry.id === id ? { ...entry, response } : entry
    )
  );
}
function writeHistory(storage, entries) {
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
  }
}
function isHistoryEntry(value) {
  if (value === null || typeof value !== "object") return false;
  const entry = value;
  return typeof entry.id === "string" && typeof entry.sentAt === "string" && typeof entry.url === "string" && isDecideBody(entry.request) && isHistoryResponse(entry.response);
}
function isDecideBody(value) {
  if (value === null || typeof value !== "object") return false;
  const body = value;
  return typeof body.model === "string" && typeof body.state === "string" && typeof body.keep_alive === "string" && body.questions !== null && typeof body.questions === "object" && !Array.isArray(body.questions);
}
function isHistoryResponse(value) {
  if (value === null || typeof value !== "object") return false;
  const response = value;
  if (response.status === "pending") return true;
  if (response.status === "failed") return typeof response.message === "string";
  if (response.status === "received") {
    return typeof response.httpStatus === "number" && typeof response.body === "string";
  }
  return false;
}

// src/schema.ts
function blankSchema(type) {
  if (type === "choice") {
    return {
      name: "",
      type: "choice",
      instructions: "",
      criteria: [{ key: "", text: "" }]
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
    falseText: ""
  };
}
function schemaFromQuestions(questions) {
  const objects = [];
  for (const [name, value] of Object.entries(questions)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const item = value;
    const instructions = typeof item.instructions === "string" ? item.instructions : "";
    if (item.type === "choice" && isRecord(item.criteria)) {
      objects.push({
        name,
        type: "choice",
        instructions,
        criteria: Object.entries(item.criteria).map(([key, text]) => ({
          key,
          text: String(text)
        }))
      });
    } else if (item.type === "score" && Array.isArray(item.criteria)) {
      objects.push({
        name,
        type: "score",
        instructions,
        criteria: item.criteria.map((entry) => String(entry))
      });
    } else if (item.type === "noul" && isRecord(item.criteria)) {
      objects.push({
        name,
        type: "noul",
        instructions,
        trueText: String(item.criteria.true ?? ""),
        falseText: String(item.criteria.false ?? "")
      });
    }
  }
  return objects;
}
function questionsFromSchema(objects) {
  const questions = {};
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) continue;
    const name = object.name.trim();
    if (!name) {
      return {
        ok: false,
        message: "Each context schema needs a name",
        fieldId: `schema-${index}-name`
      };
    }
    if (seen.has(name)) {
      return {
        ok: false,
        message: "Context schema names must be unique",
        fieldId: `schema-${index}-name`
      };
    }
    seen.add(name);
    if (object.type === "choice") {
      const criteria = {};
      for (let row = 0; row < object.criteria.length; row += 1) {
        const criterion = object.criteria[row];
        if (!criterion) continue;
        const key = criterion.key.trim();
        if (!key) {
          return {
            ok: false,
            message: "Each choice criterion needs a key",
            fieldId: `schema-${index}-key-${row}`
          };
        }
        criteria[key] = criterion.text;
      }
      questions[name] = {
        type: "choice",
        instructions: object.instructions,
        criteria
      };
    } else if (object.type === "score") {
      questions[name] = {
        type: "score",
        instructions: object.instructions,
        criteria: [...object.criteria]
      };
    } else {
      questions[name] = {
        type: "noul",
        instructions: object.instructions,
        criteria: { true: object.trueText, false: object.falseText }
      };
    }
  }
  return { ok: true, questions };
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// src/schema-editor.ts
function mountSchemaEditor(list, addButton, typeSelect, initial) {
  const objects = initial.map((object) => structuredClone(object));
  const expanded = objects.map(() => true);
  function clearError() {
    const node = document.getElementById("schema-error");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }
  function render() {
    list.replaceChildren();
    if (objects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "schema-empty";
      empty.textContent = "No context schema yet. Choose a type and press Add schema.";
      list.append(empty);
      return;
    }
    objects.forEach((object, index) => {
      list.append(renderObject(object, index, expanded[index] !== false));
    });
  }
  list.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
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
    const button = event.target?.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const index = Number(button.dataset.index);
    const object = objects[index];
    const action = button.dataset.action;
    if (!object || !action) return;
    clearError();
    if (action === "toggle-object") {
      expanded[index] = !expanded[index];
      const card = button.closest(".schema-object");
      const body = card?.querySelector(".schema-body");
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
      document.getElementById(`schema-${index}-key-${object.criteria.length - 1}`)?.focus();
      return;
    }
    if (action === "add-criterion" && object.type === "score") {
      object.criteria.push("");
      render();
      document.getElementById(`schema-${index}-level-${object.criteria.length - 1}`)?.focus();
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
    read: () => questionsFromSchema(objects)
  };
}
function renderObject(object, index, open) {
  const card = el2("fieldset", "schema-object");
  card.append(el2("legend", void 0, object.type));
  const head = el2("div", "schema-head");
  head.append(labeledField("Name", textInput(object.name, index, "name", `schema-${index}-name`)));
  const toggle = iconActionButton(
    open ? "Collapse" : "Expand",
    open ? "collapse" : "expand",
    "toggle-object",
    index
  );
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-controls", `schema-${index}-body`);
  head.append(toggle);
  head.append(iconActionButton("Remove", "remove", "remove-object", index));
  card.append(head);
  const body = el2("div", "schema-body");
  body.id = `schema-${index}-body`;
  body.hidden = !open;
  body.append(
    labeledField(
      "Instructions",
      textArea(
        object.instructions,
        index,
        "instructions",
        `schema-${index}-instructions`
      )
    )
  );
  if (object.type === "choice") body.append(choiceCriteria(object, index));
  if (object.type === "score") body.append(scoreCriteria(object, index));
  if (object.type === "noul") body.append(noulCriteria(object, index));
  card.append(body);
  return card;
}
function choiceCriteria(object, index) {
  const block = el2("div", "criteria");
  block.append(el2("p", "criteria-label", "Criteria"));
  object.criteria.forEach((criterion, row) => {
    const line = el2("div", "criterion-row");
    line.append(
      labeledField(
        "Key",
        textInput(criterion.key, index, "key", `schema-${index}-key-${row}`, row)
      )
    );
    line.append(
      labeledField(
        "Text",
        textInput(
          criterion.text,
          index,
          "text",
          `schema-${index}-text-${row}`,
          row
        )
      )
    );
    line.append(iconActionButton("Remove", "remove", "remove-criterion", index, row));
    block.append(line);
  });
  block.append(actionButton("Add criterion", "add-criterion", index, "quiet"));
  return block;
}
function scoreCriteria(object, index) {
  const block = el2("div", "criteria");
  block.append(el2("p", "criteria-label", "Levels"));
  object.criteria.forEach((level, row) => {
    const line = el2("div", "criterion-row score-row");
    line.append(
      labeledField(
        `Level ${row}`,
        textInput(level, index, "level", `schema-${index}-level-${row}`, row)
      )
    );
    line.append(iconActionButton("Remove", "remove", "remove-criterion", index, row));
    block.append(line);
  });
  block.append(actionButton("Add level", "add-criterion", index, "quiet"));
  return block;
}
function noulCriteria(object, index) {
  const block = el2("div", "criteria");
  block.append(el2("p", "criteria-label", "Criteria"));
  block.append(
    labeledField(
      "true",
      textInput(object.trueText, index, "true", `schema-${index}-true`)
    )
  );
  block.append(
    labeledField(
      "false",
      textInput(object.falseText, index, "false", `schema-${index}-false`)
    )
  );
  return block;
}
function labeledField(labelText, control) {
  const wrap = el2("div", "field");
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = labelText;
  wrap.append(label, control);
  return wrap;
}
function textInput(value, index, field, id, row) {
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.value = value;
  input.autocomplete = "off";
  input.dataset.index = String(index);
  input.dataset.field = field;
  if (row !== void 0) input.dataset.row = String(row);
  return input;
}
function textArea(value, index, field, id) {
  const area = document.createElement("textarea");
  area.id = id;
  area.rows = 3;
  area.value = value;
  area.dataset.index = String(index);
  area.dataset.field = field;
  return area;
}
function iconActionButton(label, icon, action, index, row) {
  const button = actionButton(label, action, index, "quiet icon-button", row);
  setIconButton(button, label, icon);
  return button;
}
function setIconButton(button, label, icon) {
  button.setAttribute("aria-label", label);
  button.replaceChildren(iconSvg(icon));
}
function iconSvg(icon) {
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
function actionButton(text, action, index, className, row) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.dataset.action = action;
  button.dataset.index = String(index);
  if (row !== void 0) button.dataset.row = String(row);
  return button;
}
function el2(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}

// src/main.ts
var STORAGE_KEY = "layaDecideBaseUrl";
var hasChromeStorage = typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
async function loadBaseUrl() {
  if (hasChromeStorage) {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const value = stored[STORAGE_KEY];
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
async function saveBaseUrl(value) {
  if (hasChromeStorage) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: value });
    } catch {
    }
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
  }
}
function showSchemaError(node, message) {
  if (!message) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  node.hidden = false;
  node.textContent = message;
}
function fieldError(input, message) {
  const id = `${input.id}-error`;
  let node = document.getElementById(id);
  if (!message) {
    node?.remove();
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    return;
  }
  if (!node) {
    node = document.createElement("p");
    node.id = id;
    node.className = "field-error";
    input.insertAdjacentElement("afterend", node);
  }
  node.textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", id);
}
async function init() {
  const form = document.getElementById("decide-form");
  const baseInput = document.getElementById("base-url");
  const modelInput = document.getElementById("model");
  const keepAliveInput = document.getElementById(
    "keep-alive"
  );
  const stateInput = document.getElementById("state");
  const schemaList = document.getElementById("schema-list");
  const schemaAdd = document.getElementById("schema-add");
  const schemaType = document.getElementById("schema-type");
  const schemaError = document.getElementById("schema-error");
  const submit = document.getElementById("submit");
  const requestPreview = document.getElementById(
    "request-preview"
  );
  const responseRegion = document.getElementById("response");
  const rawToggle = document.getElementById("raw-toggle");
  const historyToggle = document.getElementById("history-toggle");
  const historyPanel = document.getElementById("history-panel");
  const historyList = document.getElementById("history-list");
  const historyDetail = document.getElementById("history-detail");
  const historyCurrent = document.getElementById("history-current");
  const livePanel = document.getElementById("live-panel");
  const requestTab = document.getElementById("tab-request");
  const schemaTab = document.getElementById("tab-schema");
  const tabs = [requestTab, schemaTab];
  let showingRaw = false;
  let historyOpen = false;
  let selectedHistoryId = null;
  let lastRaw = "";
  let lastResponse = null;
  function selectTab(next, focus = false) {
    for (const tab of tabs) {
      const selected = tab === next;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
      const panelId = tab.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) panel.hidden = !selected;
    }
    if (focus) next.focus();
  }
  function hideRawToggle() {
    showingRaw = false;
    lastResponse = null;
    lastRaw = "";
    rawToggle.hidden = true;
    rawToggle.setAttribute("aria-pressed", "false");
    rawToggle.textContent = "Raw JSON";
  }
  function paintAnswer() {
    if (!lastResponse) return;
    rawToggle.hidden = false;
    rawToggle.setAttribute("aria-pressed", showingRaw ? "true" : "false");
    rawToggle.textContent = showingRaw ? "Formatted" : "Raw JSON";
    if (showingRaw) setRawState(responseRegion, lastRaw);
    else setSuccessState(responseRegion, lastResponse);
  }
  document.querySelector(".tablist")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.getAttribute("role") !== "tab") {
      return;
    }
    selectTab(target, true);
  });
  document.querySelector(".tablist")?.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    const current = document.activeElement;
    const index = tabs.indexOf(current);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next];
    if (tab) selectTab(tab, true);
  });
  rawToggle.addEventListener("click", () => {
    if (!lastResponse) return;
    showingRaw = !showingRaw;
    paintAnswer();
  });
  function paintHistory() {
    const entries = loadHistory(sessionStorage);
    const selected = selectedHistoryId ? entries.find((entry) => entry.id === selectedHistoryId) : void 0;
    if (selectedHistoryId && !selected) selectedHistoryId = null;
    if (!selected) {
      historyDetail.hidden = true;
      historyDetail.replaceChildren();
      historyList.hidden = false;
      historyList.replaceChildren();
      if (entries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "No requests in this session yet.";
        historyList.append(empty);
        return;
      }
      for (const entry of entries) historyList.append(renderHistoryPick(entry));
      return;
    }
    historyList.hidden = true;
    historyDetail.hidden = false;
    historyDetail.replaceChildren(renderHistoryDetail(selected));
  }
  function setHistoryOpen(open) {
    historyOpen = open;
    if (open) selectedHistoryId = null;
    historyPanel.hidden = !open;
    livePanel.hidden = open;
    historyToggle.setAttribute("aria-pressed", open ? "true" : "false");
    if (open) paintHistory();
  }
  historyToggle.addEventListener("click", () => {
    setHistoryOpen(true);
  });
  historyCurrent.addEventListener("click", () => {
    setHistoryOpen(false);
    historyCurrent.blur();
  });
  historyList.addEventListener("click", (event) => {
    const target = event.target;
    const button = target instanceof HTMLElement ? target.closest("button.history-pick") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const id = button.dataset.id;
    if (!id) return;
    selectedHistoryId = id;
    paintHistory();
    historyDetail.querySelector("button")?.focus();
  });
  historyDetail.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest("[data-history-back]")) return;
    selectedHistoryId = null;
    paintHistory();
    const first = historyList.querySelector("button");
    if (first instanceof HTMLButtonElement) first.focus();
  });
  modelInput.value = DEFAULT_MODEL;
  keepAliveInput.value = DEFAULT_KEEP_ALIVE;
  stateInput.value = DEFAULT_STATE;
  const schema = mountSchemaEditor(
    schemaList,
    schemaAdd,
    schemaType,
    schemaFromQuestions(DEFAULT_QUESTIONS)
  );
  const saved = await loadBaseUrl();
  baseInput.value = saved ?? DEFAULT_BASE_URL;
  setEmptyState(responseRegion);
  hideRawToggle();
  function paintRequest() {
    const baseResult = validateBaseUrl(baseInput.value);
    const questionsResult = schema.read();
    const urlLine = baseResult.ok ? `POST ${baseResult.url}` : baseResult.message;
    const header = `${urlLine}
Content-Type: application/json

`;
    if (!questionsResult.ok) {
      requestPreview.value = header + questionsResult.message;
      return;
    }
    const body = buildDecideBody({
      model: modelInput.value,
      state: stateInput.value,
      questions: questionsResult.questions,
      keep_alive: keepAliveInput.value
    });
    requestPreview.value = header + JSON.stringify(body, null, 2);
  }
  paintRequest();
  form.addEventListener("input", paintRequest);
  form.addEventListener("click", paintRequest);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      fieldError(baseInput, null);
      showSchemaError(schemaError, null);
      const baseResult = validateBaseUrl(baseInput.value);
      if (!baseResult.ok) {
        selectTab(requestTab);
        fieldError(baseInput, baseResult.message);
        baseInput.focus();
        return;
      }
      const questionsResult = schema.read();
      if (!questionsResult.ok) {
        selectTab(schemaTab);
        showSchemaError(schemaError, questionsResult.message);
        document.getElementById(questionsResult.fieldId)?.focus();
        return;
      }
      await saveBaseUrl(baseInput.value.trim());
      const body = buildDecideBody({
        model: modelInput.value,
        state: stateInput.value,
        questions: questionsResult.questions,
        keep_alive: keepAliveInput.value
      });
      hideRawToggle();
      setLoadingState(responseRegion);
      const historyId = createHistoryId();
      rememberRequest(sessionStorage, {
        id: historyId,
        sentAt: (/* @__PURE__ */ new Date()).toISOString(),
        url: baseResult.url,
        request: body,
        response: { status: "pending" }
      });
      if (historyOpen) paintHistory();
      try {
        const res = await fetch(baseResult.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const text = await res.text();
        rememberResponse(sessionStorage, historyId, {
          status: "received",
          httpStatus: res.status,
          body: text
        });
        if (historyOpen) paintHistory();
        if (!res.ok) {
          setErrorState(responseRegion, `HTTP ${res.status}
${text}`);
          return;
        }
        try {
          lastResponse = parseDecideResponse(text);
          lastRaw = text;
          showingRaw = false;
          paintAnswer();
        } catch {
          setErrorState(responseRegion, text);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rememberResponse(sessionStorage, historyId, {
          status: "failed",
          message
        });
        if (historyOpen) paintHistory();
        setErrorState(responseRegion, message);
      }
    } finally {
      submit.disabled = false;
    }
  });
}
function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function historyLabel(entry) {
  const sent = new Date(entry.sentAt);
  const clock = Number.isNaN(sent.getTime()) ? entry.sentAt : sent.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return `${clock} \xB7 ${entry.request.model}`;
}
function renderHistoryPick(entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "history-pick";
  button.dataset.id = entry.id;
  const title = document.createElement("span");
  title.className = "history-pick-title";
  title.textContent = historyLabel(entry);
  const excerpt = document.createElement("span");
  excerpt.className = "history-excerpt";
  excerpt.textContent = entry.request.state;
  button.append(title, excerpt);
  return button;
}
function renderHistoryDetail(entry) {
  const item = document.createElement("article");
  item.className = "history-item";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "quiet history-detail-back";
  back.dataset.historyBack = "true";
  back.textContent = "Back to list";
  item.append(back);
  const title = document.createElement("h3");
  title.textContent = historyLabel(entry);
  item.append(title);
  item.append(historyBlock("Request", formatHistoryRequest(entry)));
  item.append(historyBlock("Response", formatHistoryResponse(entry)));
  return item;
}
function historyBlock(label, text) {
  const block = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = label;
  const pre = document.createElement("pre");
  pre.className = "answer-json";
  pre.textContent = text;
  block.append(heading, pre);
  return block;
}
function formatHistoryRequest(entry) {
  return `POST ${entry.url}
Content-Type: application/json

${JSON.stringify(entry.request, null, 2)}`;
}
function formatHistoryResponse(entry) {
  const response = entry.response;
  if (response.status === "pending") return "Waiting for the response.";
  if (response.status === "failed") return response.message;
  try {
    return `HTTP ${response.httpStatus}

${JSON.stringify(JSON.parse(response.body), null, 2)}`;
  } catch {
    return `HTTP ${response.httpStatus}

${response.body}`;
  }
}
void init();
