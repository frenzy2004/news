import { BtwClient } from "./btw-client.js";
import {
  polishBackgroundItems,
  synthesizeEntityProfile
} from "./content-polish.js";
import { ExaClient } from "./exa-client.js";
import { normalizeStories } from "./report.js";

const MAX_ADJACENT_ITEMS = 12;
const MAX_BACKGROUND_ITEMS = 20;
const EXA_CONTEXT_RESULTS_PER_QUERY = 8;
const EXA_CONTEXT_SOURCE_LIMIT = 50;
const BTW_DEEP_RESULT_LIMIT = 100;
const BTW_DEEP_DETAIL_LIMIT = 60;
const MIN_ADJACENT_SCORE = 32;
const TECH_BUSINESS_TERMS = new Set([
  "ai",
  "artificial",
  "intelligence",
  "startup",
  "startups",
  "founder",
  "founders",
  "venture",
  "investor",
  "investment",
  "funding",
  "developer",
  "software",
  "community",
  "ecosystem",
  "saas",
  "automation",
  "agent",
  "agents",
  "documents",
  "sales",
  "growth",
  "hr",
  "staffing",
  "payroll",
  "recruiting",
  "malaysia",
  "singapore",
  "asean",
  "kuala",
  "lumpur",
  "san",
  "francisco"
]);
const DOMAIN_KEYWORD_ALLOWLIST = new Set([
  ...TECH_BUSINESS_TERMS,
  "500global",
  "catcha",
  "carousell",
  "carsome",
  "docuask",
  "finaccel",
  "grab",
  "groupon",
  "groupsmore",
  "investing",
  "investments",
  "partner",
  "prenetics",
  "says",
  "seed",
  "unicorn",
  "unicorns",
  "vc"
]);
const SPECIFIC_DOMAIN_TERMS = new Set([
  "500 global",
  "500 startups",
  "500 durians",
  "ai tinkerers",
  "catcha",
  "docuask",
  "groupsmore",
  "kuala lumpur",
  "malaysia",
  "says",
  "seed investments",
  "southeast asia",
  "southeast asian",
  "startup ecosystem",
  "tech startups",
  "venture capital",
  "vc"
]);
const IDENTITY_BRAND_TERMS = new Set([
  "500 global",
  "500 startups",
  "500 durians",
  "ai tinkerers",
  "catcha",
  "docuask",
  "groupsmore",
  "says"
]);
const AMBIGUOUS_MATCH_TERMS = new Set([
  "500",
  "acquired",
  "action",
  "ait",
  "business",
  "creation",
  "everywhere",
  "facebook",
  "founder",
  "global",
  "instagram",
  "linkedin",
  "managing",
  "ng",
  "partner",
  "revolutionaries",
  "spreading",
  "technology",
  "twitter",
  "unleashing"
]);
const QUERY_ALIASES = [
  {
    pattern: /\bait\b/i,
    phrases: ["AI Tinkerers", "AI community", "developer community"]
  }
];
const SOURCE_CONTEXT_TERMS = [
  "500 global",
  "500 startups",
  "ai community",
  "ai startups",
  "ai tinkerers",
  "developer advocate",
  "developer community",
  "docuask",
  "founder",
  "kuala lumpur",
  "malaysia",
  "managing partner",
  "seed investments",
  "southeast asia",
  "startup ecosystem",
  "tech startups",
  "venture capital"
];

export async function buildAdjacentSignals({
  apiKey,
  exaApiKey,
  profile,
  query,
  dateRange = "Week",
  maxArticles = 50,
  openAiApiKey = "",
  openAiModel = "gpt-5",
  fetchImpl = globalThis.fetch
} = {}) {
  const cleanedQuery = cleanText(query);
  const btwClient = new BtwClient({
    apiKey,
    fetchImpl
  });
  const entityFirst = isLikelySparseEntityQuery(cleanedQuery) && Boolean(exaApiKey?.trim());
  const initialContextResolution = entityFirst
    ? await resolveExaContext({
        exaApiKey,
        query: cleanedQuery,
        fetchImpl
      })
    : resolveBtwContext({ query: cleanedQuery });
  const initialDiscovery = await runBtwDeepDiscovery({
    btwClient,
    profile,
    query: cleanedQuery,
    contextResolution: initialContextResolution
  });
  let contextResolution = {
    ...initialContextResolution,
    search_terms: initialDiscovery.searchTerms,
    used_exa: initialContextResolution.provider === "Exa",
    deep_scan: {
      primary_provider: "BTW",
      fallback_provider: initialContextResolution.provider === "Exa" ? "Exa" : null,
      stage: entityFirst ? "entity_enrichment_first" : "btw_first",
      category_keys: initialDiscovery.categoryKeys,
      search_queries: initialDiscovery.searchTerms.length,
      trend_feed_candidates: initialDiscovery.feedCandidateCount
    }
  };
  let errors = [
    ...(initialContextResolution.errors ?? []),
    ...initialDiscovery.errors
  ];
  let candidates = scoreAndDedupeCandidates({
    searchResults: initialDiscovery.searchResults,
    profile,
    query: cleanedQuery,
    contextResolution
  });

  let items = normalizeStories({
    enrichedStories: buildCandidateStories({
      candidates,
      contextResolution,
      query: cleanedQuery
    }),
    maxArticles,
    profile
  }).map((item, index) =>
    decorateAdjacentItem({
      item,
      candidate: candidates[index],
      contextResolution
      })
    );

  if (!entityFirst && items.length === 0) {
    const exaContextResolution = await resolveExaContext({
      exaApiKey,
      query: cleanedQuery,
      fetchImpl
    });
    const exaDiscovery = await runBtwDeepDiscovery({
      btwClient,
      profile,
      query: cleanedQuery,
      contextResolution: exaContextResolution
    });

    contextResolution = {
      ...exaContextResolution,
      search_terms: exaDiscovery.searchTerms,
      used_exa: exaContextResolution.provider === "Exa",
      deep_scan: {
        primary_provider: "BTW",
        fallback_provider: exaContextResolution.provider === "Exa" ? "Exa" : null,
        stage: "exa_after_btw_empty",
        category_keys: exaDiscovery.categoryKeys,
        search_queries: exaDiscovery.searchTerms.length,
        trend_feed_candidates: exaDiscovery.feedCandidateCount
      }
    };
    errors = [
      ...errors,
      ...exaContextResolution.errors,
      ...exaDiscovery.errors
    ];
    candidates = scoreAndDedupeCandidates({
      searchResults: exaDiscovery.searchResults,
      profile,
      query: cleanedQuery,
      contextResolution
    });
    items = normalizeStories({
      enrichedStories: buildCandidateStories({
        candidates,
        contextResolution,
        query: cleanedQuery
      }),
      maxArticles,
      profile
    }).map((item, index) =>
      decorateAdjacentItem({
        item,
        candidate: candidates[index],
        contextResolution
      })
    );
  }

  if (items.length === 0 && contextResolution.sources.length > 0) {
    items = await buildEntityBackgroundItems({
      contextResolution,
      maxArticles,
      query: cleanedQuery,
      openAiApiKey,
      openAiModel,
      fetchImpl
    });
    items = await polishBackgroundItems({
      items,
      openAiApiKey,
      model: openAiModel,
      fetchImpl
    });
  }

  return {
    contextResolution,
    items,
    errors
  };
}

