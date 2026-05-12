const MAX_TEXT = 1200;

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
  const seenUrls = new Set();
  const contextSourceRefs = collectContextSources({
    contextResolution,
    seenUrls,
    sources
  });

  const stories = items.slice(0, maxStories).map((item) => {
    const isSelected =
      selectedItem && String(item.story_id) === String(selectedItem.story_id);
    const articleLimit = isSelected ? maxSelectedArticles : maxArticlesPerStory;
    const sourceRefs = collectArticleSources({
      item,
      articleLimit,
      seenUrls,
      sources
    });

    return {
      rank: item.rank ?? null,
      story_id: item.story_id ?? null,
      title: cleanText(item.title),
      match_type: cleanText(item.match?.source),
      theme: cleanText(item.theme),
      virality_score: asNumber(item.virality_score),
      specificity_score: asNumber(item.business_specificity?.score),
      summary: truncate(item.summary, MAX_TEXT),
      why_relevant: truncate(item.why_relevant, MAX_TEXT),
      impact_area: cleanText(item.business_relevance?.impact_area),
      audience: cleanText(item.business_relevance?.audience),
      recommended_reaction: cleanText(
        item.business_relevance?.recommended_reaction
      ),
      content_angle: cleanText(item.business_relevance?.content_angle),
      key_points: cleanList(item.key_points).slice(0, 8),
      discourse_notes: cleanList(item.discourse_notes).slice(0, 6),
      entities: cleanList(item.entities).slice(0, 20),
      sentiment: {
        left: truncate(item.sentiment?.left, 700),
        right: truncate(item.sentiment?.right, 700)
      },
      source_refs: sourceRefs
    };
  });

  return {
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
}

function collectContextSources({ contextResolution, seenUrls, sources }) {
  if (!contextResolution?.sources?.length) {
    return [];
  }

  const refs = [];
  contextResolution.sources.slice(0, 8).forEach((source) => {
    const url = cleanText(source.url);
    if (!url || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    const id = `S${sources.length + 1}`;
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
  const articles = Array.isArray(item.articles) ? item.articles : [];

  articles.slice(0, articleLimit).forEach((article) => {
    const url = cleanText(article.url);
    if (!url || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    const id = `S${sources.length + 1}`;
    sources.push({
      id,
      story_id: item.story_id ?? null,
      story_title: cleanText(item.title),
      title: cleanText(article.title) || "Source article",
      url,
      timestamp: cleanText(article.timestamp),
      snippet: truncate(article.summary, 700)
    });
    refs.push(id);
  });

  return refs;
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
