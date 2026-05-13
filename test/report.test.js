import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  applySpecificityFiltering,
  buildStorySearchQuery,
  generateReport,
  normalizeStories,
  pickBestSearchMatch
} from "../src/report.js";
import {
  buildChatEvidencePack,
  cleanChatMessages
} from "../src/evidence-pack.js";
import { polishBackgroundItems } from "../src/content-polish.js";
import {
  buildAdjacentSignals,
  isLikelySparseEntityQuery
} from "../src/adjacent-signals.js";
import { writeReportFile } from "../src/output.js";
import { businessProfiles } from "../src/profiles.js";
import { inferSpecialization, parseBusinessContext } from "../src/specialization.js";
import { sanitizeChatResponse } from "../src/chat-sanitize.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

test("normalizes creator and detailed BTW payloads into report items", () => {
  const items = normalizeStories({
    enrichedStories: [
      {
        creatorStory: {
          StoryId: 101000,
          Title: "Food Recalls",
          Body: "Food recalls affect snacks and frozen pizza.",
          Reason: "Food safety is an immediate PR and client counsel issue."
        },
        details: {
          StoryId: 101,
          Position: 7,
          PositionChange: -2,
          Theme: "Food safety",
          CategoryKeys: ["Business", "Science"],
          Subcategories: {
            Business: ["Consumer Products"]
          },
          ViralityScore: 7.4,
          Regions: ["United States"],
          KeyPoints: ["The FDA issued recall warnings."],
          DiscourseNotes: ["Consumers are worried about contamination."],
          Entities: ["FDA", "Utz Quality Foods"],
          KeyDates: [
            {
              Date: "2026-05-06T00:00:00Z",
              Event: "FDA alert issued."
            }
          ],
          SentimentLeft: "Left summary",
          SentimentRight: "Right summary",
          ArticleCount: 16,
          DiscoveredUtc: "2026-05-05T00:00:00Z",
          Articles: [
            {
              Title: "Recall story",
              Body: "Article summary.",
              Url: "https://example.com/recall",
              Timestamp: "2026-05-06T00:00:00Z"
            }
          ]
        },
        match: {
          source: "live",
          score: 145.5,
          query: "Food Recalls Food recalls affect snacks and frozen pizza."
        },
        errors: []
      }
    ]
  });

  assert.deepEqual(items, [
    {
      rank: 1,
      story_id: 101,
      creator_story_id: 101000,
      title: "Food Recalls",
      summary: "Food recalls affect snacks and frozen pizza.",
      why_relevant: "Food safety is an immediate PR and client counsel issue.",
      match: {
        source: "live",
        score: 145.5,
        query: "Food Recalls Food recalls affect snacks and frozen pizza."
      },
      business_specificity: {
        score: 6,
        terms: [],
        gate: "candidate"
      },
      business_relevance: {
        decision: "show",
        impact_area: "Business signal",
        audience: "the audience described in the pasted business context",
        business_mechanism:
          "The story may affect costs, demand, regulation, reputation, channels, or customer behavior.",
        recommended_reaction:
          "Review the story against the business context and decide whether to message customers, adjust operations, or create content.",
        content_angle: "Why Food Recalls may matter to this business",
        why_allowed: "Allowed by general-business fallback.",
        cut_reason: "",
        source_signals: [],
        reason_signals: [],
        weak_signals: []
      },
      position: 7,
      position_change: -2,
      theme: "Food safety",
      category_keys: ["Business", "Science"],
      subcategories: {
        Business: ["Consumer Products"]
      },
      virality_score: 7.4,
      regions: ["United States"],
      key_points: ["The FDA issued recall warnings."],
      discourse_notes: ["Consumers are worried about contamination."],
      entities: ["FDA", "Utz Quality Foods"],
      key_dates: [
        {
          date: "2026-05-06T00:00:00Z",
          event: "FDA alert issued."
        }
      ],
      sentiment: {
        left: "Left summary",
        right: "Right summary"
      },
      article_count: 16,
      discovered_utc: "2026-05-05T00:00:00Z",
      articles: [
        {
          title: "Recall story",
          summary: "Article summary.",
          url: "https://example.com/recall",
          timestamp: "2026-05-06T00:00:00Z"
        }
      ]
    }
  ]);
});

