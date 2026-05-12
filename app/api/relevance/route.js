import { NextResponse } from "next/server";
import {
  buildAdjacentSignals,
  isLikelySparseEntityQuery
} from "../../../src/adjacent-signals.js";
import { MissingConfigError } from "../../../src/errors.js";
import { generateReport } from "../../../src/report.js";
import {
  buildCreatorBackground,
  inferSpecialization,
  parseBusinessContext
} from "../../../src/specialization.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const context = cleanText(body.context);
  if (!context) {
    return NextResponse.json(
      { error: "Tell me what business you run first." },
      { status: 400 }
    );
  }

  if (context.length > 5000) {
    return NextResponse.json(
      { error: "Business context must be 5000 characters or less." },
      { status: 400 }
    );
  }

  const maxArticles = clampInteger(body.maxArticles, 1, 50, 50);
  const minSpecificityScore = clampInteger(body.minSpecificityScore, 0, 100, 14);
  const allowThresholdFallback = body.strictThreshold !== true;
  const parsedContext = parseBusinessContext(context);
  const isSparseEntityQuery = isLikelySparseEntityQuery(context);
  const explicitCompany = cleanText(body.company);
  const explicitWebsite = cleanText(body.website);
  const company =
    explicitCompany ||
    parsedContext.company ||
    (isSparseEntityQuery ? titleCase(context) : "Your Business");
  const website = explicitWebsite || parsedContext.website;
  const inferredSpecialization = inferSpecialization({ context, company, website });
  const specialization = {
    ...inferredSpecialization,
    ...buildSpecialization(body, inferredSpecialization)
  };
  const profile = {
    id: slugify(body.id || company || "custom"),
    company,
    website,
    creatorBackground: buildCreatorBackground({ context, specialization }),
    specialization
  };

  try {
    const report = await generateReport({
      apiKey: process.env.BTW_API_KEY,
      profiles: [profile],
      dateRange: body.dateRange === "Week" ? "Week" : "Now",
      maxArticles,
      minSpecificityScore,
      allowThresholdFallback
    });

    const creatorError = report.errors.find((reportError) => {
      return reportError.endpoint === "/api/creator";
    });

    if (creatorError && report.businesses[0]?.items?.length === 0) {
      return NextResponse.json(
        {
          error:
            creatorError.status === 403
              ? "BTW returned 403 for /api/creator with the server BTW_API_KEY. This app is BTW-only, so it will not show fallback data. Check that the BTW key is active and has API access, then run again."
              : `BTW could not return creator stories: ${creatorError.message}`,
          provider: "BTW",
          endpoint: creatorError.endpoint,
          status: creatorError.status
        },
        { status: creatorError.status === 403 ? 403 : 502 }
      );
    }

    if (report.businesses[0]?.items?.length === 0) {
      const adjacent = await buildAdjacentSignals({
        apiKey: process.env.BTW_API_KEY,
        exaApiKey: process.env.EXA_API_KEY,
        profile,
        query: context,
        dateRange: body.dateRange === "Week" ? "Week" : "Now",
        maxArticles,
        openAiApiKey: process.env.OPENAI_API_KEY,
        openAiModel: process.env.OPENAI_MODEL || "gpt-5"
      });
      const business = report.businesses[0];
      const adjacentMode = adjacent.items.some(
        (item) => item.match_type === "adjacent"
      )
        ? "adjacent"
        : adjacent.items.length > 0
          ? "background"
          : "empty";

      business.relevance_mode = adjacentMode;
      business.items = adjacent.items.map((item, index) => ({
        ...item,
        rank: index + 1
      }));
      business.filtering = {
        ...(business.filtering ?? {}),
        adjacent_used: true,
        adjacent_candidates: adjacent.items.length,
        fallback_used: true,
        fallback_reason: adjacent.items.length
          ? adjacentMode === "background"
            ? "No strict direct or adjacent BTW signal passed; showing source-backed entity background instead."
            : "No strict direct signal passed; showing adjacent, source-backed results instead."
          : "No strict direct or adjacent source-backed result was found."
      };
      report.context_resolution = adjacent.contextResolution;
      report.source = {
        ...report.source,
        providers: [
          ...new Set([
            report.source?.provider,
            ...(report.source?.providers ?? []),
            adjacent.contextResolution.used_exa ? "Exa" : null
          ].filter(Boolean))
        ],
        endpoints: [
          ...new Set([
            ...(report.source?.endpoints ?? []),
            "/api/trends/list",
            "/api/trends/detailed",
            "/api/trends/search",
            ...(adjacent.contextResolution.used_exa ? ["https://api.exa.ai/search"] : [])
          ])
        ]
      };
      report.errors.push(...adjacent.errors);
    }

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return NextResponse.json(
        { error: "BTW_API_KEY is missing on the server." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Could not generate relevance report." },
      { status: 500 }
    );
  }
}

function buildSpecialization(body, inferred) {
  const market = cleanText(body.market) || inferred.market;
  const city = cleanText(body.city) || inferred.city;
  const operatingModel = cleanText(body.operatingModel) || inferred.operating_model;
  const inputs = cleanList(body.inputs);
  const channels = cleanList(body.channels);
  const customers = cleanText(body.customers) || inferred.customers;
  const watchlist = cleanList(body.watchlist);
  const reactionGoal = cleanText(body.reactionGoal) || inferred.reaction_goal;

  return {
    market,
    city,
    operating_model: operatingModel,
    inputs: inputs.length ? inputs : inferred.inputs,
    channels: channels.length ? channels : inferred.channels,
    customers,
    watchlist: watchlist.length ? watchlist : inferred.watchlist,
    reaction_goal: reactionGoal,
    search_terms: [
      market,
      city,
      operatingModel,
      customers,
      reactionGoal,
      ...inputs,
      ...channels,
      ...watchlist,
      ...(inferred.search_terms ?? [])
    ].filter(Boolean)
  };
}

function cleanList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return cleanText(value)
    .split(/[,;\n]/)
    .map(cleanText)
    .filter(Boolean);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function slugify(value) {
  const slug = cleanText(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "custom";
}

function titleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
