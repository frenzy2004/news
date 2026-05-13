const MAX_TEXT = 1200;
const CARE_INTEREST_RULES = [
  {
    id: "ai-builder-community",
    label: "AI builder community",
    terms: [
      "ai tinkerers",
      "ai community",
      "developer community",
      "builder community",
      "builders",
      "meetup",
      "co working",
      "coworking"
    ],
    why:
      "Community operators care about builder turnout, sponsor appetite, venue access, partner communities, and stories that raise or lower local ecosystem momentum.",
    signal_terms: [
      "AI Tinkerers",
      "Kuala Lumpur",
      "AI builders",
      "developer community",
      "Malaysia"
    ]
  },
  {
    id: "hackathons-evals",
    label: "Hackathons and evals",
    terms: [
      "hackathon",
      "hackathons",
      "prompt olympics",
      "leaderboard",
      "eval",
      "evals",
      "challenge",
      "llm focused challenge"
    ],
    why:
      "Hackathon and eval-format builders care about model launches, developer tooling, sponsor budgets, judging workflows, and problems that can become challenge tracks.",
    signal_terms: [
      "AI hackathon",
      "LLM evals",
      "Prompt Olympics",
      "leaderboards",
      "developer tools"
    ]
  },
  {
    id: "document-ai",
    label: "Document AI and RAG",
    terms: [
      "docuask",
      "document utility",
      "documents",
      "rag",
      "retrieval",
      "long documents"
    ],
    why:
      "Document AI builders care about enterprise AI adoption, search/retrieval tooling, compliance, knowledge work budgets, and workflow automation.",
    signal_terms: [
      "DocuAsk",
      "document AI",
      "RAG",
      "enterprise AI",
      "knowledge work"
    ]
  },
  {
    id: "malaysia-ai-ecosystem",
    label: "Malaysia AI ecosystem",
    terms: [
      "malaysia",
      "kuala lumpur",
      "kl",
      "asean",
      "southeast asia",
      "sunway",
      "500 global"
    ],
    why:
      "Malaysia ecosystem builders care about policy, funding, public-sector demand, university/venue partnerships, regional AI infrastructure, and talent signals.",
    signal_terms: [
      "Malaysia AI",
      "Kuala Lumpur startups",
      "ASEAN AI",
      "AI policy",
      "AI talent"
    ]
  },
  {
    id: "ai-products",
    label: "AI products and agents",
    terms: [
      "ai caller",
      "agent",
      "agents",
      "automation",
      "sales",
      "inbound",
      "outbound"
    ],
    why:
      "AI product builders care about agent adoption, sales automation demand, platform shifts, pricing, and distribution channels.",
    signal_terms: [
      "AI agents",
      "sales automation",
      "AI products",
      "voice AI",
      "startup tools"
    ]
  }
];