export function isLikelySparseEntityQuery(context) {
  const text = cleanText(context);
  if (!text || text.length > 80) {
    return false;
  }

  if (/^(company|website|i run|we run|my business|our business)\b/i.test(text)) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 5;
}

function resolveBtwContext({ query }) {
  const aliasTerms = buildAliasTerms(query);
  const keywords = extractEntityKeywords({ query, sources: [] });

  return {
    input_type: isLikelySparseEntityQuery(query)
      ? "entity_or_keyword_query"
      : "business_context",
    original_query: query,
    provider: "BTW",
    resolution_note:
      "BTW was scanned first using tailored creator results, expanded trend searches, and live trend list/detailed story data. Exa is only used if BTW returns no usable direct or adjacent result.",
    resolved_entity: {
      name: query,
      description: aliasTerms.length
        ? `${query} expanded with ${aliasTerms.join(", ")} for BTW search.`
        : query,
      likely_context: keywords.slice(0, 16),
      keywords
    },
    sources: [],
    errors: []
  };
}

async function resolveExaContext({ exaApiKey, query, fetchImpl }) {
  const expandedQuery = expandQueryAliases(query);
  const aliasTerms = buildAliasTerms(query);
  const base = {
    input_type: isLikelySparseEntityQuery(query)
      ? "entity_or_keyword_query"
      : "business_context",
    original_query: query,
    provider: "BTW",
    resolved_entity: {
      name: query,
      description: "",
      likely_context: [],
      keywords: mergeUnique([...tokenize(query), ...aliasTerms])
    },
    sources: [],
    errors: []
  };

  if (!exaApiKey || !exaApiKey.trim()) {
    return {
      ...base,
      resolution_note:
        "Entity enrichment is not configured because Exa is missing, so no source-backed context fallback is available."
    };
  }

  try {
    const exaClient = new ExaClient({
      apiKey: exaApiKey.trim(),
      fetchImpl
    });
    const searchQueries = buildEntitySearchQueries({
      query,
      expandedQuery,
      aliasTerms
    });
    const payloads = await Promise.all(
      searchQueries.map(async (searchQuery) => {
        try {
          return await exaClient.search({
            query: searchQuery,
            numResults: EXA_CONTEXT_RESULTS_PER_QUERY,
            maxCharacters: 1300
          });
        } catch (error) {
          return {
            results: [],
            error
          };
        }
      })
    );
    const searchErrors = payloads
      .filter((payload) => payload.error)
      .map((payload) =>
        formatError({
          error: payload.error,
          profile: {
            id: slugify(query),
            company: query
          },
          endpoint: "/search",
          query
        })
      );
    const rawSources = payloads
      .flatMap((payload) => asArray(payload.results))
      .map((result, index) => ({
        raw_rank: index + 1,
        title: cleanText(result.title) || "Exa source",
        url: cleanText(result.url),
        published_date: cleanText(result.publishedDate),
        snippet: truncate(cleanText(result.text), 1000)
      }))
      .filter((source) => source.url);
    const sources = rankContextSources({ query, sources: rawSources })
      .slice(0, EXA_CONTEXT_SOURCE_LIMIT)
      .map((source, index) => ({
        ...source,
        id: `E${index + 1}`
      }));
    const keywords = extractEntityKeywords({ query, sources });

    return {
      ...base,
      provider: "Exa",
      resolution_note:
        "Exa resolved source-backed entity context, then BTW searched using that context before showing adjacent signals or background sources.",
      resolved_entity: {
        name: query,
        description: buildEntityDescription({ query, sources, keywords }),
        likely_context: keywords.slice(0, 16),
        keywords
      },
      sources,
      errors: searchErrors
    };
  } catch (error) {
    return {
      ...base,
      resolution_note:
        "Entity enrichment failed, so no source-backed context fallback is available.",
      errors: [
        formatError({
          error,
          profile: {
            id: slugify(query),
            company: query
          },
          endpoint: "/search",
          query
        })
      ]
    };
  }
}