test("generateReport fetches creator stories and enriches with detailed stories first", async () => {
  const seenDetailedBodies = [];
  const seenSearchBodies = [];
  const fetchImpl = createMockFetch({
    "/api/creator": () => ({
      DiscoveredStories: [
        {
          StoryId: 202,
          Title: "Hiring Shift",
          Body: "Recruiting teams are changing how they screen resumes.",
          Reason: "This affects job seekers and career content."
        }
      ]
    }),
    "/api/trends/detailed": ({ body }) => {
      seenDetailedBodies.push(body);
      return {
        Stories: [
          {
            StoryId: 202,
            Title: "Hiring Shift",
            Body: "Recruiting teams are changing how they screen resumes.",
            Theme: "Workplace change",
            CategoryKeys: ["Business"],
            ViralityScore: 5.5,
            KeyPoints: ["Recruiters are adapting workflows."],
            ArticleCount: 1,
            Articles: [
              {
                Title: "Hiring source",
                Body: "Source summary.",
                Url: "https://example.com/hiring",
                Timestamp: "2026-05-06T00:00:00Z"
              }
            ]
          }
        ]
      };
    },
    "/api/trends/search": ({ body }) => {
      seenSearchBodies.push(body);
      return {
        LiveStories: [
          {
            StoryId: 202,
            Title: "Hiring Shift",
            Body: "Recruiting teams are changing how they screen resumes.",
            Theme: "Workplace change",
            CategoryKeys: ["Business"],
            ViralityScore: 5.5,
            KeyPoints: ["Recruiters are adapting workflows."],
            ArticleCount: 1,
            Articles: [
              {
                Title: "Hiring source",
                Body: "Source summary.",
                Url: "https://example.com/hiring",
                Timestamp: "2026-05-06T00:00:00Z"
              }
            ]
          }
        ]
      };
    }
  });

  const report = await generateReport({
    apiKey: "test-key",
    profiles: [
      {
        id: "career",
        company: "Career Test",
        website: "https://example.com",
        creatorBackground: "Career strategy"
      }
    ],
    now: new Date("2026-05-06T00:00:00.000Z"),
    fetchImpl
  });

  assert.equal(report.generated_at, "2026-05-06T00:00:00.000Z");
  assert.equal(report.date_range, "Now");
  assert.equal(report.errors.length, 0);
  assert.deepEqual(seenDetailedBodies, [{ StoryIds: [202] }]);
  assert.equal(seenSearchBodies.length, 0);
  assert.equal(report.businesses[0].items[0].theme, "Workplace change");
  assert.equal(report.businesses[0].items[0].match.source, "detailed");
  assert.equal(report.businesses[0].items[0].articles[0].url, "https://example.com/hiring");
});

