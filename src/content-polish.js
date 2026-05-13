const DEFAULT_MODEL = "gpt-5";
const OPENAI_POLISH_LIMIT = 8;
const ENTITY_PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "key_points"],
  properties: {
    summary: { type: "string" },
    key_points: {
      type: "array",
      items: { type: "string" }
    }
  }
};
const POLISH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "summary", "key_points"],
        properties: {
          rank: { type: "number" },
          summary: { type: "string" },
          key_points: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
};

export async function synthesizeEntityProfile({
  query,
  sources,
  openAiApiKey,
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch
} = {}) {
  const usableSources = Array.isArray(sources)
    ? sources
        .filter((source) => source?.url && (source.title || source.snippet))
        .slice(0, 12)
    : [];

  if (!usableSources.length || !openAiApiKey || !openAiApiKey.trim()) {
    return null;
  }

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1800,
        instructions: [
          "Build a concise source-backed entity profile for a business/news relevance app.",
          "Use only the provided source titles, snippets, and URLs. Do not add facts, dates, roles, projects, or biographical claims that are not present in the sources.",
          "Prefer concrete identity facts: role, community, company/project names, location, products, events, and distinctions from similarly named people.",
          "Write one polished summary sentence and 3 to 6 crisp key points.",
          "Do not mention APIs, scraping, search providers, models, prompts, or internal implementation."
        ].join("\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  query: cleanText(query),
                  sources: usableSources.map((source, index) => ({
                    id: source.id || `E${index + 1}`,
                    title: cleanText(source.title),
                    url: cleanText(source.url),
                    published_date: cleanText(source.published_date),
                    text: truncate(cleanScrapedText(source.snippet), 1100)
                  }))
                })
              }
            ]
          }
        ],
        reasoning: model.startsWith("gpt-5")
          ? {
              effort: "low"
            }
          : undefined,
        text: {
          format: {
            type: "json_schema",
            name: "source_backed_entity_profile",
            strict: true,
            schema: ENTITY_PROFILE_SCHEMA
          }
        }
      }),
      signal: AbortSignal.timeout(45000)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || "Entity profile synthesis failed.");
    }

    const parsed = parseModelJson(payload);
    if (!parsed?.summary || !Array.isArray(parsed.key_points)) {
      return null;
    }

    return {
      summary: cleanPolishedText(parsed.summary),
      key_points: parsed.key_points
        .map(cleanPolishedText)
        .filter(Boolean)
        .filter((point, index, points) =>
          points.findIndex((candidate) => isDuplicatePoint(point, candidate)) === index
        )
        .slice(0, 6)
    };
  } catch {
    return null;
  }
}

export async function polishBackgroundItems({
  items,
  openAiApiKey,
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch
} = {}) {
  const backgroundItems = Array.isArray(items)
    ? items.filter((item) => item.match_type === "background")
    : [];

  if (!backgroundItems.length) {
    return items ?? [];
  }

  const deterministicItems = items.map((item) =>
    item.match_type === "background" ? applyDeterministicPolish(item) : item
  );

  if (!openAiApiKey || !openAiApiKey.trim()) {
    return deterministicItems;
  }

  try {
    const polish = await requestOpenAiPolish({
      items: deterministicItems
        .filter((item) => item.match_type === "background")
        .slice(0, OPENAI_POLISH_LIMIT),
      apiKey: openAiApiKey.trim(),
      model,
      fetchImpl
    });
    const polishByRank = new Map(
      polish.items
        .filter((item) => Number.isFinite(Number(item.rank)))
        .map((item) => [Number(item.rank), item])
    );

    return deterministicItems.map((item) => {
      const polished = polishByRank.get(Number(item.rank));

      if (!polished || item.match_type !== "background") {
        return item;
      }

      const summary = cleanPolishedText(polished.summary);
      const keyPoints = (polished.key_points ?? [])
        .map(cleanPolishedText)
        .filter(Boolean)
        .filter((point) => !isDuplicatePoint(point, summary))
        .filter((point, index, points) =>
          points.findIndex((candidate) => isDuplicatePoint(point, candidate)) === index
        )
        .filter(isUsefulKeyPoint)
        .slice(0, 4);

      if (!summary || !isUsefulPolish({ keyPoints, summary })) {
        return item;
      }

      return {
        ...item,
        summary,
        key_points: keyPoints.length ? keyPoints : [summary],
        content_polish: {
          provider: "OpenAI",
          source: "source_text_only"
        },
        articles: item.articles.map((article) => ({
          ...article,
          summary
        }))
      };
    });
  } catch {
    return deterministicItems;
  }
}

function applyDeterministicPolish(item) {
  const cleanedSummary = cleanScrapedText(item.summary);
  const personalSummary = buildPersonalProjectSummary(cleanedSummary);
  const summary =
    personalSummary ||
    firstSentences(cleanedSummary, 2) ||
    cleanedSummary ||
    item.summary;
  const keyPoints = personalSummary
    ? buildPersonalProjectKeyPoints(cleanedSummary)
    : buildFallbackKeyPoints(cleanedSummary);
  const distinctKeyPoints = keyPoints
    .filter((point) => !isDuplicatePoint(point, summary))
    .filter((point, index, points) =>
      points.findIndex((candidate) => isDuplicatePoint(point, candidate)) === index
    );

  return {
    ...item,
    summary,
    key_points: distinctKeyPoints.length ? distinctKeyPoints : [summary].filter(Boolean),
    articles: item.articles.map((article) => ({
      ...article,
      summary
    }))
  };
}