async function runBtwDeepDiscovery({
  btwClient,
  profile,
  query,
  contextResolution
}) {
  const searchTerms = buildSearchTerms({ query, contextResolution });
  const categoryKeys = buildBtwCategoryKeys({ profile, contextResolution });
  const [searchResults, feedResult] = await Promise.all([
    searchBtwTerms({ btwClient, searchTerms }),
    fetchBtwFeedCandidates({ btwClient, profile, categoryKeys })
  ]);
  const errors = [
    ...searchResults
      .filter((result) => result.error)
      .map((result) =>
        formatError({
          error: result.error,
          profile,
          endpoint: "/api/trends/search",
          query: result.query
        })
      ),
    ...feedResult.errors
  ];

  return {
    searchTerms,
    categoryKeys,
    searchResults: [...searchResults, ...feedResult.searchResults],
    feedCandidateCount: feedResult.feedCandidateCount,
    errors
  };
}

async function searchBtwTerms({ btwClient, searchTerms }) {
  return Promise.all(
    searchTerms.map(async (searchQuery) => {
      try {
        return {
          query: searchQuery,
          payload: await btwClient.searchTrends(searchQuery),
          error: null
        };
      } catch (error) {
        return {
          query: searchQuery,
          payload: null,
          error
        };
      }
    })
  );
}

async function fetchBtwFeedCandidates({ btwClient, profile, categoryKeys }) {
  try {
    const listPayload = await btwClient.listTrendingStories({
      categoryKeys,
      num: BTW_DEEP_RESULT_LIMIT
    });
    const storyIds = uniqueNormalized(
      asArray(listPayload.Stories)
        .map((story) => story.StoryId)
        .filter((storyId) => storyId !== undefined && storyId !== null)
        .map(String)
    )
      .map((storyId) => Number(storyId))
      .filter((storyId) => Number.isFinite(storyId))
      .slice(0, BTW_DEEP_DETAIL_LIMIT);

    if (storyIds.length === 0) {
      return {
        searchResults: [],
        feedCandidateCount: 0,
        errors: []
      };
    }

    const detailedPayload = await btwClient.fetchDetailedStories({
      storyIds
    });

    return {
      searchResults: [
        {
          query: `BTW live trend feed: ${categoryKeys.join(", ")}`,
          payload: {
            LiveStories: asArray(detailedPayload.Stories),
            HistoricalStories: []
          },
          error: null
        }
      ],
      feedCandidateCount: storyIds.length,
      errors: []
    };
  } catch (error) {
    return {
      searchResults: [],
      feedCandidateCount: 0,
      errors: [
        formatError({
          error,
          profile,
          endpoint: error.endpoint || "/api/trends/list",
          query: `BTW live trend feed: ${categoryKeys.join(", ")}`
        })
      ]
    };
  }
}

function buildCandidateStories({ candidates, contextResolution, query }) {
  return candidates.slice(0, MAX_ADJACENT_ITEMS).map((candidate) => ({
    creatorStory: {
      StoryId: candidate.story.StoryId,
      Title: candidate.story.Title,
      Body: candidate.story.Body,
      Reason: buildAdjacentReason({ candidate, contextResolution, query })
    },
    details: candidate.story,
    match: {
      source: candidate.source,
      score: candidate.score,
      query: candidate.query
    },
    errors: []
  }));
}

function buildSearchTerms({ query, contextResolution }) {
  const keywords = contextResolution.resolved_entity.keywords ?? [];
  const highSignal = keywords.filter((keyword) => !isPersonNameToken(keyword));
  const identityTerms = buildQueryIdentityTerms(query);
  const aliasTerms = buildAliasTerms(query);
  const phrases = [
    query,
    expandQueryAliases(query),
    [query, ...highSignal.slice(0, 7)].join(" "),
    [...identityTerms, ...aliasTerms, ...highSignal.slice(0, 8)].join(" "),
    highSignal.slice(0, 8).join(" "),
    [query, buildMarketPhrase(highSignal)].join(" "),
    [query, buildDomainPhrase(highSignal)].join(" "),
    [...identityTerms, "news"].join(" "),
    [...identityTerms, ...aliasTerms, "trend"].join(" "),
    buildMarketPhrase(highSignal),
    buildDomainPhrase(highSignal)
  ]
    .map(compactWhitespace)
    .filter((item) => item.length >= 3);

  return [...new Set(phrases)].slice(0, 12);
}

function buildEntitySearchQueries({ query, expandedQuery, aliasTerms }) {
  const identity = compactWhitespace(expandedQuery || query);
  const aliases = aliasTerms.join(" ");
  const lenses = [
    `${identity} official website biography projects`,
    `${identity} founder software engineer entrepreneur`,
    `${identity} AI Tinkerers AI community chapter organizer`,
    `${identity} Kuala Lumpur Malaysia AI startup developer community`,
    `${identity} DocuAsk Prompt Olympics AI Caller LinkedInfluencer`,
    `${identity} LinkedIn GitHub Crunchbase personal site`,
    `site:aitinkerers.org ${identity} ${aliases}`,
    `site:github.com ${identity}`,
    `site:linkedin.com/in ${identity}`,
    `site:medium.com ${identity}`,
    `site:crunchbase.com ${identity}`,
    `site:producthunt.com ${identity}`,
    `site:substack.com ${identity}`,
    `site:devpost.com ${identity}`
  ];

  return [...new Set(lenses.map(compactWhitespace).filter((item) => item.length >= 3))];
}

