import {
  DEFAULT_BASE_URL,
  DEFAULT_KEEP_ALIVE,
  DEFAULT_MODEL,
  DEFAULT_QUESTIONS,
  DEFAULT_STATE,
  buildDecideBody,
  parseDecideResponse,
  parseQuestionsJson,
  validateBaseUrl,
} from "./decide";
import {
  setEmptyState,
  setErrorState,
  setLoadingState,
  setSuccessState,
} from "./render";

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
  const questionsInput = document.getElementById(
    "questions",
  ) as HTMLTextAreaElement;
  const submit = document.getElementById("submit") as HTMLButtonElement;
  const responseRegion = document.getElementById("response") as HTMLElement;

  modelInput.value = DEFAULT_MODEL;
  keepAliveInput.value = DEFAULT_KEEP_ALIVE;
  stateInput.value = DEFAULT_STATE;
  questionsInput.value = JSON.stringify(DEFAULT_QUESTIONS, null, 2);

  const saved = await loadBaseUrl();
  baseInput.value = saved ?? DEFAULT_BASE_URL;

  setEmptyState(responseRegion);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;

    try {
      fieldError(baseInput, null);
      fieldError(questionsInput, null);

      const baseResult = validateBaseUrl(baseInput.value);
      if (!baseResult.ok) {
        fieldError(baseInput, baseResult.message);
        baseInput.focus();
        return;
      }

      const questionsResult = parseQuestionsJson(questionsInput.value);
      if (!questionsResult.ok) {
        fieldError(questionsInput, questionsResult.message);
        questionsInput.focus();
        return;
      }

      await saveBaseUrl(baseInput.value.trim());

      const body = buildDecideBody({
        model: modelInput.value,
        state: stateInput.value,
        questions: questionsResult.questions,
        keep_alive: keepAliveInput.value,
      });

      setLoadingState(responseRegion);

      try {
        const res = await fetch(baseResult.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) {
          setErrorState(responseRegion, `HTTP ${res.status}\n${text}`);
          return;
        }
        try {
          const parsed = parseDecideResponse(text);
          setSuccessState(responseRegion, parsed);
        } catch {
          setErrorState(responseRegion, text);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(responseRegion, message);
      }
    } finally {
      submit.disabled = false;
    }
  });
}

void init();