test("missing BTW_API_KEY exits cleanly without writing a report", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "btw-missing-key-"));
  const outputPath = path.join(tempDir, "report.json");

  try {
    const env = { ...process.env };
    delete env.BTW_API_KEY;

    const result = spawnSync(
      process.execPath,
      ["src/cli.js", "--out", outputPath],
      {
        cwd: path.resolve("."),
        env,
        encoding: "utf8"
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing BTW_API_KEY/);
    assert.equal(existsSync(outputPath), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("partial profile failures are captured while successful businesses remain", async () => {
  const profiles = [
    {
      id: "good",
      company: "Good Co",
      website: "https://good.example",
      creatorBackground: "good profile"
    },
    {
      id: "bad",
      company: "Bad Co",
      website: "https://bad.example",
      creatorBackground: "bad profile"
    }
  ];

  const fetchImpl = createMockFetch({
    "/api/creator": ({ body }) => {
      if (body.CreatorBackground.includes("bad")) {
        return {
          status: 500,
          body: {
            error: "upstream failed"
          }
        };
      }

      return {
        DiscoveredStories: [
          {
            StoryId: 303,
            Title: "Supply Chain",
            Body: "Shipping costs are moving.",
            Reason: "This affects operations."
          }
        ]
      };
    },
    "/api/trends/detailed": () => ({
      Stories: []
    }),
    "/api/trends/search": () => ({
      LiveStories: []
    })
  });

  const report = await generateReport({
    apiKey: "test-key",
    profiles,
    fetchImpl
  });

  assert.equal(report.businesses.length, 2);
  assert.equal(report.businesses.find((business) => business.id === "good").items.length, 1);
  assert.equal(report.businesses.find((business) => business.id === "bad").items.length, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0].business_id, "bad");
  assert.equal(report.errors[0].endpoint, "/api/creator");
});

test("written report JSON parses and includes both built-in profiles", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "btw-report-"));
  const outputPath = path.join(tempDir, "business-relevance.json");

  try {
    const fetchImpl = createMockFetch({
    "/api/creator": () => ({
      DiscoveredStories: []
    }),
    "/api/trends/detailed": () => ({
      Stories: []
    }),
    "/api/trends/search": () => ({
      LiveStories: []
      })
    });

    const report = await generateReport({
      apiKey: "test-key",
      profiles: businessProfiles,
      fetchImpl
    });

    await writeReportFile(report, outputPath);

    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    assert.deepEqual(
      parsed.businesses.map((business) => business.id),
      ["teuwen", "careersherpa"]
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("search failure keeps creator-only item and records story-level error", async () => {
  const fetchImpl = createMockFetch({
    "/api/creator": () => ({
      DiscoveredStories: [
        {
          StoryId: 404,
          Title: "Oil Price Rise",
          Body: "Cooking oil and fuel prices are rising.",
          Reason: "This can raise operating costs for fried chicken shops."
        }
      ]
    }),
    "/api/trends/detailed": () => ({
      Stories: []
    }),
    "/api/trends/search": () => ({
      status: 503,
      body: {
        error: "search unavailable"
      }
    })
  });

  const report = await generateReport({
    apiKey: "test-key",
    profiles: [
      {
        id: "fried-chicken",
        company: "Fried Chicken Shop",
        website: "",
        creatorBackground: "I run a fried chicken shop"
      }
    ],
    fetchImpl
  });

  assert.equal(report.businesses[0].items.length, 1);
  assert.equal(report.businesses[0].items[0].match.source, "creator_only");
  assert.equal(report.businesses[0].items[0].articles.length, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0].endpoint, "/api/trends/search");
  assert.equal(report.errors[0].story_id, 404);
});

test("pickBestSearchMatch prefers exact live title match with article coverage", () => {
  const match = pickBestSearchMatch({
    creatorStory: {
      Title: "Food Recalls",
      Body: "Food recalls affect snacks and frozen pizza."
    },
    searchPayload: {
      LiveStories: [
        {
          StoryId: 64707,
          Title: "Food Recalls",
          Body: "Multiple food recalls were issued.",
          ViralityScore: 4.3,
          Articles: [
            {
              Url: "https://example.com/food"
            }
          ]
        }
      ],
      HistoricalStories: [
        {
          StoryId: 12,
          Title: "Unrelated",
          Body: "Something else."
        }
      ]
    }
  });

  assert.equal(match.story.StoryId, 64707);
  assert.equal(match.source, "live");
});

test("buildStorySearchQuery accepts casual business context without requiring specifics", () => {
  const query = buildStorySearchQuery({
    profile: {
      company: "Fried Chicken Shop",
      website: ""
    },
    creatorStory: {
      Title: "Gas Price Rise",
      Body: "Gas prices affect consumer spending and restaurant sales."
    }
  });

  assert.match(query, /Gas Price Rise/);
  assert.match(query, /Fried Chicken Shop/);
  assert.ok(query.length <= 500);
});

test("infers CareerSherpa specialization from a pasted business context blob", () => {
  const context = `Company: CareerSherpa.net
Website: http://www.careersherpa.net

Hannah Morgan | Job Search, Career and Social Media Strategist. Blog topics include resumes, interviewing, career management, LinkedIn, social media, and job search strategies.`;

  const parsed = parseBusinessContext(context);
  const specialization = inferSpecialization({
    context,
    company: parsed.company,
    website: parsed.website
  });

  assert.equal(parsed.company, "CareerSherpa.net");
  assert.equal(parsed.website, "http://www.careersherpa.net");
  assert.equal(specialization.inferred_domain, "career-advice");
  assert.match(specialization.operating_model, /career advice/);
  assert.ok(specialization.watchlist.includes("layoffs"));
  assert.ok(specialization.channels.includes("LinkedIn"));
});

test("infers purpose and leadership businesses from a pasted homepage blob", () => {
  const context = `Company: On-Purpose Partners
Website: http://www.on-purpose.com

Find your purpose and put your 2-word purpose to work through memberships, coaching, training, speeches, licensed presenters, meaningful work, business purpose, CEO leadership, and personal development.`;

  const parsed = parseBusinessContext(context);
  const specialization = inferSpecialization({
    context,
    company: parsed.company,
    website: parsed.website
  });

  assert.equal(parsed.company, "On-Purpose Partners");
  assert.equal(specialization.inferred_domain, "purpose-leadership");
  assert.match(specialization.operating_model, /purpose-discovery/);
  assert.ok(specialization.watchlist.includes("meaningful work"));
  assert.ok(specialization.channels.includes("licensed presenters"));
});

test("purpose and leadership stories can pass max specificity when source has direct signals", () => {
  const context =
    "On-Purpose Partners helps people find purpose through coaching, leadership training, memberships, and licensed presenters for meaningful work.";
  const specialization = inferSpecialization({
    context,
    company: "On-Purpose Partners",
    website: "http://www.on-purpose.com"
  });
  const [item] = normalizeStories({
    profile: {
      company: "On-Purpose Partners",
      creatorBackground: "Purpose and leadership coaching",
      specialization
    },
    enrichedStories: [
      {
        creatorStory: {
          StoryId: 606,
          Title: "May Day 2026",
          Body:
            "Workers protested wages, labor pressure, burnout, and the search for meaningful work.",
          Reason:
            "This directly creates a purpose and leadership coaching prompt about meaningful work, values-led leadership, and how business owners can help employees stay on-purpose."
        },
        details: {
          StoryId: 606,
          Title: "May Day 2026",
          Body:
            "Workers protested wages, labor pressure, burnout, and workplace concerns across the United States.",
          Theme: "Labor and meaningful work",
          CategoryKeys: ["Business"],
          KeyPoints: [
            "Workers are demanding better wages and more meaningful workplace conditions."
          ],
          ArticleCount: 12,
          Articles: [
            {
              Title: "Labor source",
              Url: "https://example.com/labor",
              Timestamp: "2026-05-01T00:00:00Z"
            }
          ]
        },
        match: {
          source: "live",
          score: 120,
          query: "May Day purpose leadership"
        },
        errors: []
      }
    ]
  });
  const business = {
    id: "on-purpose",
    company: "On-Purpose Partners",
    website: "http://www.on-purpose.com",
    items: []
  };

  applySpecificityFiltering({
    business,
    minSpecificityScore: 100,
    allowThresholdFallback: false,
    items: [item]
  });

  assert.equal(item.business_relevance.decision, "show");
  assert.equal(item.business_specificity.score, 100);
  assert.equal(business.items.length, 1);
  assert.equal(business.items[0].business_specificity.gate, "passed");
});

test("CareerSherpa gate cuts loose AI stories when the source story is not employment-specific", () => {
  const specialization = inferSpecialization({
    context:
      "CareerSherpa covers resumes, LinkedIn, interviewing, career management, job search, and recruiter behavior.",
    company: "CareerSherpa.net",
    website: "http://www.careersherpa.net"
  });
  const [item] = normalizeStories({
    profile: {
      company: "CareerSherpa.net",
      creatorBackground: "Career advice",
      specialization
    },
    enrichedStories: [
      {
        creatorStory: {
          StoryId: 505,
          Title: "Meta Lawsuit",
          Body: "Meta faces a class-action lawsuit over copyrighted works used to train AI.",
          Reason:
            "Recruiters and job seekers increasingly use AI tools, so this could be a loose content hook."
        },
        details: {
          StoryId: 505,
          Title: "Meta Lawsuit",
          Body: "Meta faces a class-action lawsuit accusing it of using copyrighted works to train AI-generated content.",
          Theme: "Copyright infringement",
          CategoryKeys: ["Technology", "Law"],
          KeyPoints: ["The case focuses on copyrighted works and AI training data."],
          ArticleCount: 12,
          Articles: []
        },
        match: {
          source: "live",
          score: 120,
          query: "Meta Lawsuit"
        },
        errors: []
      }
    ]
  });

  assert.equal(item.business_relevance.decision, "cut");
  assert.equal(item.business_specificity.gate, "cut");
  assert.match(item.business_relevance.cut_reason, /underlying BTW story/);
});

test("max-specificity mode does not show below-threshold fallback matches", () => {
  const business = {
    id: "strict",
    company: "Strict Co",
    website: "",
    items: []
  };

  applySpecificityFiltering({
    business,
    minSpecificityScore: 100,
    allowThresholdFallback: false,
    items: [
      {
        rank: 1,
        title: "Relevant but weak",
        business_relevance: { decision: "show" },
        business_specificity: {
          score: 99,
          terms: ["hiring"],
          gate: "candidate"
        }
      }
    ]
  });

  assert.equal(business.items.length, 0);
  assert.equal(business.filtering.threshold_matches, 0);
  assert.equal(business.filtering.domain_matches, 1);
  assert.match(business.filtering.fallback_reason, /max-specificity/);
});

test("chat evidence pack keeps source IDs and selected story context", () => {
  const pack = buildChatEvidencePack({
    selectedStoryId: 202,
    report: {
      generated_at: "2026-05-06T00:00:00.000Z",
      date_range: "Week",
      source: {
        provider: "BTW",
        endpoints: ["/api/creator", "/api/trends/detailed"]
      },
      businesses: [
        {
          id: "career",
          company: "Career Test",
          website: "https://example.com",
          specialization: {
            inferred_domain: "career-advice",
            market: "United States job market",
            operating_model: "career advice publisher",
            watchlist: ["layoffs"]
          },
          items: [
            {
              rank: 1,
              story_id: 202,
              title: "Hiring Shift",
              summary: "Recruiting teams are changing resume screening.",
              why_relevant: "This affects job seekers.",
              match: { source: "detailed" },
              business_specificity: { score: 100 },
              business_relevance: {
                impact_area: "Recruiting",
                audience: "job seekers",
                recommended_reaction: "Publish advice."
              },
              key_points: ["Recruiters are adapting workflows."],
              articles: [
                {
                  title: "Hiring source",
                  url: "https://example.com/hiring",
                  timestamp: "2026-05-06T00:00:00Z",
                  summary: "Article summary."
                }
              ]
            }
          ]
        }
      ],
      context_resolution: {
        input_type: "entity_or_keyword_query",
        original_query: "career test",
        provider: "Exa",
        resolution_note: "Resolved with Exa.",
        resolved_entity: {
          name: "career test",
          description: "Career test context.",
          likely_context: ["career"],
          keywords: ["career", "hiring"]
        },
        sources: [
          {
            title: "Career context source",
            url: "https://example.com/context",
            published_date: "2026-05-05T00:00:00Z",
            snippet: "Career context."
          }
        ]
      },
      errors: []
    }
  });

  assert.equal(pack.business.company, "Career Test");
  assert.equal(pack.selected_story_id, 202);
  assert.equal(pack.context_resolution.source_refs[0], "S1");
  assert.equal(pack.stories[0].source_refs[0], "S2");
  assert.equal(pack.sources[0].url, "https://example.com/context");
  assert.equal(pack.sources[1].url, "https://example.com/hiring");
});

test("cleanChatMessages trims roles, empty messages, and history length", () => {
  const messages = cleanChatMessages(
    [
      { role: "system", content: "ignored role becomes user" },
      { role: "assistant", content: "" },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? "assistant" : "user",
        content: `message ${index}`
      }))
    ],
    4
  );

  assert.deepEqual(
    messages.map((message) => message.content),
    ["message 8", "message 9", "message 10", "message 11"]
  );
  assert.equal(messages[0].role, "assistant");
});