function buildBtwCategoryKeys({ profile, contextResolution }) {
  const domain = profile.specialization?.inferred_domain ?? "";
  const keywords = new Set(contextResolution.resolved_entity.keywords ?? []);
  const categories = ["New", "Business"];

  if (
    domain.includes("career") ||
    keywords.has("recruiting") ||
    keywords.has("hr") ||
    keywords.has("staffing")
  ) {
    categories.push("Technology", "Law");
  }

  if (
    domain.includes("food") ||
    domain.includes("fried") ||
    keywords.has("food") ||
    keywords.has("restaurant")
  ) {
    categories.push("World", "Science");
  }

  if (
    domain.includes("purpose") ||
    keywords.has("leadership") ||
    keywords.has("coaching")
  ) {
    categories.push("Culture", "Technology");
  }

  if (
    keywords.has("ai") ||
    keywords.has("startup") ||
    keywords.has("startups") ||
    keywords.has("software") ||
    keywords.has("developer") ||
    keywords.has("venture") ||
    keywords.has("vc")
  ) {
    categories.push("Technology");
  }

  if (isLikelySparseEntityQuery(contextResolution.original_query)) {
    categories.push("Technology", "World");
  }

  return [...new Set(categories)].slice(0, 6);
}

function scoreAndDedupeCandidates({
  searchResults,
  profile,
  query,
  contextResolution
}) {
  const byStory = new Map();

  searchResults.forEach((result) => {
    if (!result.payload) {
      return;
    }

    [
      ...asArray(result.payload.LiveStories).map((story) => ({
        story,
        source: "live"
      })),
      ...asArray(result.payload.HistoricalStories).map((story) => ({
        story,
        source: "historical"
      }))
    ].forEach((candidate) => {
      const score = scoreAdjacentCandidate({
        candidate,
        query,
        contextResolution
      });

      if (score < MIN_ADJACENT_SCORE) {
        return;
      }

      const key = candidate.story.StoryId ?? `${candidate.story.Title}-${result.query}`;
      const existing = byStory.get(key);
      if (!existing || score > existing.score) {
        byStory.set(key, {
          ...candidate,
          query: result.query,
          score,
          profile
        });
      }
    });
  });

  return [...byStory.values()].sort((left, right) => {
    if (right.source === "live" && left.source !== "live") {
      return 1;
    }
    if (left.source === "live" && right.source !== "live") {
      return -1;
    }
    return right.score - left.score;
  });
}

function scoreAdjacentCandidate({ candidate, query, contextResolution }) {
  const story = candidate.story;
  const storyText = normalize(
    [
      story.Title,
      story.Body,
      story.Theme,
      asArray(story.KeyPoints).join(" "),
      asArray(story.DiscourseNotes).join(" "),
      asArray(story.Entities).join(" "),
      asArray(story.CategoryKeys).join(" "),
      Object.values(story.Subcategories ?? {}).flat().join(" ")
    ].join(" ")
  );
  const titleText = normalize(story.Title);
  const keywordHits = [];
  const directHits = [];
  const domainHits = [];
  const keywords = contextResolution.resolved_entity.keywords ?? [];
  const directTerms = buildDirectMatchTerms({ query, keywords });
  const domainTerms = buildDomainMatchTerms(keywords);
  const directRequired = requiresDirectEntityHit({ query });
  let score = 0;

  directTerms.forEach((term) => {
    if (containsNormalizedTerm(titleText, term)) {
      score += term.includes(" ") ? 34 : 18;
      directHits.push(term);
      keywordHits.push(term);
    } else if (containsNormalizedTerm(storyText, term)) {
      score += term.includes(" ") ? 24 : 12;
      directHits.push(term);
      keywordHits.push(term);
    }
  });

  domainTerms.forEach((term) => {
    if (containsNormalizedTerm(titleText, term)) {
      score += term.includes(" ") ? 18 : 10;
      domainHits.push(term);
      keywordHits.push(term);
    } else if (containsNormalizedTerm(storyText, term)) {
      score += term.includes(" ") ? 12 : 7;
      domainHits.push(term);
      keywordHits.push(term);
    }
  });

  const uniqueDirectHits = uniqueNormalized(directHits);
  const uniqueDomainHits = uniqueNormalized(domainHits);
  const specificDomainHits = uniqueDomainHits.filter((term) =>
    SPECIFIC_DOMAIN_TERMS.has(term)
  );

  if (directRequired && uniqueDirectHits.length === 0) {
    return 0;
  }

  if (uniqueDirectHits.length === 0) {
    if (specificDomainHits.length === 0 || uniqueDomainHits.length < 3) {
      return 0;
    }

    if (specificDomainHits.length === 1 && uniqueDomainHits.length < 4) {
      return 0;
    }
  }

  if (candidate.source === "live") {
    score += 8;
  }

  if (Number(story.ArticleCount) > 0) {
    score += Math.min(Number(story.ArticleCount), 30) / 2;
  }

  if (Number(story.ViralityScore) > 0) {
    score += Math.min(Number(story.ViralityScore), 10);
  }

  const uniqueHits = [...new Set(keywordHits.map((hit) => hit.toLowerCase()))];
  if (uniqueHits.length < 2) {
    return 0;
  }

  return Math.min(92, Math.round(score));
}

function decorateAdjacentItem({ item, candidate, contextResolution }) {
  const score = candidate?.score ?? 58;
  const terms = findMatchedTerms({
    item,
    keywords: contextResolution.resolved_entity.keywords ?? []
  });

  return {
    ...item,
    match_type: "adjacent",
    why_relevant: buildAdjacentWhy({
      item,
      contextResolution,
      source: candidate?.source
    }),
    business_relevance: {
      decision: "show",
      impact_area: "Adjacent signal",
      audience: buildAdjacentAudience(contextResolution),
      business_mechanism:
        "The story is not a confirmed direct hit, but it overlaps with the resolved entity context and may be useful for monitoring, content, outreach, or reaction timing.",
      recommended_reaction:
        "Treat this as a watch item: verify fit, inspect the source articles, then decide whether to create a post, outreach note, or monitoring brief.",
      content_angle: `Why this may matter around ${contextResolution.original_query}`,
      why_allowed:
        "Allowed as an adjacent result because strict direct matching found no usable story.",
      cut_reason: "",
      source_signals: terms,
      reason_signals: terms,
      weak_signals: []
    },
    business_specificity: {
      score,
      terms,
      gate: "adjacent"
    },
    adjacent_context: {
      directness: "adjacent",
      directness_reason:
        "No strict direct story passed. This item is shown because its BTW story overlaps with Exa/BTW context terms.",
      resolved_keywords: contextResolution.resolved_entity.keywords?.slice(0, 12) ?? []
    },
    rank: item.rank
  };
}

