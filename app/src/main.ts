import {
  DEFAULT_BASE_URL,
  DEFAULT_KEEP_ALIVE,
  DEFAULT_MODEL,
  DEFAULT_QUESTIONS,
  DEFAULT_STATE,
  type DecideResponse,
  buildDecideBody,
  parseDecideResponse,
  validateBaseUrl,
} from "./decide";
import {
  setEmptyState,
  setErrorState,
  setLoadingState,
  setRawState,
  setSuccessState,
} from "./render";
import {
  type HistoryEntry,
  loadHistory,
  rememberRequest,
  rememberResponse,
} from "./history";
import { mountSchemaEditor } from "./schema-editor";
import { schemaFromQuestions } from "./schema";

const STORAGE_KEY = "layaDecideBaseUrl";

const hasChromeStorage =
  typeof chrome !== "undefined" &&
  !!chrome.storage &&
  !!chrome.storage.local;

async function loadBaseUrl(): Promise<string | null> {
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

async function saveBaseUrl(value: string): Promise<void> {
  if (hasChromeStorage) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: value });
    } catch {
      // Storage can reject. The request still sends.
    }
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Page may block storage; form still works for the session.
  }
}

function showSchemaError(node: HTMLElement, message: string | null): void {
  if (!message) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  node.hidden = false;
  node.textContent = message;
}

function fieldError(input: HTMLElement, message: string | null): void {
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

async function init(): Promise<void> {
  const form = document.getElementById("decide-form") as HTMLFormElement;
  const baseInput = document.getElementById("base-url") as HTMLInputElement;
  const modelInput = document.getElementById("model") as HTMLInputElement;
  const keepAliveInput = document.getElementById(
    "keep-alive",
  ) as HTMLInputElement;
  const stateInput = document.getElementById("state") as HTMLTextAreaElement;
  const schemaList = document.getElementById("schema-list") as HTMLElement;
  const schemaAdd = document.getElementById("schema-add") as HTMLButtonElement;
  const schemaType = document.getElementById("schema-type") as HTMLSelectElement;
  const schemaError = document.getElementById("schema-error") as HTMLElement;
  const submit = document.getElementById("submit") as HTMLButtonElement;
  const requestPreview = document.getElementById(
    "request-preview",
  ) as HTMLTextAreaElement;
  const responseRegion = document.getElementById("response") as HTMLElement;
  const rawToggle = document.getElementById("raw-toggle") as HTMLButtonElement;
  const historyToggle = document.getElementById("history-toggle") as HTMLButtonElement;
  const historyPanel = document.getElementById("history-panel") as HTMLElement;
  const historyList = document.getElementById("history-list") as HTMLElement;
  const historyDetail = document.getElementById("history-detail") as HTMLElement;
  const historyCurrent = document.getElementById("history-current") as HTMLButtonElement;
  const livePanel = document.getElementById("live-panel") as HTMLElement;
  const requestTab = document.getElementById("tab-request") as HTMLButtonElement;
  const schemaTab = document.getElementById("tab-schema") as HTMLButtonElement;
  const tabs = [requestTab, schemaTab];
  let showingRaw = false;
  let historyOpen = false;
  let selectedHistoryId: string | null = null;
  let lastRaw = "";
  let lastResponse: DecideResponse | null = null;

  function selectTab(next: HTMLButtonElement, focus = false): void {
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

  function hideRawToggle(): void {
    showingRaw = false;
    lastResponse = null;
    lastRaw = "";
    rawToggle.hidden = true;
    rawToggle.setAttribute("aria-pressed", "false");
    rawToggle.textContent = "Raw JSON";
  }

  function paintAnswer(): void {
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
    const index = tabs.indexOf(current as HTMLButtonElement);
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

  function paintHistory(): void {
    const entries = loadHistory(sessionStorage);
    const selected = selectedHistoryId
      ? entries.find((entry) => entry.id === selectedHistoryId)
      : undefined;
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

  function setHistoryOpen(open: boolean): void {
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
    const button =
      target instanceof HTMLElement ? target.closest("button.history-pick") : null;
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
    schemaFromQuestions(DEFAULT_QUESTIONS),
  );

  const saved = await loadBaseUrl();
  baseInput.value = saved ?? DEFAULT_BASE_URL;

  setEmptyState(responseRegion);
  hideRawToggle();

  function paintRequest(): void {
    const baseResult = validateBaseUrl(baseInput.value);
    const questionsResult = schema.read();
    const urlLine = baseResult.ok
      ? `POST ${baseResult.url}`
      : baseResult.message;
    const header = `${urlLine}\nContent-Type: application/json\n\n`;
    if (!questionsResult.ok) {
      requestPreview.value = header + questionsResult.message;
      return;
    }
    const body = buildDecideBody({
      model: modelInput.value,
      state: stateInput.value,
      questions: questionsResult.questions,
      keep_alive: keepAliveInput.value,
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
        keep_alive: keepAliveInput.value,
      });

      hideRawToggle();
      setLoadingState(responseRegion);

      const historyId = createHistoryId();
      rememberRequest(sessionStorage, {
        id: historyId,
        sentAt: new Date().toISOString(),
        url: baseResult.url,
        request: body,
        response: { status: "pending" },
      });
      if (historyOpen) paintHistory();

      try {
        const res = await fetch(baseResult.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        rememberResponse(sessionStorage, historyId, {
          status: "received",
          httpStatus: res.status,
          body: text,
        });
        if (historyOpen) paintHistory();
        if (!res.ok) {
          setErrorState(responseRegion, `HTTP ${res.status}\n${text}`);
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
          message,
        });
        if (historyOpen) paintHistory();
        setErrorState(responseRegion, message);
      }
    } finally {
      submit.disabled = false;
    }
  });
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function historyLabel(entry: HistoryEntry): string {
  const sent = new Date(entry.sentAt);
  const clock = Number.isNaN(sent.getTime())
    ? entry.sentAt
    : sent.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  return `${clock} · ${entry.request.model}`;
}

function renderHistoryPick(entry: HistoryEntry): HTMLButtonElement {
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

function renderHistoryDetail(entry: HistoryEntry): HTMLElement {
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

function historyBlock(label: string, text: string): HTMLElement {
  const block = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = label;
  const pre = document.createElement("pre");
  pre.className = "answer-json";
  pre.textContent = text;
  block.append(heading, pre);
  return block;
}

function formatHistoryRequest(entry: HistoryEntry): string {
  return `POST ${entry.url}\nContent-Type: application/json\n\n${JSON.stringify(entry.request, null, 2)}`;
}

function formatHistoryResponse(entry: HistoryEntry): string {
  const response = entry.response;
  if (response.status === "pending") return "Waiting for the response.";
  if (response.status === "failed") return response.message;
  try {
    return `HTTP ${response.httpStatus}\n\n${JSON.stringify(JSON.parse(response.body), null, 2)}`;
  } catch {
    return `HTTP ${response.httpStatus}\n\n${response.body}`;
  }
}

void init();