test("chat response sanitizer hides internal API routes from user-facing answers", () => {
  const sanitized = sanitizeChatResponse({
    answer:
      '3) Use your trends search endpoint to find current, sourced signals this week (/api/trends/search?query=layoffs OR "hiring freeze"), and build your resume guidance from those verified items. Use the content creation endpoint next.',
    citations: [],
    snippets: [],
    unsupported: [
      "Calling /api/trends/detailed directly is not supported by evidence."
    ]
  });

  assert.doesNotMatch(sanitized.answer, /\/api\//);
  assert.doesNotMatch(sanitized.answer, /endpoint/i);
  assert.doesNotMatch(sanitized.unsupported.join(" "), /\/api\//);
  assert.match(sanitized.answer, /Run another scan in the app/);
});

test("OpenAI polish rewrites background source snippets into clean summaries", async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v1/responses");

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          output_text: JSON.stringify({
            items: [
              {
                rank: 1,
                summary:
                  "Digital News Asia reported that 500 Startups appointed Khailee Ng as a managing partner. The article describes Ng as a Malaysian entrepreneur and investor with experience founding GroupsMore and Says.com.",
                key_points: [
                  "Ng was appointed managing partner at 500 Startups after working with its accelerator.",
                  "The source says he had made more than 30 investments across Southeast Asia for 500 Durians.",
                  "The article highlights his prior roles as founder of GroupsMore and Says.com."
                ]
              }
            ]
          })
        };
      }
    };
  };

  const [item] = await polishBackgroundItems({
    openAiApiKey: "openai-key",
    fetchImpl,
    items: [
      {
        rank: 1,
        match_type: "background",
        title: "500 Startups appoints Khailee Ng managing partner",
        summary:
          "500 Startups appoints Khailee Ng managing partner | Digital News Asia Skip to main content # 500 Startups appoints Khailee Ng managing partner ## By October 4, 2014 - Has made over 30 investments across SEA.",
        key_points: [
          "500 Startups appoints Khailee Ng managing partner | Digital News Asia Skip to main content"
        ],
        articles: [
          {
            title: "Source",
            url: "https://example.com/khailee",
            summary: "raw"
          }
        ]
      }
    ]
  });

  assert.match(item.summary, /Digital News Asia reported/);
  assert.doesNotMatch(item.summary, /Skip to main content/);
  assert.equal(item.key_points.length, 3);
  assert.equal(item.content_polish.provider, "OpenAI");
  assert.equal(item.articles[0].summary, item.summary);
});