async function buildEntityBackgroundItems({
  contextResolution,
  maxArticles,
  query,
  openAiApiKey,
  openAiModel,
  fetchImpl
}) {
  const profileItem = await buildEntityProfileItem({
    contextResolution,
    maxArticles,
    query,
    openAiApiKey,
    openAiModel,
    fetchImpl
  });
  const sourceItems = buildExaBackgroundItems({
    contextResolution,
    maxArticles,
    query
  }).map((item, index) => ({
    ...item,
    rank: profileItem ? index + 2 : index + 1
  }));

  return profileItem
    ? [profileItem, ...sourceItems].slice(0, MAX_BACKGROUND_ITEMS)
    : sourceItems.slice(0, MAX_BACKGROUND_ITEMS);
}

async function buildEntityProfileItem({
  contextResolution,
  maxArticles,
  query,
  openAiApiKey,
  openAiModel,
  fetchImpl
}) {
  const sources = contextResolution.sources.slice(0, Math.min(maxArticles, 12));
  if (!sources.length) {
    return null;
  }

  const deterministicProfile = buildDeterministicEntityProfile({
    contextResolution,
    query,
    sources
  });
  const synthesizedProfile = await synthesizeEntityProfile({
    query,
    sources,
    openAiApiKey,
    model: openAiModel,
    fetchImpl
  });
  const summary = synthesizedProfile?.summary || deterministicProfile.summary;
  const keyPoints = synthesizedProfile?.key_points?.length
    ? synthesizedProfile.key_points
    : deterministicProfile.keyPoints;
  const terms = (contextResolution.resolved_entity.keywords ?? [])
    .filter((keyword) => isMatchableTerm(normalize(keyword)))
    .slice(0, 10);

  return {
    rank: 1,
    story_id: `entity-profile-${slugify(query)}`,
    creator_story_id: null,
    title: `${displayName(query)} source-backed profile`,
    summary,
    why_relevant:
      "No direct live BTW story was found, so the app resolved the query as an entity first and built a source-backed profile before looking for nearby news signals.",
    match: {
      source: "entity_profile",
      score: 70,
      query
    },
    match_type: "background",
    position: null,
    position_change: null,
    theme: "Entity profile",
    category_keys: ["Background"],
    subcategories: {},
    virality_score: 0,
    regions: [],
    key_points: keyPoints,
    discourse_notes: [],
    entities: contextResolution.resolved_entity.keywords?.slice(0, 12) ?? [],
    key_dates: [],
    sentiment: {
      left: "",
      right: ""
    },
    article_count: sources.length,
    discovered_utc: "",
    articles: sources.map((source) => ({
      title: source.title,
      summary: source.snippet,
      url: source.url,
      timestamp: source.published_date
    })),
    business_relevance: {
      decision: "show",
      impact_area: "Entity context",
      audience: buildAdjacentAudience(contextResolution),
      business_mechanism:
        "This profile identifies the person, company, community, or project behind the query before the app decides whether live news is directly relevant.",
      recommended_reaction:
        "Use this identity layer as grounding, then inspect the source links or run a narrower scan for live news around the confirmed projects, communities, companies, or locations.",
      content_angle: `Who ${displayName(query)} is, from sources`,
      why_allowed:
        "Allowed as source-backed background because strict direct matching found no usable live story.",
      cut_reason: "",
      source_signals: terms,
      reason_signals: terms,
      weak_signals: []
    },
    business_specificity: {
      score: 70,
      terms,
      gate: "background"
    },
    adjacent_context: {
      directness: "entity_profile",
      directness_reason:
        "The query was treated as an entity first. Sources were gathered and summarized before showing raw background links.",
      resolved_keywords: contextResolution.resolved_entity.keywords?.slice(0, 12) ?? []
    }
  };
}

function buildDeterministicEntityProfile({ contextResolution, query, sources }) {
  const name = displayName(query);
  const keywords = contextResolution.resolved_entity.keywords ?? [];
  const keywordPhrase = keywords.slice(0, 8).join(", ");
  const topTitles = sources
    .slice(0, 3)
    .map((source) => source.title)
    .filter(Boolean)
    .join("; ");
  const summary = compactWhitespace(
    `${name} is resolved from source context around ${keywordPhrase || "the provided query"}. Top sources include ${topTitles}.`
  );
  const keyPoints = buildSourceBackedProfileFacts({ name, sources });

  return {
    summary,
    keyPoints: keyPoints.length
      ? keyPoints
      : sources
          .slice(0, 5)
          .map((source) => firstSentence(source.snippet) || source.title)
          .filter(Boolean)
  };
}

