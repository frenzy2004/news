import { BtwClient } from "./btw-client.js";
import { evaluateBusinessRelevance, relevanceScoreBonus } from "./domain-relevance.js";
import { MissingConfigError } from "./errors.js";
import { businessProfiles } from "./profiles.js";

export const SOURCE = {
  provider: "BTW",
  endpoints: [
    "/api/creator",
    "/api/trends/list",
    "/api/trends/detailed",
    "/api/trends/search"
  ]
};

export async function generateReport({
  apiKey,
  profiles = businessProfiles,
  dateRange = "Now",
  now = new Date(),
  fetchImpl = globalThis.fetch,
  maxArticles = 5,
  minSpecificityScore = 0,
  allowThresholdFallback = true
} = {}) {
  if (!apiKey || apiKey.trim() === "") {
    throw new MissingConfigError("Missing BTW_API_KEY.");
  }

  const client = new BtwClient({
    apiKey: apiKey.trim(),
    fetchImpl
  });

  const businessResults = await Promise.all(
    profiles.map((profile) =>
      buildBusinessResult({
        client,
        profile,
        dateRange,
        maxArticles,
        minSpecificityScore,
        allowThresholdFallback
      })
    )
  );

  return {
    generated_at: now.toISOString(),
    date_range: dateRange,
    source: SOURCE,
    businesses: businessResults.map(({ business }) => business),
    errors: businessResults.flatMap(({ errors }) => errors)
  };
}

async function buildBusinessResult({
  client,
  profile,
  dateRange,
  maxArticles,
  minSpecificityScore,
  allowThresholdFallback
}) {
  const business = {
    id: profile.id,
    company: profile.company,
    website: profile.website,
    specialization: profile.specialization ?? null,
    creator_date_range: dateRange,
    items: []
  };

  try {
    const creatorResult = await discoverCreatorStoriesWithFallback({
      client,
      profile,
      dateRange
    });
    const creatorPayload = creatorResult.payload;
    const creatorErrors = creatorResult.errors;
    business.creator_date_range = creatorResult.dateRange;
    const creatorStories = Array.isArray(creatorPayload.DiscoveredStories)
      ? creatorPayload.DiscoveredStories
      : [];

    const enrichedStories = await Promise.all(
      creatorStories.map((creatorStory) =>
        enrichCreatorStory({ client, profile, creatorStory })
      )
    );

    const normalizedItems = normalizeStories({
      enrichedStories,
      maxArticles,
      profile
    });
    applySpecificityFiltering({
      business,
      items: normalizedItems,
      minSpecificityScore,
      allowThresholdFallback
    });

    return {
      business,
      errors: [
        ...creatorErrors,
        ...enrichedStories.flatMap(({ errors }) => errors)
      ]
    };
  } catch (error) {
    business.filtering = {
      min_specificity_score: minSpecificityScore,
      total_candidates: 0,
      domain_matches: 0,
      threshold_matches: 0,
      shown: 0,
      fallback_used: true,
      fallback_reason: `BTW could not return creator stories: ${error.message}`
    };

    return {
      business,
      errors: [formatError({ error, profile, endpoint: "/api/creator" })]
    };
  }
}