test("background polish removes repeated generic bullets", async () => {
  const [item] = await polishBackgroundItems({
    openAiApiKey: "",
    items: [
      {
        rank: 1,
        match_type: "background",
        title: "Joseph Chin - Projects",
        summary:
          "Joseph Chin Kuala Lumpur, Malaysia # My Projects ### DocuAsk A document utility tool to save time on all your long documents. ### My Details Instant sharing for personal details, links and more. ### AI Caller Experience an AI-powered phone call for inbound and outbound sales. ### Prompt Olympics A platform for organizing LLM focused challenge events ### LinkedInfluencer A fun project that converts images into inspirational LinkedIn posts. ### ReachOut Reach out to your loved ones. ## My Events ### AI Tinkerers #1 The first AI Tinkerers event in Malaysia.",
        key_points: [],
        articles: [
          {
            title: "Joseph source",
            url: "https://example.com/joseph",
            summary: "raw"
          }
        ]
      }
    ]
  });

  const allText = [item.summary, ...item.key_points].join(" ");

  assert.match(item.summary, /DocuAsk/);
  assert.doesNotMatch(allText, /describes work on independent projects/i);
  assert.equal(
    item.key_points.filter((point) => /Kuala Lumpur/i.test(point)).length,
    1
  );
  assert.ok(item.key_points.every((point) => point !== item.summary));
});