function buildSourceBackedProfileFacts({ name, sources }) {
  const text = normalize(
    sources.flatMap((source) => [source.title, source.snippet, source.url]).join(" ")
  );
  const facts = [];

  addFactIf(
    facts,
    text.includes("ai tinkerers") || text.includes("ai community"),
    `Sources connect ${name} to AI Tinkerers or an AI community context.`
  );
  addFactIf(
    facts,
    text.includes("kuala lumpur") || text.includes("malaysia"),
    `Sources place the context around Kuala Lumpur, Malaysia, or the Malaysian tech ecosystem.`
  );
  addFactIf(
    facts,
    text.includes("docuask"),
    `Sources mention DocuAsk as a project or company connected to ${name}.`
  );
  addFactIf(
    facts,
    text.includes("prompt olympics"),
    "Sources mention Prompt Olympics as an LLM challenge, hackathon, or event format."
  );
  addFactIf(
    facts,
    text.includes("founder") || text.includes("founded"),
    `Sources describe founder or organizer activity connected to ${name}.`
  );
  addFactIf(
    facts,
    text.includes("software engineer") || text.includes("developer"),
    `Sources describe software engineering, developer, or builder work connected to ${name}.`
  );

  sources.slice(0, 4).forEach((source) => {
    const sentence = firstSentence(source.snippet);
    if (sentence && !facts.some((fact) => isNearDuplicateFact(fact, sentence))) {
      facts.push(sentence);
    }
  });

  return facts.slice(0, 6);
}

function addFactIf(facts, condition, fact) {
  if (condition && !facts.some((existing) => isNearDuplicateFact(existing, fact))) {
    facts.push(fact);
  }
}

function isNearDuplicateFact(left, right) {
  const leftWords = new Set(tokenize(left));
  const rightWords = new Set(tokenize(right));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return false;
  }

  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.min(leftWords.size, rightWords.size) > 0.65;
}

function firstSentence(value) {
  const text = cleanText(value).replace(/\s+/g, " ");
  const match = text.match(/^(.+?[.!?])\s/);
  return truncate(match?.[1] || text, 240);
}

function buildExaBackgroundItems({ contextResolution, maxArticles, query }) {
  const terms = (contextResolution.resolved_entity.keywords ?? [])
    .filter((keyword) => isMatchableTerm(normalize(keyword)))
    .slice(0, 10);

  return contextResolution.sources.slice(0, MAX_BACKGROUND_ITEMS).map((source, index) => ({
    rank: index + 1,
    story_id: `exa-${index + 1}`,
    creator_story_id: null,
    title: source.title,
    summary: source.snippet,
    why_relevant: `No direct live BTW story was found for "${query}". This source provides background context about the person, company, community, or market connected to the query.`,
    match: {
      source: "exa_background",
      score: 50,
      query
    },
    match_type: "background",
    position: null,
    position_change: null,
    theme: "Entity background",
    category_keys: ["Background"],
    subcategories: {},
    virality_score: 0,
    regions: [],
    key_points: [source.snippet].filter(Boolean),
    discourse_notes: [],
    entities: contextResolution.resolved_entity.keywords?.slice(0, 12) ?? [],
    key_dates: [],
    sentiment: {
      left: "",
      right: ""
    },
    article_count: 1,
    discovered_utc: "",
    articles: [
      {
        title: source.title,
        summary: source.snippet,
        url: source.url,
        timestamp: source.published_date
      }
    ].slice(0, maxArticles),
    business_relevance: {
      decision: "show",
      impact_area: "Entity context",
      audience: buildAdjacentAudience(contextResolution),
      business_mechanism:
        "This is background context, not a direct news signal. It explains who or what the query likely refers to.",
      recommended_reaction:
        "Use this as identity and context evidence; ask the evidence chat for a source-backed brief or refine the query with a company, community, event, or topic.",
      content_angle: `What we know about ${query}`,
      why_allowed:
        "Allowed as background because strict direct matching and adjacent BTW search found no usable story.",
      cut_reason: "",
      source_signals: terms,
      reason_signals: [],
      weak_signals: []
    },
    business_specificity: {
      score: 50,
      terms,
      gate: "background"
    },
    adjacent_context: {
      directness: "background",
      directness_reason:
        "No direct or adjacent BTW signal was found. This source is shown only to avoid a dead end and help identify the query.",
      resolved_keywords: contextResolution.resolved_entity.keywords?.slice(0, 12) ?? []
    }
  }));
}

function buildAdjacentReason({ candidate, contextResolution, query }) {
  const keywords = contextResolution.resolved_entity.keywords?.slice(0, 8) ?? [];
  return `No direct BTW signal passed for "${query}", but this ${candidate.source} BTW story overlaps with the resolved context (${keywords.join(", ")}). Review it as an adjacent monitoring signal, not a confirmed direct match.`;
}

function buildAdjacentWhy({ item, contextResolution, source }) {
  const prefix =
    source === "live"
      ? "No direct signal passed, but this live story is close enough to monitor."
      : "No direct signal passed, but this historical story may still provide context.";

  return `${prefix} It overlaps with ${contextResolution.original_query} context terms such as ${(item.business_specificity?.terms ?? [])
    .slice(0, 6)
    .join(", ") || "the resolved entity background"}. ${item.summary}`;
}

function buildAdjacentAudience(contextResolution) {
  const keywords = contextResolution.resolved_entity.keywords ?? [];
  if (keywords.includes("ai") || keywords.includes("startup")) {
    return "people tracking the related AI, startup, founder, community, or market context";
  }

  return `people tracking ${contextResolution.original_query} and nearby business/news context`;
}

function buildEntityDescription({ query, sources, keywords }) {
  const firstSource = sources[0];
  const phrase = keywords.slice(0, 8).join(", ");

  if (!firstSource) {
    return query;
  }

  return compactWhitespace(
    `${query} appears in sources around ${phrase}. Top source: ${firstSource.title}.`
  );
}