export function buildChatEvidencePack({
  report,
  selectedStoryId,
  maxStories = 8,
  maxArticlesPerStory = 5,
  maxSelectedArticles = 30
} = {}) {
  const business = report?.businesses?.[0] ?? {};
  const items = Array.isArray(business.items) ? business.items : [];
  const contextResolution = report?.context_resolution ?? null;
  const selectedItem =
    items.find((item) => String(item.story_id) === String(selectedStoryId)) ??
    items[0] ??
    null;
  const sources = [];
  const seenUrls = new Map();
  const contextSourceRefs = collectContextSources({
    contextResolution,
    seenUrls,
    sources
  });

  const stories = items.slice(0, maxStories).map((item) => {
    const isSelected =
      selectedItem && String(item.story_id) === String(selectedItem.story_id);
    const articleLimit = isSelected ? maxSelectedArticles : maxArticlesPerStory;
    const articleSourceResult = collectArticleSources({
      item,
      articleLimit,
      seenUrls,
      sources
    });
    const sourceRefs = articleSourceResult.refs;
    const citationMap = articleSourceResult.citationMap;

    return {
      rank: item.rank ?? null,
      story_id: item.story_id ?? null,
      title: cleanText(item.title),
      match_type: cleanText(item.match?.source),
      theme: cleanText(item.theme),
      virality_score: asNumber(item.virality_score),
      specificity_score: asNumber(item.business_specificity?.score),
      summary: remapSourceCitations(truncate(item.summary, MAX_TEXT), citationMap),
      why_relevant: remapSourceCitations(
        truncate(item.why_relevant, MAX_TEXT),
        citationMap
      ),
      impact_area: cleanText(item.business_relevance?.impact_area),
      audience: cleanText(item.business_relevance?.audience),
      recommended_reaction: cleanText(
        item.business_relevance?.recommended_reaction
      ),
      content_angle: cleanText(item.business_relevance?.content_angle),
      key_points: cleanList(item.key_points)
        .map((point) => remapSourceCitations(point, citationMap))
        .slice(0, 8),
      entity_story_sections: cleanEntityStorySections(
        item.entity_story?.sections,
        citationMap
      ),
      discourse_notes: cleanList(item.discourse_notes)
        .map((note) => remapSourceCitations(note, citationMap))
        .slice(0, 6),
      entities: cleanList(item.entities).slice(0, 20),
      sentiment: {
        left: truncate(item.sentiment?.left, 700),
        right: truncate(item.sentiment?.right, 700)
      },
      source_refs: sourceRefs
    };
  });

  const pack = {
    generated_at: cleanText(report?.generated_at),
    date_range: cleanText(report?.date_range),
    evidence_policy:
      "Use only this evidence pack. Cite source IDs like [S1]. Mark unsupported claims.",
    provider_context: {
      primary: report?.source?.provider ?? "BTW",
      endpoints: Array.isArray(report?.source?.endpoints)
        ? report.source.endpoints
        : []
    },
    business: {
      id: cleanText(business.id),
      company: cleanText(business.company),
      website: cleanText(business.website),
      specialization: {
        inferred_domain: cleanText(business.specialization?.inferred_domain),
        market: cleanText(business.specialization?.market),
        city: cleanText(business.specialization?.city),
        operating_model: cleanText(business.specialization?.operating_model),
        customers: cleanText(business.specialization?.customers),
        watchlist: cleanList(business.specialization?.watchlist).slice(0, 18),
        reaction_goal: cleanText(business.specialization?.reaction_goal)
      }
    },
    context_resolution: contextResolution
      ? {
          input_type: cleanText(contextResolution.input_type),
          original_query: cleanText(contextResolution.original_query),
          provider: cleanText(contextResolution.provider),
          resolution_note: cleanText(contextResolution.resolution_note),
          resolved_entity: {
            name: cleanText(contextResolution.resolved_entity?.name),
            description: truncate(
              contextResolution.resolved_entity?.description,
              900
            ),
            likely_context: cleanList(
              contextResolution.resolved_entity?.likely_context
            ).slice(0, 16),
            keywords: cleanList(contextResolution.resolved_entity?.keywords).slice(
              0,
              24
            )
          },
          source_refs: contextSourceRefs
        }
      : null,
    selected_story_id: selectedItem?.story_id ?? null,
    selected_story_title: cleanText(selectedItem?.title),
    stories,
    sources,
    source_count: sources.length,
    errors: Array.isArray(report?.errors)
      ? report.errors.map((error) => ({
          endpoint: cleanText(error.endpoint),
          story_id: error.story_id ?? null,
          status: error.status ?? null,
          message: truncate(error.message, 600)
        }))
      : []
  };
  pack.care_graph = buildCareGraph(pack);

  return pack;
}

function collectContextSources({ contextResolution, seenUrls, sources }) {
  if (!contextResolution?.sources?.length) {
    return [];
  }

  const refs = [];
  contextResolution.sources.slice(0, 8).forEach((source) => {
    const url = cleanText(source.url);
    if (!url) {
      return;
    }

    if (seenUrls.has(url)) {
      refs.push(seenUrls.get(url));
      return;
    }

    const id = `S${sources.length + 1}`;
    seenUrls.set(url, id);
    sources.push({
      id,
      story_id: null,
      story_title: "Resolved query context",
      title: cleanText(source.title) || "Context source",
      url,
      timestamp: cleanText(source.published_date),
      snippet: truncate(source.snippet, 700)
    });
    refs.push(id);
  });

  return refs;
}

export function cleanChatMessages(messages, maxMessages = 10) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: truncate(message?.content, 1800)
    }))
    .filter((message) => message.content)
    .slice(-maxMessages);
}

function collectArticleSources({ item, articleLimit, seenUrls, sources }) {
  const refs = [];
  const citationMap = new Map();
  const articles = Array.isArray(item.articles) ? item.articles : [];

  articles.slice(0, articleLimit).forEach((article) => {
    const url = cleanText(article.url);
    const originalSourceId = cleanText(article.source_id);
    if (!url) {
      return;
    }

    if (seenUrls.has(url)) {
      const existingId = seenUrls.get(url);
      refs.push(existingId);
      if (originalSourceId) {
        citationMap.set(originalSourceId, existingId);
      }
      return;
    }

    const id = `S${sources.length + 1}`;
    seenUrls.set(url, id);
    if (originalSourceId) {
      citationMap.set(originalSourceId, id);
    }
    sources.push({
      id,
      story_id: item.story_id ?? null,
      story_title: cleanText(item.title),
      original_source_id: originalSourceId,
      title: cleanText(article.title) || "Source article",
      url,
      timestamp: cleanText(article.timestamp),
      snippet: truncate(article.summary, 700)
    });
    refs.push(id);
  });

  return { refs: [...new Set(refs)], citationMap };
}

