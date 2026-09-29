import {
  type DecideAnswer,
  type DecideResponse,
  formatDurationNs,
  isChoiceAnswer,
  isNoulAnswer,
  isScoreAnswer,
} from "./decide";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function highestKey(probs: Record<string, number>): string | null {
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const [key, value] of Object.entries(probs)) {
    if (value > bestVal) {
      bestVal = value;
      best = key;
    }
  }
  return best;
}

function renderProbabilities(
  probs: Record<string, number>,
): HTMLElement {
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

function renderChoice(name: string, answer: DecideAnswer): HTMLElement {
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

function renderScore(name: string, answer: DecideAnswer): HTMLElement {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  if (!isScoreAnswer(answer)) return card;
  const score = el("p", "answer-chosen accent-text");
  score.textContent = `score: ${answer.score}`;
  card.append(score);
  card.append(el("p", "answer-meta", `confidence: ${answer.confidence}`));
  const legend = el("dl", "legend");
  for (const [key, label] of Object.entries(answer.legend)) {
    legend.append(el("dt", undefined, key));
    legend.append(el("dd", undefined, label));
  }
  card.append(legend);
  card.append(renderProbabilities(answer.probabilities));
  return card;
}

function renderNoul(name: string, answer: DecideAnswer): HTMLElement {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  if (!isNoulAnswer(answer)) return card;
  card.append(el("p", "answer-chosen", `noul: ${answer.noul}`));
  return card;
}

function renderUnknown(name: string, answer: DecideAnswer): HTMLElement {
  const card = el("article", "answer");
  card.append(el("h3", "answer-name", name));
  const pre = el("pre", "answer-json");
  pre.textContent = JSON.stringify(answer, null, 2);
  card.append(pre);
  return card;
}

export function renderAnswer(name: string, answer: unknown): HTMLElement {
  if (isChoiceAnswer(answer)) return renderChoice(name, answer);
  if (isScoreAnswer(answer)) return renderScore(name, answer);
  if (isNoulAnswer(answer)) return renderNoul(name, answer);
  const payload =
    answer !== null && typeof answer === "object"
      ? answer
      : { type: "unknown", value: answer };
  return renderUnknown(name, payload as DecideAnswer);
}

export function renderMetadata(response: DecideResponse): HTMLElement {
  const block = el("section", "meta");
  block.append(el("h3", undefined, "Response metadata"));

  const rows: Array<[string, string]> = [
    ["model", String(response.model ?? "")],
    [
      "usage",
      `input_tokens: ${response.usage?.input_tokens ?? ""}, output_tokens: ${response.usage?.output_tokens ?? ""}`,
    ],
    [
      "routing",
      `router: ${response.routing?.router ?? ""}, model: ${response.routing?.model ?? ""}, route: ${response.routing?.route ?? ""}, reason: ${response.routing?.reason ?? ""}`,
    ],
    ["state_truncated", String(response.state_truncated ?? "")],
    ["done_reason", String(response.done_reason ?? "")],
    ["created_at", String(response.created_at ?? "")],
    ["total_duration", formatDurationNs(response.total_duration)],
    ["load_duration", formatDurationNs(response.load_duration)],
    ["eval_duration", formatDurationNs(response.eval_duration)],
  ];

  const list = el("dl", "meta-list");
  for (const [key, value] of rows) {
    list.append(el("dt", undefined, key));
    list.append(el("dd", undefined, value));
  }
  block.append(list);
  return block;
}

export function renderSuccess(response: DecideResponse): DocumentFragment {
  const frag = document.createDocumentFragment();
  const answers = el("section", "answers");
  answers.append(el("h2", undefined, "Answers"));
  if (response.answers) {
    for (const [name, answer] of Object.entries(response.answers)) {
      answers.append(renderAnswer(name, answer));
    }
  }
  frag.append(answers);
  frag.append(renderMetadata(response));
  return frag;
}

export function setEmptyState(region: HTMLElement): void {
  region.className = "response empty";
  region.replaceChildren();
  region.append(
    el(
      "p",
      "response-message",
      "Nothing has been sent yet. Fill the form and press Send decide.",
    ),
  );
}

export function setLoadingState(region: HTMLElement): void {
  region.className = "response loading";
  region.replaceChildren();
  region.append(
    el("p", "response-message", "Sending decide request…"),
  );
}

export function setErrorState(region: HTMLElement, message: string): void {
  region.className = "response error";
  region.replaceChildren();
  const title = el("p", "response-message", "Request failed");
  const detail = el("pre", "error-body", message);
  region.append(title, detail);
}

export function setSuccessState(
  region: HTMLElement,
  response: DecideResponse,
): void {
  region.className = "response success";
  region.replaceChildren();
  region.append(renderSuccess(response));
}