function extractEntityKeywords({ query, sources }) {
  const expandedQuery = expandQueryAliases(query);
  const text = normalize(
    [expandedQuery, ...sources.flatMap((source) => [source.title, source.snippet])].join(" ")
  );
  const tokens = tokenize(text);
  const keywords = [];

  tokens.forEach((token) => {
    if (DOMAIN_KEYWORD_ALLOWLIST.has(token)) {
      keywords.push(token);
    }
  });

  phraseIfPresent(text, keywords, "500 global");
  phraseIfPresent(text, keywords, "500 startups");
  phraseIfPresent(text, keywords, "500 durians");
  phraseIfPresent(text, keywords, "kuala lumpur");
  phraseIfPresent(text, keywords, "san francisco");
  phraseIfPresent(text, keywords, "southeast asia");
  phraseIfPresent(text, keywords, "southeast asian");
  phraseIfPresent(text, keywords, "ai tinkerers");
  phraseIfPresent(text, keywords, "developer advocate");
  phraseIfPresent(text, keywords, "software engineer");
  phraseIfPresent(text, keywords, "document utility");
  phraseIfPresent(text, keywords, "inbound outbound sales");
  phraseIfPresent(text, keywords, "venture capital");
  phraseIfPresent(text, keywords, "seed investments");
  phraseIfPresent(text, keywords, "tech startups");
  phraseIfPresent(text, keywords, "startup ecosystem");
  phraseIfPresent(text, keywords, "ai startups");
  phraseIfPresent(text, keywords, "managing partner");

  return mergeUnique([
    ...buildQueryIdentityTerms(query),
    ...buildAliasTerms(query),
    ...keywords.filter((keyword) => !ENTITY_STOP_WORDS.has(keyword))
  ]).slice(0, 24);
}