function cleanEntityStorySections(sections, citationMap) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section) => ({
      title: cleanText(section?.title),
      body: remapSourceCitations(truncate(section?.body, 900), citationMap),
      points: cleanList(section?.points)
        .map((point) => remapSourceCitations(point, citationMap))
        .slice(0, 4)
    }))
    .filter((section) => section.title && (section.body || section.points.length))
    .slice(0, 5);
}

function remapSourceCitations(text, citationMap) {
  const clean = cleanText(text);
  if (!clean || citationMap.size === 0) {
    return clean;
  }

  return clean.replace(/\[(E\d+)\]/g, (match, id) => {
    const mapped = citationMap.get(id);
    return mapped ? `[${mapped}]` : match;
  });
}

export function buildCareGraph(evidencePack = {}) {
  const selectedStory =
    (evidencePack.stories ?? []).find(
      (story) => String(story.story_id) === String(evidencePack.selected_story_id)
    ) ?? evidencePack.stories?.[0] ?? null;
  const sourceText = (evidencePack.sources ?? [])
    .map((source) => `${source.title} ${source.snippet}`)
    .join(" ");
  const storyText = (evidencePack.stories ?? [])
    .flatMap((story) => [
      story.title,
      story.summary,
      story.why_relevant,
      ...(story.key_points ?? []),
      ...(story.entity_story_sections ?? []).flatMap((section) => [
        section.title,
        section.body,
        ...(section.points ?? [])
      ]),
      ...(story.entities ?? [])
    ])
    .join(" ");
  const contextKeywords = evidencePack.context_resolution?.resolved_entity?.keywords ?? [];
  const normalizedText = normalizeText(
    [
      evidencePack.business?.company,
      evidencePack.context_resolution?.resolved_entity?.description,
      contextKeywords.join(" "),
      sourceText,
      storyText
    ].join(" ")
  );
  const interests = CARE_INTEREST_RULES.filter((rule) =>
    rule.terms.some((term) => normalizedText.includes(normalizeText(term)))
  ).map((rule) => ({
    id: rule.id,
    label: rule.label,
    why: rule.why,
    signal_terms: rule.signal_terms
  }));
  const identityFacts = buildIdentityFacts({ selectedStory, evidencePack });
  const entityName =
    cleanText(evidencePack.context_resolution?.resolved_entity?.name) ||
    cleanText(evidencePack.business?.company);
  const locationTerms = contextKeywords.filter((keyword) =>
    ["malaysia", "kuala lumpur", "asean", "southeast asia"].includes(
      normalizeText(keyword)
    )
  );
  const signalQueries = buildCareSignalQueries({
    entityName,
    interests,
    keywords: contextKeywords,
    locationTerms
  });

  return {
    entity_name: entityName,
    identity_facts: identityFacts,
    interests,
    signal_queries: signalQueries,
    answer_strategy:
      "First identify who the entity is, then rank fresh or adjacent signals by what this entity likely cares about. Separate identity evidence from signal evidence."
  };
}

function buildIdentityFacts({ selectedStory, evidencePack }) {
  const facts = [];

  if (selectedStory?.summary) {
    facts.push(selectedStory.summary);
  }

  (selectedStory?.key_points ?? []).forEach((point) => {
    if (facts.length < 7 && !isNearDuplicate(point, facts)) {
      facts.push(point);
    }
  });

  (selectedStory?.entity_story_sections ?? []).forEach((section) => {
    if (section.body && facts.length < 10 && !isNearDuplicate(section.body, facts)) {
      facts.push(section.body);
    }
    (section.points ?? []).forEach((point) => {
      if (facts.length < 10 && !isNearDuplicate(point, facts)) {
        facts.push(point);
      }
    });
  });

  if (!facts.length && evidencePack.context_resolution?.resolved_entity?.description) {
    facts.push(evidencePack.context_resolution.resolved_entity.description);
  }

  return facts.slice(0, 10);
}