export function applySpecificityFiltering({
  business,
  items,
  minSpecificityScore,
  allowThresholdFallback = true,
  fallbackPrefix = ""
}) {
  const domainAllowedItems = items.filter(
    (item) => item.business_relevance.decision === "show"
  );
  const thresholdItems = domainAllowedItems.filter(
    (item) => item.business_specificity.score >= minSpecificityScore
  );
  const selectedItems =
    thresholdItems.length > 0
      ? thresholdItems
      : allowThresholdFallback
        ? domainAllowedItems.length > 0
          ? domainAllowedItems
          : items.slice(0, 5)
        : [];

  const fallbackReason =
    thresholdItems.length > 0
      ? ""
      : !allowThresholdFallback && domainAllowedItems.length > 0
        ? `No story reached specificity ${minSpecificityScore}; max-specificity mode cut ${domainAllowedItems.length} below-threshold matches.`
        : !allowThresholdFallback && items.length > 0
          ? "No story passed the max-specificity business gate."
          : domainAllowedItems.length > 0
            ? `No story reached specificity ${minSpecificityScore}; showing strongest domain matches instead.`
            : items.length > 0
              ? "Every story failed the domain gate; showing review candidates with cut reasons."
              : "";

  business.items = selectedItems.map((item, index) => ({
    ...item,
    rank: index + 1,
    business_specificity: {
      ...item.business_specificity,
      gate:
        thresholdItems.length > 0
          ? "passed"
          : domainAllowedItems.length > 0
            ? "below_threshold"
            : item.business_specificity.gate
    }
  }));
  business.filtering = {
    min_specificity_score: minSpecificityScore,
    total_candidates: items.length,
    domain_matches: domainAllowedItems.length,
    threshold_matches: thresholdItems.length,
    shown: business.items.length,
    fallback_used: Boolean(fallbackReason || fallbackPrefix),
    fallback_reason: [fallbackPrefix, fallbackReason].filter(Boolean).join(" ")
  };

  return business;
}

async function discoverCreatorStoriesWithFallback({ client, profile, dateRange }) {
  try {
    return {
      payload: await client.discoverCreatorStories({
        creatorBackground: profile.creatorBackground,
        dateRange
      }),
      dateRange,
      errors: []
    };
  } catch (error) {
    if (dateRange === "Now") {
      throw error;
    }

    const fallbackPayload = await client.discoverCreatorStories({
      creatorBackground: profile.creatorBackground,
      dateRange: "Now"
    });

    return {
      payload: fallbackPayload,
      dateRange: "Now",
      errors: [
        {
          ...formatError({ error, profile, endpoint: "/api/creator" }),
          message: `${error.message} Retried /api/creator with DateRange "Now".`
        }
      ]
    };
  }
}

async function enrichCreatorStory({ client, profile, creatorStory }) {
  const query = buildStorySearchQuery({ profile, creatorStory });
  const detailErrors = [];

  try {
    const detailedPayload = await client.fetchDetailedStories([creatorStory.StoryId]);
    const detailedStory = pickDetailedStory({ creatorStory, detailedPayload });

    if (detailedStory) {
      return {
        creatorStory,
        details: detailedStory,
        match: {
          source: "detailed",
          score: 200,
          query: `StoryId ${creatorStory.StoryId}`
        },
        errors: []
      };
    }
  } catch (error) {
    detailErrors.push(
      formatError({
        error,
        profile,
        endpoint: "/api/trends/detailed",
        story: creatorStory
      })
    );
  }

  try {
    const searchPayload = await client.searchTrends(query);
    const match = pickBestSearchMatch({ creatorStory, searchPayload });

    return {
      creatorStory,
      details: match?.story ?? null,
      match: {
        source: match?.source ?? "none",
        score: match?.score ?? 0,
        query
      },
      errors: detailErrors
    };
  } catch (error) {
    return {
      creatorStory,
      details: null,
      match: {
        source: "creator_only",
        score: 0,
        query
      },
      errors: [
        ...detailErrors,
        formatError({
          error,
          profile,
          endpoint: "/api/trends/search",
          story: creatorStory
        })
      ]
    };
  }
}

function pickDetailedStory({ creatorStory, detailedPayload }) {
  const stories = asArray(detailedPayload.Stories);

  if (stories.length === 0) {
    return null;
  }

  return (
    stories.find((story) => story.StoryId === creatorStory.StoryId) ??
    stories[0]
  );
}