function rankContextSources({ query, sources }) {
  const ranked = sources
    .map((source) => ({
      source,
      score: scoreContextSource({ query, source })
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (left.source.raw_rank ?? 0) - (right.source.raw_rank ?? 0);
    })
    .map((result) => result.source);

  return dedupeContextSources(ranked);
}

function scoreContextSource({ query, source }) {
  const sourceText = normalize([source.title, source.snippet, source.url].join(" "));
  const titleText = normalize(source.title);
  const urlText = cleanText(source.url).toLowerCase();
  const identityTerms = buildDirectMatchTerms({
    query,
    keywords: buildAliasTerms(query)
  });
  const aliasTerms = buildAliasTerms(query).map(normalize);
  let score = sourceDomainScore(urlText);

  identityTerms.forEach((term) => {
    if (containsNormalizedTerm(titleText, term)) {
      score += term.includes(" ") ? 46 : 14;
    } else if (containsNormalizedTerm(sourceText, term)) {
      score += term.includes(" ") ? 34 : 8;
    }
  });

  aliasTerms.forEach((term) => {
    if (containsNormalizedTerm(titleText, term)) {
      score += 34;
    } else if (containsNormalizedTerm(sourceText, term)) {
      score += 24;
    }
  });

  SOURCE_CONTEXT_TERMS.forEach((term) => {
    if (containsNormalizedTerm(titleText, term)) {
      score += 12;
    } else if (containsNormalizedTerm(sourceText, term)) {
      score += 7;
    }
  });

  if (identityTerms.some((term) => term.includes(" ")) && !identityTerms.some((term) => containsNormalizedTerm(sourceText, term))) {
    score -= 18;
  }

  if (
    sourceText.includes("start selling event tickets") ||
    sourceText.includes("my ticketspost event") ||
    sourceText.includes("quick navigation attend events") ||
    sourceText.includes("eventsize is a worldwide events discovery")
  ) {
    score -= 44;
  }

  if (
    sourceText.includes("blockchain and ai data centres") &&
    !sourceText.includes("docuask") &&
    !sourceText.includes("ai tinkerers") &&
    !sourceText.includes("ai community")
  ) {
    score -= 16;
  }

  return score;
}

function sourceDomainScore(urlText) {
  const weights = [
    ["josephch.in", 38],
    ["khailee.com", 38],
    ["500.co", 34],
    ["500global", 34],
    ["digitalnewsasia.com", 34],
    ["docuask", 30],
    ["techinasia.com", 24],
    ["e27.co", 22],
    ["crunchbase.com", 20],
    ["linkedin.com/in", 18],
    ["medium.com", 7],
    ["eventsize", -36],
    ["eventbrite", -22],
    ["allevents", -18]
  ];
  const match = weights.find(([needle]) => urlText.includes(needle));
  return match ? match[1] : 0;
}

function dedupeContextSources(sources) {
  const seenUrls = new Set();
  const seenTitleDomains = new Set();
  const deduped = [];

  sources.forEach((source) => {
    const urlKey = canonicalSourceUrl(source.url);
    const domain = sourceDomain(source.url);
    const titleDomainKey = `${domain}:${normalize(source.title)}`;

    if (seenUrls.has(urlKey) || seenTitleDomains.has(titleDomainKey)) {
      return;
    }

    seenUrls.add(urlKey);
    seenTitleDomains.add(titleDomainKey);
    deduped.push(source);
  });

  return deduped;
}

function canonicalSourceUrl(url) {
  const cleaned = cleanText(url).toLowerCase();

  try {
    const parsed = new URL(cleaned);
    parsed.protocol = "https:";
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/g, "");
    return parsed.toString();
  } catch {
    return cleaned.replace(/^http:\/\//, "https://").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function sourceDomain(url) {
  try {
    return new URL(cleanText(url).toLowerCase()).hostname.replace(/^www\./, "");
  } catch {
    return normalize(url).split(" ").slice(0, 2).join(" ");
  }
}

function expandQueryAliases(query) {
  const aliases = buildAliasTerms(query);
  return compactWhitespace([query, ...aliases].join(" "));
}

function buildAliasTerms(query) {
  const terms = [];

  QUERY_ALIASES.forEach((alias) => {
    if (alias.pattern.test(query)) {
      terms.push(...alias.phrases);
    }
  });

  return mergeUnique(terms);
}

function findMatchedTerms({ item, keywords }) {
  const storyText = normalize(
    [
      item.title,
      item.summary,
      item.theme,
      item.key_points?.join(" "),
      item.entities?.join(" ")
    ].join(" ")
  );

  return keywords
    .filter((keyword) => {
      const normalized = normalize(keyword);
      return isMatchableTerm(normalized) && containsNormalizedTerm(storyText, normalized);
    })
    .slice(0, 12);
}

function buildMarketPhrase(keywords) {
  const marketTerms = keywords.filter((keyword) =>
    ["malaysia", "singapore", "asean", "kuala", "lumpur"].includes(keyword)
  );
  const domainTerms = keywords.filter((keyword) =>
    ["ai", "startup", "community", "founder", "developer"].includes(keyword)
  );
  return [...marketTerms, ...domainTerms, "news"].join(" ");
}

function buildDomainPhrase(keywords) {
  const domainTerms = keywords.filter((keyword) =>
    [
      "ai",
      "startup",
      "startups",
      "community",
      "founder",
      "software",
      "developer",
      "documents",
      "automation"
    ].includes(keyword)
  );
  return [...domainTerms, "business trend"].join(" ");
}

function isPersonNameToken(token) {
  return token.length <= 4 && !TECH_BUSINESS_TERMS.has(token);
}

function isLikelyNameToken(token) {
  return (
    token.length >= 2 &&
    !/^\d+$/.test(token) &&
    !DOMAIN_KEYWORD_ALLOWLIST.has(token) &&
    !AMBIGUOUS_MATCH_TERMS.has(token)
  );
}

function buildQueryIdentityTerms(query) {
  const normalized = normalize(query);
  const terms = [];
  const tokens = normalized
    .split(" ")
    .filter((token) => token && !ENTITY_STOP_WORDS.has(token));
  const personPhrase =
    tokens.length >= 2 &&
    isLikelyNameToken(tokens[0]) &&
    isLikelyNameToken(tokens[1])
      ? tokens.slice(0, 2).join(" ")
      : "";

  if (personPhrase) {
    terms.push(personPhrase);
  } else if (tokens.length >= 2) {
    terms.push(tokens.slice(0, 2).join(" "));
  }

  if (normalized.includes("500 global")) {
    terms.push("500 global");
  }

  tokens.forEach((token) => {
    if (personPhrase && personPhrase.split(" ").includes(token)) {
      return;
    }

    if (token.length > 2 && !AMBIGUOUS_MATCH_TERMS.has(token) && !/^\d+$/.test(token)) {
      terms.push(token);
    }
  });

  return terms;
}

function buildDirectMatchTerms({ query, keywords }) {
  const queryTerms = buildQueryIdentityTerms(query);
  const brandTerms = (keywords ?? []).filter((keyword) => {
    const normalized = normalize(keyword);
    return IDENTITY_BRAND_TERMS.has(normalized);
  });

  return mergeUnique([...queryTerms, ...brandTerms])
    .map(normalize)
    .filter(isMatchableTerm);
}

function buildDomainMatchTerms(keywords) {
  return mergeUnique(keywords ?? [])
    .map(normalize)
    .filter((term) => isMatchableTerm(term) && !buildDirectMatchTerms({ query: "", keywords: [term] }).includes(term))
    .filter((term) => !AMBIGUOUS_MATCH_TERMS.has(term));
}

function isMatchableTerm(term) {
  if (!term || ENTITY_STOP_WORDS.has(term) || AMBIGUOUS_MATCH_TERMS.has(term)) {
    return false;
  }

  if (/^\d+$/.test(term)) {
    return false;
  }

  if (term.length <= 2 && term !== "ai" && term !== "vc") {
    return false;
  }

  return true;
}

function requiresDirectEntityHit({ query }) {
  const normalized = normalize(query);
  const tokens = normalized
    .split(" ")
    .filter((token) => token && !ENTITY_STOP_WORDS.has(token));

  if (normalized.includes(" from ") || normalized.includes("500 global")) {
    return true;
  }

  return tokens.some((token) => {
    return (
      token.length > 2 &&
      !/^\d+$/.test(token) &&
      !DOMAIN_KEYWORD_ALLOWLIST.has(token) &&
      !AMBIGUOUS_MATCH_TERMS.has(token)
    );
  });
}

function containsNormalizedTerm(normalizedText, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedText || !isMatchableTerm(normalizedTerm)) {
    return false;
  }

  const paddedText = ` ${normalizedText} `;
  const paddedTerm = ` ${normalizedTerm} `;
  return paddedText.includes(paddedTerm);
}

function uniqueNormalized(values) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function phraseIfPresent(text, keywords, phrase) {
  if (text.includes(phrase)) {
    keywords.push(phrase);
  }
}

function formatError({ error, profile, endpoint, query }) {
  return {
    business_id: profile.id,
    company: profile.company,
    endpoint: error.endpoint || endpoint,
    story_id: null,
    title: query || "",
    status: error.status ?? null,
    message: error.message
  };
}

function tokenize(value) {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length > 1 && !ENTITY_STOP_WORDS.has(word));
}

function normalize(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return (
    normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "query"
  );
}

function displayName(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word === "ai" || word === "ait") {
        return word.toUpperCase();
      }

      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function compactWhitespace(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function truncate(value, limit) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUnique(values) {
  const seen = new Set();
  const merged = [];

  values.filter(Boolean).forEach((value) => {
    const clean = cleanText(value).toLowerCase();
    if (!clean || seen.has(clean)) {
      return;
    }

    seen.add(clean);
    merged.push(clean);
  });

  return merged;
}

const ENTITY_STOP_WORDS = new Set([
  "and",
  "are",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
  "who",
  "you",
  "your"
]);
