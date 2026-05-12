const INTERNAL_ROUTE_PATTERN =
  /\/api\/(?:creator|chat|trends\/(?:search|list|detailed))(?:\?[^\s),.;]+)?/gi;
const INTERNAL_SERVICE_PATTERN =
  /https:\/\/api\.(?:exa\.ai\/search|openai\.com\/v1\/responses)/gi;
const INTERNAL_WORKFLOW_PATTERN =
  /\b(?:api route|api endpoint|endpoint|request format|environment variable|model name|json schema)\b/i;

export function sanitizeChatResponse(response) {
  return {
    ...response,
    answer: sanitizeAssistantText(response?.answer),
    unsupported: Array.isArray(response?.unsupported)
      ? response.unsupported.map(sanitizeAssistantText).filter(Boolean)
      : []
  };
}

export function sanitizeAssistantText(value) {
  const text = cleanString(value);
  if (!text) {
    return "";
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sanitizeSentence(sentence))
    .join(" ")
    .replace(INTERNAL_ROUTE_PATTERN, "the app scan")
    .replace(INTERNAL_SERVICE_PATTERN, "the app")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeSentence(sentence) {
  if (!hasInternalReference(sentence)) {
    return sentence;
  }

  const prefix = sentence.match(/^(\d+[.)]\s*)/)?.[1] ?? "";
  const isSearchAdvice = /search|query|find|scan|endpoint/i.test(sentence);

  if (isSearchAdvice) {
    return `${prefix}Run another scan in the app for current, source-backed signals, then build guidance only from the verified items.`;
  }

  return `${prefix}Use the app evidence and clickable source links for this step.`;
}

function hasInternalReference(value) {
  INTERNAL_ROUTE_PATTERN.lastIndex = 0;
  INTERNAL_SERVICE_PATTERN.lastIndex = 0;
  return (
    INTERNAL_ROUTE_PATTERN.test(value) ||
    INTERNAL_SERVICE_PATTERN.test(value) ||
    INTERNAL_WORKFLOW_PATTERN.test(value)
  );
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