test("background polish rejects thin listed-only OpenAI bullets", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        output_text: JSON.stringify({
          items: [
            {
              rank: 1,
              summary:
                "Joseph Chin's page lists independent projects and AI Tinkerers events.",
              key_points: [
                "DocuAsk is listed.",
                "My Details is listed.",
                "AI Caller is listed."
              ]
            }
          ]
        })
      };
    }
  });

  const [item] = await polishBackgroundItems({
    openAiApiKey: "openai-key",
    fetchImpl,
    items: [
      {
        rank: 1,
        match_type: "background",
        title: "Joseph Chin - Projects",
        summary:
          "Joseph Chin Kuala Lumpur, Malaysia # My Projects ### DocuAsk A document utility tool to save time on all your long documents. ### AI Caller Experience an AI-powered phone call for inbound and outbound sales. ## My Events ### AI Tinkerers #1 The first AI Tinkerers event in Malaysia.",
        key_points: [],
        articles: [
          {
            title: "Joseph source",
            url: "https://example.com/joseph",
            summary: "raw"
          }
        ]
      }
    ]
  });

  assert.doesNotMatch(item.key_points.join(" "), /is listed\./);
  assert.match(item.key_points.join(" "), /document utility tool/);
  assert.equal(item.content_polish, undefined);
});

test("sparse entity queries are detected without treating business blobs as names", () => {
  assert.equal(isLikelySparseEntityQuery("joseph chin"), true);
  assert.equal(isLikelySparseEntityQuery("Company: CareerSherpa.net"), false);
  assert.equal(isLikelySparseEntityQuery("I run a fried chicken shop"), false);
});

test("adjacent signals use Exa context and BTW search when strict matches are empty", async () => {
  const seenQueries = [];
  const fetchImpl = createMockFetch({
    "/search": () => ({
      results: [
        {
          title: "Joseph Chin - AI community builder",
          url: "https://example.com/joseph",
          publishedDate: "2026-01-01T00:00:00Z",
          text:
            "Joseph Chin is connected to DocuAsk, AI Tinkerers, Kuala Lumpur, Malaysia, startup projects, developer advocacy, and AI community events."
        }
      ]
    }),
    "/api/trends/search": ({ body }) => {
      seenQueries.push(body.Query);
      return {
        LiveStories: [
          {
            StoryId: 707,
            Title: "AI Startup Funding",
            Body:
              "DocuAsk, AI startups, and developer communities in Malaysia are drawing new funding and founder interest.",
            Theme: "AI startup ecosystem",
            CategoryKeys: ["Technology", "Business"],
            ViralityScore: 4.2,
            KeyPoints: [
              "Investors are watching AI startup ecosystems and developer communities."
            ],
            Entities: ["Malaysia", "AI startups"],
            ArticleCount: 2,
            Articles: [
              {
                Title: "AI funding source",
                Body: "AI startups in Malaysia are gaining attention.",
                Url: "https://example.com/ai-funding",
                Timestamp: "2026-05-08T00:00:00Z"
              }
            ]
          }
        ],
        HistoricalStories: []
      };
    }
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "joseph-chin",
      company: "Joseph Chin",
      website: "",
      creatorBackground: "Joseph Chin",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "joseph chin",
    fetchImpl
  });

  assert.equal(adjacent.contextResolution.used_exa, true);
  assert.ok(seenQueries.some((query) => /malaysia|startup|ai/i.test(query)));
  assert.equal(adjacent.items.length, 2);
  assert.equal(adjacent.items[0].match.source, "entity_profile");
  assert.equal(adjacent.items[1].match_type, "adjacent");
  assert.equal(adjacent.items[1].business_specificity.gate, "adjacent");
  assert.equal(adjacent.items[1].articles[0].url, "https://example.com/ai-funding");
});

test("sparse entity queries enrich identity before BTW adjacent search", async () => {
  let exaCalls = 0;
  const fetchImpl = createMockFetch({
    "/search": () => {
      exaCalls += 1;
      return {
        results: [
          {
            title: "Joseph Chin and AI Tinkerers Kuala Lumpur",
            url: "https://example.com/exa",
            text:
              "Joseph Chin is connected to AI Tinkerers Kuala Lumpur, Malaysia, and DocuAsk founder context."
          }
        ]
      };
    },
    "/api/trends/list": () => ({
      Stories: []
    }),
    "/api/trends/search": () => ({
      LiveStories: [
        {
          StoryId: 1001,
          Title: "Joseph Chin AI Tinkerers Meetup",
          Body:
            "Joseph Chin and AI Tinkerers Kuala Lumpur are hosting AI builder community sessions in Malaysia.",
          Theme: "AI community",
          CategoryKeys: ["Technology", "Business"],
          ViralityScore: 2.8,
          KeyPoints: [
            "Joseph Chin is connected to AI Tinkerers Kuala Lumpur community activity."
          ],
          Entities: ["Joseph Chin", "AI Tinkerers", "Kuala Lumpur"],
          ArticleCount: 1,
          Articles: [
            {
              Title: "BTW source",
              Body: "Joseph Chin and AI Tinkerers source detail.",
              Url: "https://example.com/btw-source",
              Timestamp: "2026-05-08T00:00:00Z"
            }
          ]
        }
      ],
      HistoricalStories: []
    })
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "joseph-ait",
      company: "Joseph Chin From AIT",
      website: "",
      creatorBackground: "joseph chin from ait",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "joseph chin from ait",
    fetchImpl
  });

  assert.ok(exaCalls > 0);
  assert.equal(adjacent.contextResolution.provider, "Exa");
  assert.equal(adjacent.contextResolution.used_exa, true);
  assert.equal(adjacent.contextResolution.deep_scan.stage, "entity_enrichment_first");
  assert.equal(adjacent.items[0].match.source, "entity_profile");
  assert.equal(adjacent.items[1].match_type, "adjacent");
  assert.equal(adjacent.items[1].articles[0].url, "https://example.com/btw-source");
});