export function normalizeStories({ enrichedStories, maxArticles = 5, profile = {} }) {
  return enrichedStories.map(({ creatorStory, details, match }, index) => {
    const story = {
      rank: index + 1,
      story_id: details?.StoryId ?? creatorStory.StoryId,
      creator_story_id: creatorStory.StoryId ?? null,
      title: asString(details?.Title || creatorStory.Title),
      summary: asString(details?.Body || creatorStory.Body),
      why_relevant: asString(creatorStory.Reason),
      match: {
        source: asString(match?.source),
        score: asNumber(match?.score),
        query: asString(match?.query)
      },
      position: asNullableNumber(details?.Position),
      position_change: asNullableNumber(details?.PositionChange),
      theme: asString(details?.Theme),
      category_keys: asArray(details?.CategoryKeys || creatorStory.CategoryKeys),
      subcategories: asObject(details?.Subcategories || creatorStory.Subcategories),
      virality_score: asNumber(details?.ViralityScore),
      regions: asArray(details?.Regions),
      key_points: asArray(details?.KeyPoints),
      discourse_notes: asArray(details?.DiscourseNotes),
      entities: asArray(details?.Entities),
      key_dates: asArray(details?.KeyDates).map((keyDate) => ({
        date: keyDate?.Date ?? null,
        event: asString(keyDate?.Event)
      })),
      sentiment: {
        left: asString(details?.SentimentLeft),
        right: asString(details?.SentimentRight)
      },
      article_count: asNumber(details?.ArticleCount),
      discovered_utc: asString(details?.DiscoveredUtc),
      articles: asArray(details?.Articles)
        .slice(0, maxArticles)
        .map((article) => ({
          title: asString(article.Title),
          summary: asString(article.Body),
          url: asString(article.Url),
          timestamp: asString(article.Timestamp)
        }))
    };

    return {
      ...story,
      ...buildBusinessFit({ profile, story })
    };
  });
}

function buildBusinessFit({ profile, story }) {
  const businessRelevance = evaluateBusinessRelevance({ profile, story });
  const businessSpecificity = scoreBusinessSpecificity({
    profile,
    story,
    businessRelevance
  });

  return {
    business_relevance: businessRelevance,
    business_specificity: businessSpecificity
  };
}

export function buildStorySearchQuery({ profile, creatorStory }) {
  return compactWhitespace(
    [
      creatorStory.Title,
      creatorStory.Body,
      `business context: ${profile.company}`,
      profile.specialization?.market
        ? `market ${profile.specialization.market}`
        : "",
      profile.specialization?.city ? `city ${profile.specialization.city}` : "",
      profile.specialization?.operating_model ?? "",
      ...(profile.specialization?.search_terms ?? []),
      profile.website
    ]
      .filter(Boolean)
      .join(" ")
  ).slice(0, 900);
}

export function pickBestSearchMatch({ creatorStory, searchPayload }) {
  const candidates = [
    ...asArray(searchPayload.LiveStories).map((story) => ({
      source: "live",
      story
    })),
    ...asArray(searchPayload.HistoricalStories).map((story) => ({
      source: "historical",
      story
    }))
  ];

  if (candidates.length === 0) {
    return null;
  }

  const scoredCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreSearchMatch({ creatorStory, candidate })
    }))
    .sort((left, right) => right.score - left.score);

  const best = scoredCandidates[0];
  return best.score >= 10 ? best : null;
}

function scoreSearchMatch({ creatorStory, candidate }) {
  const creatorTitle = normalizeText(creatorStory.Title);
  const candidateTitle = normalizeText(candidate.story.Title);
  const creatorText = normalizeText(`${creatorStory.Title} ${creatorStory.Body}`);
  const candidateText = normalizeText(`${candidate.story.Title} ${candidate.story.Body}`);
  let score = 0;

  if (creatorTitle && candidateTitle === creatorTitle) {
    score += 100;
  } else if (
    creatorTitle &&
    (candidateTitle.includes(creatorTitle) || creatorTitle.includes(candidateTitle))
  ) {
    score += 60;
  }

  score += wordOverlapScore(creatorText, candidateText) * 40;

  if (candidate.source === "live") {
    score += 5;
  }

  score += Math.min(asNumber(candidate.story.ViralityScore), 10) / 10;
  return Math.round(score * 100) / 100;
}