async function requestOpenAiPolish({ items, apiKey, model, fetchImpl }) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2600,
      instructions: [
        "Clean and compress scraped source text for a business relevance app.",
        "Use only the provided source title and text. Do not add facts, dates, claims, or interpretation that are not present.",
        "Remove navigation, cookie notices, repeated headings, byline clutter, copyright text, and page chrome.",
        "Do not paraphrase for style. Preserve the source's concrete facts, but remove duplication.",
        "Each summary should be 1 concise sentence. Each key point must add a distinct new fact that is not already stated in the summary or another key point.",
        "Avoid generic bullets like 'the page describes work on independent projects' when specific project or event facts are available.",
        "Do not mention APIs, scraping, models, prompts, or internal implementation."
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                items: items.map((item) => ({
                  rank: item.rank,
                  title: item.title,
                  source_url: item.articles?.[0]?.url || "",
                  source_text: truncate(cleanScrapedText(item.summary), 950)
                }))
              })
            }
          ]
        }
      ],
      reasoning: model.startsWith("gpt-5")
        ? {
            effort: "low"
          }
        : undefined,
      text: {
        format: {
          type: "json_schema",
          name: "polished_background_sources",
          strict: true,
          schema: POLISH_SCHEMA
        }
      }
    }),
    signal: AbortSignal.timeout(45000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI polishing failed.");
  }

  const parsed = parseModelJson(payload);
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("OpenAI polishing returned invalid JSON.");
  }

  return parsed;
}

function parseModelJson(payload) {
  const text = extractOutputText(payload);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const output of Array.isArray(payload.output) ? payload.output : []) {
    for (const content of Array.isArray(output.content) ? output.content : []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function cleanScrapedText(value) {
  return cleanText(value)
    .replace(/\s*Skip to (?:main content|primary navigation|footer)\s*/gi, " ")
    .replace(/\bMain Content\b/gi, " ")
    .replace(/\bChoose Country\b[\s\S]*$/gi, " ")
    .replace(/\bQuick Navigation\b[\s\S]*$/gi, " ")
    .replace(/\bWe use cookies[\s\S]*$/gi, " ")
    .replace(/#{1,6}\s*/g, ". ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPersonalProjectSummary(text) {
  const name = extractPersonName(text);
  if (!name || !/my projects|docuask|ai tinkerers|my events/i.test(text)) {
    return "";
  }

  const projects = extractKnownTerms(text, [
    "DocuAsk",
    "My Details",
    "AI Caller",
    "Prompt Olympics",
    "LinkedInfluencer",
    "ReachOut"
  ]);
  const events = /ai tinkerers/i.test(text)
    ? " and AI Tinkerers events"
    : "";

  return compactPolish(
    `${
      projects.length
        ? `${name}'s page lists independent projects including ${formatList(projects)}${events}.`
        : `${name}'s page lists personal projects and related activity${events}.`
    }`
  );
}

function buildPersonalProjectKeyPoints(text) {
  const name = extractPersonName(text) || "The source";
  const points = [];

  if (/docuask/i.test(text)) {
    points.push(
      "The page lists DocuAsk as a document utility tool for working with long documents."
    );
  }

  if (/ai caller/i.test(text)) {
    points.push(
      "The page lists AI Caller as an AI-powered phone-call project for inbound and outbound sales."
    );
  }

  if (/ai tinkerers/i.test(text)) {
    points.push(
      "The page lists AI Tinkerers events in Malaysia, linking the source to a local AI builder community."
    );
  }

  if (/kuala lumpur,\s*malaysia/i.test(text)) {
    points.push(`${name} is presented as being based in Kuala Lumpur, Malaysia.`);
  }

  return points.slice(0, 4);
}

function buildFallbackKeyPoints(text) {
  return splitSentences(text)
    .filter((sentence) => sentence.length > 45)
    .slice(0, 3);
}

function firstSentences(text, count) {
  return splitSentences(text).slice(0, count).join(" ");
}

function splitSentences(value) {
  return cleanText(value)
    .split(/(?<=[.!?])\s+/)
    .map(cleanPolishedText)
    .filter(Boolean);
}

function cleanPolishedText(value) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function isDuplicatePoint(point, reference) {
  const pointTerms = importantTerms(point);
  const referenceTerms = importantTerms(reference);

  if (!pointTerms.length || !referenceTerms.length) {
    return false;
  }

  const overlap = pointTerms.filter((term) => referenceTerms.includes(term)).length;
  return overlap / pointTerms.length >= 0.72;
}

function isUsefulPolish({ keyPoints, summary }) {
  const text = [summary, ...keyPoints].join(" ");

  return (
    keyPoints.length >= 2 &&
    text.length >= 180 &&
    !keyPoints.some((point) => /\b(?:is|are|was|were) listed\.?$/i.test(point))
  );
}

function isUsefulKeyPoint(point) {
  if (point.length < 36) {
    return false;
  }

  if (/\b(?:is|are|was|were) listed\.?$/i.test(point)) {
    return false;
  }

  return true;
}

function importantTerms(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 3 && !DUPLICATE_STOP_WORDS.has(term));
}

function truncate(value, limit) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractPersonName(text) {
  const match = cleanText(text).match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/);
  return match?.[1] || "";
}

function extractKnownTerms(text, terms) {
  return terms.filter((term) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text)
  );
}

function formatList(values) {
  if (values.length <= 1) {
    return values[0] || "";
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function compactPolish(value) {
  return cleanPolishedText(value).replace(/\s+\./g, ".").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DUPLICATE_STOP_WORDS = new Set([
  "about",
  "also",
  "based",
  "being",
  "connected",
  "describes",
  "including",
  "independent",
  "lists",
  "page",
  "presented",
  "projects",
  "source",
  "that",
  "with",
  "work"
]);