test("entity queries do not treat generic Malaysia AI infrastructure as adjacent", async () => {
  const fetchImpl = createMockFetch({
    "/search": () => ({
      results: [
        {
          title: "Joseph Chin - This is the main page",
          url: "https://www.josephch.in/",
          text:
            "Joseph Chin works on DocuAsk and is connected to AI Tinkerers Kuala Lumpur in Malaysia."
        },
        {
          title: "Building a Community, One Crazy Week at a Time - Joseph Chin",
          url: "https://www.josephch.in/posts/the-year-everything-changed",
          text:
            "Joseph Chin describes building the AI Tinkerers Kuala Lumpur community and Prompt Olympics."
        }
      ]
    }),
    "/api/trends/list": () => ({
      Stories: []
    }),
    "/api/trends/search": () => ({
      LiveStories: [],
      HistoricalStories: [
        {
          StoryId: 1201,
          Title: "ByteDance AI Expansion",
          Body:
            "ByteDance is investing $2.5 billion in AI infrastructure in Malaysia with Nvidia chips.",
          Theme: "Technology expansion",
          CategoryKeys: ["Technology", "Business"],
          ViralityScore: 1.1,
          KeyPoints: [
            "ByteDance is expanding AI infrastructure in Malaysia."
          ],
          Entities: ["ByteDance", "Malaysia", "Nvidia"],
          ArticleCount: 9,
          Articles: [
            {
              Title: "ByteDance source",
              Url: "https://example.com/bytedance",
              Timestamp: "2026-05-08T00:00:00Z"
            }
          ]
        }
      ]
    })
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "joseph-ait-malaysia",
      company: "Joseph Chin AIT Malaysia",
      website: "",
      creatorBackground: "JOSEPH CHIN AIT MALAYSIA",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "JOSEPH CHIN AIT MALAYSIA",
    fetchImpl
  });

  assert.equal(adjacent.items[0].match.source, "entity_profile");
  assert.match(
    [adjacent.items[0].summary, ...adjacent.items[0].key_points].join(" "),
    /\[E\d+\]/
  );
  assert.equal(adjacent.items[0].articles[0].source_id, "E1");
  assert.equal(adjacent.items.length, 1);
  assert.ok(adjacent.items[0].entity_story.sections.length > 0);
  assert.match(
    adjacent.items[0].entity_story.sections
      .flatMap((section) => [section.body, ...section.points])
      .join(" "),
    /\[E\d+\]/
  );
  assert.ok(adjacent.items.every((item) => item.title !== "ByteDance AI Expansion"));
  assert.ok(
    adjacent.items[0].key_points.join(" ").includes("AI Tinkerers") ||
      adjacent.items[0].summary.includes("AI Tinkerers")
  );
});

test("adjacent signals reject weak substring and generic global matches", async () => {
  const fetchImpl = createMockFetch({
    "/search": () => ({
      results: [
        {
          title: "About Me - Khailee Ng",
          url: "https://example.com/khailee",
          text:
            "Khailee Ng is a managing partner at 500 Global focused on venture capital, Southeast Asia, Malaysia, seed investments, and tech startups."
        }
      ]
    }),
    "/api/trends/search": () => ({
      LiveStories: [
        {
          StoryId: 808,
          Title: "China Blocks Meta",
          Body:
            "China blocked Meta services after a global platform dispute involving technology and labor action.",
          Theme: "Economic issues",
          CategoryKeys: ["Technology"],
          ViralityScore: 5.7,
          KeyPoints: ["The dispute affects global technology companies."],
          Entities: ["China", "Meta"],
          ArticleCount: 38,
          Articles: [
            {
              Title: "Meta source",
              Url: "https://example.com/meta",
              Timestamp: "2026-05-08T00:00:00Z"
            }
          ]
        }
      ],
      HistoricalStories: []
    })
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "khailee",
      company: "Khailee Ng From 500 Global",
      website: "",
      creatorBackground: "khailee ng from 500 global",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "khailee ng from 500 global",
    fetchImpl
  });

  assert.equal(adjacent.items.length, 1);
  assert.equal(adjacent.items[0].match_type, "background");
  assert.match(adjacent.items[0].title, /source-backed profile/);
  assert.equal(adjacent.items[0].articles[0].title, "About Me - Khailee Ng");
  assert.ok(adjacent.items[0].entity_story.sections.length > 0);
  assert.ok(adjacent.items.every((item) => item.title !== "China Blocks Meta"));
});