function scoreBusinessSpecificity({ profile, story, businessRelevance }) {
  const specializationTerms = tokenize(
    [
      profile.company,
      ...(profile.specialization?.search_terms ?? [])
    ].join(" ")
  );
  const uniqueTerms = [...new Set(specializationTerms)];
  const reasonText = normalizeText(story.why_relevant);
  const storyText = normalizeText(
    [
      story.title,
      story.summary,
      story.theme,
      story.key_points.join(" "),
      story.discourse_notes.join(" "),
      story.entities.join(" ")
    ].join(" ")
  );
  const regionText = normalizeText(story.regions.join(" "));
  const marketTerms = tokenize(
    [profile.specialization?.market, profile.specialization?.city].join(" ")
  );
  let score = 0;
  const hits = [];

  uniqueTerms.forEach((term) => {
    if (SPECIFICITY_STOP_WORDS.has(term)) {
      return;
    }

    if (reasonText.includes(term)) {
      score += 3;
      hits.push(term);
    } else if (storyText.includes(term)) {
      score += 2;
      hits.push(term);
    }
  });

  marketTerms.forEach((term) => {
    if (regionText.includes(term) || reasonText.includes(term) || storyText.includes(term)) {
      score += 5;
      hits.push(term);
    }
  });

  if (asNumber(story.article_count) > 0) {
    score += 4;
  }

  if (story.match.source === "live" || story.match.source === "detailed") {
    score += 2;
  }

  score += relevanceScoreBonus(businessRelevance);

  if (hasDirectSpecificFit({ profile, businessRelevance, hits })) {
    score = Math.max(score, 100);
  }

  if (businessRelevance.decision === "cut") {
    score = Math.min(score, 8);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    terms: [...new Set(hits)].slice(0, 12),
    gate: businessRelevance.decision === "show" ? "candidate" : "cut"
  };
}

function hasDirectSpecificFit({ profile, businessRelevance, hits }) {
  const domain = profile.specialization?.inferred_domain ?? "general-business";

  if (domain === "general-business" || businessRelevance.decision !== "show") {
    return false;
  }

  return (
    businessRelevance.source_signals.length >= 2 &&
    (businessRelevance.reason_signals.length >= 1 || hits.length >= 3)
  );
}

function wordOverlapScore(left, right) {
  const leftWords = new Set(tokenize(left));
  const rightWords = new Set(tokenize(right));

  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, 1);
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function normalizeText(value) {
  return compactWhitespace(asString(value).toLowerCase().replace(/[^a-z0-9 ]/g, " "));
}

function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set([
  "and",
  "are",
  "but",
  "for",
  "from",
  "has",
  "have",
  "its",
  "the",
  "this",
  "that",
  "with"
]);

const SPECIFICITY_STOP_WORDS = new Set([
  ...STOP_WORDS,
  "above",
  "actionable",
  "base",
  "business",
  "city",
  "commercially",
  "concrete",
  "context",
  "cost",
  "customers",
  "directly",
  "exclude",
  "explain",
  "generic",
  "goal",
  "immediate",
  "implication",
  "inputs",
  "late",
  "local",
  "loose",
  "market",
  "mechanism",
  "model",
  "monitor",
  "nearby",
  "news",
  "only",
  "operating",
  "operationally",
  "opportunities",
  "plausibly",
  "preferred",
  "prioritize",
  "quick",
  "reaction",
  "relevance",
  "revenue",
  "risks",
  "single",
  "social",
  "stories",
  "strict",
  "supply",
  "surface",
  "these",
  "touch",
  "touches",
  "type",
  "unless",
  "watchlist"
]);

function formatError({ error, profile, endpoint, story }) {
  return {
    business_id: profile.id,
    company: profile.company,
    endpoint: error.endpoint || endpoint,
    story_id: story?.StoryId ?? null,
    title: asString(story?.Title),
    status: error.status ?? null,
    message: error.message
  };
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asNullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