function buildCareSignalQueries({ entityName, interests, keywords, locationTerms }) {
  const entityTokens = normalizeText(entityName)
    .split(" ")
    .filter((token) => token.length > 2);
  const nonNameKeywords = (keywords ?? [])
    .map(cleanText)
    .filter(Boolean)
    .filter((keyword) => {
      const normalized = normalizeText(keyword);
      return !entityTokens.includes(normalized) && normalized !== normalizeText(entityName);
    });
  const interestTerms = interests.flatMap((interest) => interest.signal_terms);
  const baseTerms = [
    ...interestTerms,
    ...locationTerms,
    ...nonNameKeywords.filter((keyword) =>
      /(ai|tinkerers|docuask|prompt|hackathon|developer|community|startup|malaysia|kuala|lumpur|asean|rag|agent)/i.test(
        keyword
      )
    )
  ];
  const primary = dedupeWords(baseTerms).slice(0, 10).join(" ");
  const queries = [
    primary,
    dedupeWords([
      ...interestTerms,
      "news",
      "launch",
      "funding",
      "partnership",
      "policy"
    ])
      .slice(0, 12)
      .join(" "),
    dedupeWords([
      ...nonNameKeywords,
      ...interestTerms,
      "trend"
    ])
      .slice(0, 12)
      .join(" ")
  ]
    .map(cleanText)
    .filter((query) => query.length >= 6);

  return [...new Set(queries)].slice(0, 3);
}

export function attachCareSignalScan({
  evidencePack,
  scanResult,
  scanQuery,
  maxItems = 5
} = {}) {
  if (!scanResult?.items?.length) {
    return {
      ...evidencePack,
      fresh_signal_scan: {
        query: cleanText(scanQuery),
        status: "no_signal",
        items: []
      }
    };
  }

  const seenUrls = new Map(
    (evidencePack.sources ?? []).map((source) => [cleanText(source.url), source.id])
  );
  const sources = [...(evidencePack.sources ?? [])];
  const signalItems = scanResult.items
    .filter((item) => item.match?.source !== "entity_profile")
    .slice(0, maxItems)
    .map((item) => {
      const articleResult = collectArticleSources({
        item,
        articleLimit: 5,
        seenUrls,
        sources
      });
      const citationMap = articleResult.citationMap;

      return {
        rank: item.rank ?? null,
        story_id: item.story_id ?? null,
        title: cleanText(item.title),
        match_type: cleanText(item.match_type || item.match?.source),
        summary: remapSourceCitations(truncate(item.summary, MAX_TEXT), citationMap),
        why_relevant: remapSourceCitations(
          truncate(item.why_relevant, MAX_TEXT),
          citationMap
        ),
        virality_score: asNumber(item.virality_score),
        specificity_score: asNumber(item.business_specificity?.score),
        key_points: cleanList(item.key_points)
          .map((point) => remapSourceCitations(point, citationMap))
          .slice(0, 6),
        entities: cleanList(item.entities).slice(0, 14),
        source_refs: articleResult.refs
      };
    });

  return {
    ...evidencePack,
    sources,
    source_count: sources.length,
    fresh_signal_scan: {
      query: cleanText(scanQuery),
      status: signalItems.length ? "signals_found" : "identity_only",
      context_resolution: scanResult.contextResolution
        ? {
            provider: cleanText(scanResult.contextResolution.provider),
            resolved_keywords: cleanList(
              scanResult.contextResolution.resolved_entity?.keywords
            ).slice(0, 20),
            search_terms: cleanList(scanResult.contextResolution.search_terms).slice(
              0,
              10
            )
          }
        : null,
      items: signalItems
    }
  };
}

function dedupeWords(values) {
  const seen = new Set();
  const output = [];

  values
    .flatMap((value) => cleanText(value).split(/\s+/))
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((word) => word.length > 1)
    .forEach((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      output.push(word);
    });

  return output;
}

function isNearDuplicate(candidate, existingValues) {
  const candidateTokens = new Set(normalizeText(candidate).split(" ").filter(Boolean));
  if (!candidateTokens.size) {
    return false;
  }

  return existingValues.some((existing) => {
    const existingTokens = new Set(normalizeText(existing).split(" ").filter(Boolean));
    if (!existingTokens.size) {
      return false;
    }
    const overlap = [...candidateTokens].filter((token) => existingTokens.has(token))
      .length;
    return overlap / Math.min(candidateTokens.size, existingTokens.size) > 0.72;
  });
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(value) {
  return Array.isArray(value)
    ? value.map((item) => truncate(item, 700)).filter(Boolean)
    : [];
}

function truncate(value, limit) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