test("adjacent signals reject first-name-only person matches", async () => {
  const fetchImpl = createMockFetch({
    "/search": () => ({
      results: [
        {
          title: "Joseph Chin - DocuAsk",
          url: "https://example.com/joseph",
          text:
            "Joseph Chin is the founder of DocuAsk and is connected to AI community work in Kuala Lumpur and Malaysia."
        }
      ]
    }),
    "/api/trends/search": () => ({
      LiveStories: [
        {
          StoryId: 909,
          Title: "Deported Family",
          Body:
            "A family story mentions Joseph and San Francisco but has no startup or AI community context.",
          Theme: "Immigration",
          CategoryKeys: ["World"],
          ViralityScore: 6,
          KeyPoints: ["A family was deported."],
          Entities: ["Joseph", "San Francisco"],
          ArticleCount: 12,
          Articles: [
            {
              Title: "Family source",
              Url: "https://example.com/family",
              Timestamp: "2026-05-08T00:00:00Z"
            }
          ]
        }
      ],
      HistoricalStories: []
    })
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "joseph",
      company: "Joseph Chin",
      website: "",
      creatorBackground: "joseph chin",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "joseph chin",
    fetchImpl
  });

  assert.equal(adjacent.items.length, 1);
  assert.equal(adjacent.items[0].match_type, "background");
  assert.match(adjacent.items[0].title, /source-backed profile/);
  assert.equal(adjacent.items[0].articles[0].title, "Joseph Chin - DocuAsk");
  assert.ok(adjacent.items[0].entity_story.sections.length > 0);
});

test("background sources expand AIT and rank identity context before event pages", async () => {
  const fetchImpl = createMockFetch({
    "/search": () => ({
      results: [
        {
          title: "Joseph Chin (Founder @ DocuAsk) - Malaysia | Eventsize",
          url: "https://eventsize.com/@josephchin",
          text:
            "Joseph Chin Founder DocuAsk. My TicketsPost Event. Start Selling Event Tickets. Eventsize is a worldwide events discovery and online ticketing platform."
        },
        {
          title:
            "'I'll connect you with whoever': Joseph Chin and the mechanics of an AI community",
          url: "https://www.digitalnewsasia.com/startups/ill-connect-you-whoever-joseph-chin-and-mechanics-ai-community",
          text:
            "Joseph Chin is associated with AI Tinkerers, an AI community in Kuala Lumpur, Malaysia, and founder work around DocuAsk."
        },
        {
          title: "Joseph Chin - DocuAsk - LinkedIn",
          url: "https://www.linkedin.com/in/josephchin",
          text:
            "Joseph Chin is founder at DocuAsk and connected to AI community work in Malaysia."
        },
        {
          title:
            "Joseph Chin | Strategic Consultant driving profitability in blockchain and AI data centres",
          url: "https://example.com/consultant",
          text:
            "Joseph Chin is a strategic consultant driving profitability in blockchain and AI data centres."
        },
        {
          title: "Joseph Chin - Medium",
          url: "https://medium.com/@josephchin",
          text:
            "Joseph Chin writes about AI, startups, founder lessons, and developer community work."
        },
        {
          title: "AI Tinkerers Kuala Lumpur",
          url: "https://example.com/ai-tinkerers-kl",
          text:
            "AI Tinkerers Kuala Lumpur is a developer community for builders working with AI tools in Malaysia."
        }
      ]
    }),
    "/api/trends/search": () => ({
      LiveStories: [],
      HistoricalStories: []
    })
  });

  const adjacent = await buildAdjacentSignals({
    apiKey: "btw-key",
    exaApiKey: "exa-key",
    profile: {
      id: "joseph-ait",
      company: "Joseph Chin From AIT",
      website: "",
      creatorBackground: "joseph chin from ait",
      specialization: {
        inferred_domain: "general-business",
        search_terms: []
      }
    },
    query: "joseph chin from ait",
    fetchImpl
  });

  assert.equal(adjacent.items.length, 1);
  assert.match(adjacent.items[0].title, /source-backed profile/);
  assert.match(adjacent.items[0].key_points.join(" "), /AI Tinkerers/);
  assert.match(adjacent.items[0].articles[0].title, /AI community/);
  assert.doesNotMatch(adjacent.items[0].articles[0].title, /Eventsize/);
  assert.ok(adjacent.items[0].entity_story.sections.length > 0);
  assert.ok(adjacent.contextResolution.resolved_entity.keywords.includes("ai tinkerers"));
  assert.ok(!adjacent.items[0].business_specificity.terms.includes("ait"));
  assert.doesNotMatch(adjacent.items[0].why_relevant, /next scan/i);
});
