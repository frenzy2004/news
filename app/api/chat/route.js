import { NextResponse } from "next/server";
import {
  attachCareSignalScan,
  buildChatEvidencePack,
  cleanChatMessages
} from "../../../src/evidence-pack.js";
import { buildAdjacentSignals } from "../../../src/adjacent-signals.js";
import { sanitizeAssistantText } from "../../../src/chat-sanitize.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-5";
const EMPTY_OUTPUT_MARKER = "Model response was empty.";

const CHAT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "citations", "snippets", "unsupported"],
  properties: {
    answer: {
      type: "string",
      description:
        "A concise, source-grounded answer. Cite source IDs inline like [S1]."
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "url", "timestamp"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          timestamp: { type: "string" }
        }
      }
    },
    snippets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_id", "text"],
        properties: {
          source_id: { type: "string" },
          text: { type: "string" }
        }
      }
    },
    unsupported: {
      type: "array",
      description:
        "Questions or claims that cannot be answered from the provided evidence.",
      items: { type: "string" }
    }
  }
};

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is missing on the server. Add a fresh rotated key before using evidence chat."
      },
      { status: 500 }
    );
  }

  const messages = cleanChatMessages(body.messages);
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (!latestUserMessage) {
    return NextResponse.json(
      { error: "Ask a question before opening the evidence chat." },
      { status: 400 }
    );
  }

  let evidencePack = buildChatEvidencePack({
    report: body.report,
    selectedStoryId: body.selectedStoryId
  });
  evidencePack = await attachFreshCareSignals(evidencePack);

  if (evidencePack.stories.length === 0 && evidencePack.sources.length === 0) {
    return NextResponse.json(
      {
        answer:
          "I do not have source evidence yet. Run a BTW scan first, then I can answer from the returned stories and article links.",
        citations: [],
        snippets: [],
        unsupported: [latestUserMessage]
      },
      { status: 200 }
    );
  }

  try {
    const chatResponse = await createGroundedResponse({
      apiKey: apiKey.trim(),
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      messages,
      evidencePack
    });

    return NextResponse.json({
      ...chatResponse,
      evidence: {
        source_count: evidencePack.source_count,
        selected_story_id: evidencePack.selected_story_id,
        selected_story_title: evidencePack.selected_story_title
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not answer from the evidence pack." },
      { status: error.status || 500 }
    );
  }
}

async function attachFreshCareSignals(evidencePack) {
  const scanQuery = evidencePack.care_graph?.signal_queries?.[0];
  const apiKey = process.env.BTW_API_KEY;

  if (!scanQuery || !apiKey?.trim()) {
    return evidencePack;
  }

  try {
    const scanResult = await buildAdjacentSignals({
      apiKey: apiKey.trim(),
      exaApiKey: process.env.EXA_API_KEY,
      profile: buildCareScanProfile(evidencePack),
      query: scanQuery,
      dateRange: evidencePack.date_range === "Week" ? "Week" : "Now",
      maxArticles: 12,
      openAiApiKey: "",
      openAiModel: process.env.OPENAI_MODEL || DEFAULT_MODEL
    });

    return attachCareSignalScan({
      evidencePack,
      scanResult,
      scanQuery
    });
  } catch (error) {
    return {
      ...evidencePack,
      fresh_signal_scan: {
        query: cleanString(scanQuery),
        status: "scan_failed",
        error: sanitizeAssistantText(error.message || "Fresh signal scan failed."),
        items: []
      }
    };
  }
}

function buildCareScanProfile(evidencePack) {
  const careGraph = evidencePack.care_graph ?? {};
  const specialization = evidencePack.business?.specialization ?? {};
  const interestTerms = (careGraph.interests ?? []).flatMap((interest) => [
    interest.label,
    ...(interest.signal_terms ?? [])
  ]);
  const watchlist = [
    ...(specialization.watchlist ?? []),
    ...interestTerms,
    ...(careGraph.signal_queries ?? [])
  ].filter(Boolean);

  return {
    id: cleanString(evidencePack.business?.id) || slugify(careGraph.entity_name),
    company: cleanString(careGraph.entity_name || evidencePack.business?.company),
    website: cleanString(evidencePack.business?.website),
    creatorBackground: [
      `Entity: ${careGraph.entity_name || evidencePack.business?.company}`,
      `Likely interests: ${interestTerms.join(", ")}`,
      `Identity facts: ${(careGraph.identity_facts ?? []).slice(0, 6).join(" ")}`
    ]
      .filter(Boolean)
      .join("\n"),
    specialization: {
      inferred_domain: specialization.inferred_domain || "general-business",
      market: specialization.market || "",
      city: specialization.city || "",
      operating_model:
        specialization.operating_model || "identity-aware signal monitoring",
      customers:
        specialization.customers ||
        "people, companies, and communities connected to this entity",
      watchlist,
      reaction_goal:
        specialization.reaction_goal ||
        "identify the most relevant live signal and explain what to do next",
      search_terms: watchlist
    }
  };
}

async function createGroundedResponse({ apiKey, model, messages, evidencePack }) {
  const requestBody = buildOpenAIRequest({ model, messages, evidencePack });
  let response = await callOpenAI({ apiKey, body: requestBody });

  if (!response.ok && response.status === 400) {
    response = await callOpenAI({
      apiKey,
      body: buildOpenAIRequest({
        model,
        messages,
        evidencePack,
        structuredOutput: false
      })
    });
  }

  let payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error?.message ||
        `OpenAI request failed with status ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  let parsed = parseModelOutput(payload, evidencePack.sources);
  if (isEmptyModelOutput(parsed)) {
    response = await callOpenAI({
      apiKey,
      body: buildOpenAIRequest({
        model,
        messages,
        evidencePack,
        structuredOutput: false,
        plainFallback: true
      })
    });
    payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        payload.error?.message ||
          `OpenAI fallback request failed with status ${response.status}.`
      );
      error.status = response.status;
      throw error;
    }

    parsed = parseModelOutput(payload, evidencePack.sources);
  }

  return parsed;
}

function buildOpenAIRequest({
  model,
  messages,
  evidencePack,
  structuredOutput = true,
  plainFallback = false
}) {
  const body = {
    model,
    store: false,
    max_output_tokens: plainFallback ? 2200 : 3000,
    instructions: [
      "You are a source-grounded business relevance analyst inside a news relevance app.",
      "Use only the provided evidence pack. Do not use outside knowledge, memory, or assumptions as facts.",
      "Every factual claim that depends on an article must cite source IDs inline, for example [S1].",
      "If the evidence does not support an answer, say what is unsupported instead of guessing.",
      "For people, projects, or communities, reason in this order: first identify who/what the entity is, then infer its care graph, then rank the fresh or adjacent signals by what that entity would actually care about.",
      "Separate identity evidence from signal evidence. Identity evidence explains who the person/project/community is; signal evidence explains what changed or what to monitor.",
      "If fresh_signal_scan.items contains usable stories, lead with the most relevant signal and why it matters to the entity's care graph. If it contains no usable stories, say that no fresh signal was found and give the narrowest next scans from care_graph.signal_queries.",
      "Avoid generic advice like attend, sponsor, or engage unless the evidence directly supports that action. Prefer concrete actions tied to the entity's projects, community, market, or current signal.",
      "You may make business recommendations only as clearly grounded in the evidence, care graph, and business profile.",
      "Keep answers practical, specific, and written like a strategist briefing the user, not like a source summary.",
      "Never expose implementation details, endpoint paths, API routes, service URLs, request formats, environment variables, model names, or developer/internal workflow. Do not tell the user to call /api routes. If more evidence is needed, say to run another scan in the app or inspect the clickable source links.",
      plainFallback
        ? "Return plain text. Include source IDs inline and do not wrap the answer in JSON."
        : "Return valid JSON matching the requested schema."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                conversation: messages,
                evidence_pack: evidencePack
              },
              null,
              2
            )
          }
        ]
      }
    ]
  };

  if (model.startsWith("gpt-5")) {
    body.reasoning = {
      effort: "low"
    };
  }

  if (structuredOutput) {
    body.text = {
      format: {
        type: "json_schema",
        name: "grounded_business_chat_answer",
        strict: true,
        schema: CHAT_RESPONSE_SCHEMA
      }
    };
  }

  return body;
}

async function callOpenAI({ apiKey, body }) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });
}

function parseModelOutput(payload, sources) {
  const text = extractOutputText(payload);
  const parsed = parseJsonObject(text);

  if (!parsed) {
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const citations = Array.from(
      new Set(Array.from(text.matchAll(/\[(S\d+)\]/g)).map((match) => match[1]))
    )
      .map((id) => sourceById.get(id))
      .filter(Boolean)
      .map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        timestamp: source.timestamp
      }));

    return {
      answer: sanitizeAssistantText(
        text || "I could not produce a grounded answer from the evidence."
      ),
      citations,
      snippets: [],
      unsupported: text ? [] : [EMPTY_OUTPUT_MARKER]
    };
  }

  const normalized = normalizeStructuredAnswer(parsed);
  const answer = sanitizeAssistantText(normalized.answer);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const citedIds = new Set([
    ...(Array.isArray(normalized.citations)
      ? normalized.citations.map((citation) => cleanString(citation.id))
      : []),
    ...Array.from(answer.matchAll(/\[(S\d+)\]/g)).map((match) => match[1])
  ]);
  const citations = Array.from(citedIds)
    .map((id) => sourceById.get(id))
    .filter(Boolean)
    .map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      timestamp: source.timestamp
    }));

  return {
    answer,
    citations,
    snippets: Array.isArray(normalized.snippets)
      ? normalized.snippets
          .map((snippet) => ({
            source_id: cleanString(snippet.source_id),
            text: cleanString(snippet.text)
          }))
          .filter((snippet) => snippet.source_id && snippet.text)
          .slice(0, 5)
      : [],
    unsupported: Array.isArray(normalized.unsupported)
      ? normalized.unsupported
          .map(sanitizeAssistantText)
          .filter(Boolean)
          .slice(0, 5)
      : []
  };
}

function normalizeStructuredAnswer(parsed) {
  const answer = cleanString(parsed?.answer);
  const nested = parseJsonObject(answer);

  if (nested?.answer) {
    return {
      answer: nested.answer,
      citations: [
        ...(Array.isArray(parsed.citations) ? parsed.citations : []),
        ...(Array.isArray(nested.citations) ? nested.citations : [])
      ],
      snippets: [
        ...(Array.isArray(parsed.snippets) ? parsed.snippets : []),
        ...(Array.isArray(nested.snippets) ? nested.snippets : [])
      ],
      unsupported: [
        ...(Array.isArray(parsed.unsupported) ? parsed.unsupported : []),
        ...(Array.isArray(nested.unsupported) ? nested.unsupported : [])
      ]
    };
  }

  return parsed;
}

function isEmptyModelOutput(parsed) {
  return (
    !parsed.answer ||
    parsed.unsupported?.some((item) => item === EMPTY_OUTPUT_MARKER)
  );
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

function parseJsonObject(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  return (
    cleanString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "care-scan"
  );
}
