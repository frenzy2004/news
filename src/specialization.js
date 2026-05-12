const DOMAIN_PROFILES = [
  {
    id: "purpose-leadership",
    keywords: [
      "purpose",
      "on-purpose",
      "onpurpose",
      "meaningful",
      "calling",
      "life purpose",
      "personal development",
      "leadership",
      "chief leadership officer",
      "ceo",
      "business owner",
      "coaching",
      "training",
      "presenter",
      "speaker",
      "membership",
      "top performer"
    ],
    market:
      "United States / English-language purpose, leadership, coaching, and small-business market",
    city: "",
    operating_model:
      "purpose-discovery, leadership coaching, membership, training, and licensing business",
    inputs: [
      "workplace meaning",
      "employee engagement",
      "leadership trends",
      "business owner confidence",
      "coaching demand",
      "personal development demand",
      "AI coaching tools",
      "training budgets",
      "speaker demand",
      "membership conversion"
    ],
    channels: [
      "website",
      "purpose assessment",
      "membership",
      "coaching",
      "training",
      "speaking",
      "licensed presenters",
      "blog",
      "email"
    ],
    customers:
      "purpose seekers, professionals, business owners, leaders, coaches, speakers, and licensed presenters",
    watchlist: [
      "workplace burnout",
      "employee engagement",
      "leadership change",
      "AI coaching tools",
      "personal development trends",
      "small business confidence",
      "training budgets",
      "hybrid work",
      "mental wellness",
      "values-led business",
      "entrepreneurship",
      "meaningful work"
    ],
    reaction_goal:
      "purpose and leadership guidance first: blog angles, workshop prompts, presenter talking points, membership lessons, coaching advice, and business-owner reflection questions"
  },
  {
    id: "career-advice",
    keywords: [
      "career",
      "job search",
      "resume",
      "linkedin",
      "interview",
      "recruiter",
      "hiring",
      "employment",
      "job seeker",
      "social media strategist"
    ],
    market: "United States / English-language job market",
    city: "",
    operating_model: "career advice publisher, coaching, and membership business",
    inputs: [
      "labor market trends",
      "hiring demand",
      "recruiter behavior",
      "resume screening",
      "LinkedIn platform changes",
      "AI job-search tools",
      "job boards",
      "course and membership demand"
    ],
    channels: [
      "blog",
      "newsletter",
      "LinkedIn",
      "social media",
      "career products",
      "membership",
      "coaching"
    ],
    customers:
      "job seekers, career changers, laid-off professionals, and professionals managing their careers",
    watchlist: [
      "layoffs",
      "hiring freezes",
      "unemployment",
      "AI automation",
      "AI recruiting tools",
      "resume screening",
      "LinkedIn changes",
      "labor policy",
      "remote work",
      "wage data",
      "job scams",
      "skills demand"
    ],
    reaction_goal:
      "content and advisory first: blog angles, LinkedIn posts, newsletter warnings, member guidance, practical job-search actions"
  },
  {
    id: "food-wine-pr",
    keywords: [
      "public relations",
      "press relations",
      "food",
      "wine",
      "spirits",
      "hospitality",
      "influencer",
      "events",
      "trade relations"
    ],
    market: "United States food, wine, spirits, restaurant, and hospitality market",
    city: "New York",
    operating_model: "specialist food, wine, and spirits PR and marketing agency",
    inputs: [
      "client retainers",
      "earned media",
      "press calendars",
      "brand events",
      "influencer partnerships",
      "trade relationships",
      "hospitality demand"
    ],
    channels: [
      "press outreach",
      "events",
      "social content",
      "influencer campaigns",
      "trade partnerships",
      "strategic consulting"
    ],
    customers:
      "food, wine, spirits, restaurant, hospitality, and premium consumer brands",
    watchlist: [
      "food safety",
      "alcohol regulation",
      "tariffs",
      "restaurant demand",
      "consumer sentiment",
      "travel trends",
      "hospitality labor",
      "cultural moments",
      "brand reputation"
    ],
    reaction_goal:
      "client counsel first: media angles, brand risk messaging, pitch hooks, event timing, partnership opportunities"
  },
  {
    id: "fried-chicken",
    keywords: [
      "fried chicken",
      "chicken shop",
      "quick service",
      "restaurant",
      "takeaway",
      "food delivery",
      "grabfood"
    ],
    market: "Malaysia",
    city: "Kuala Lumpur",
    operating_model: "quick-service fried chicken restaurant",
    inputs: [
      "chicken",
      "cooking oil",
      "palm oil",
      "flour",
      "spices",
      "packaging",
      "LPG/electricity",
      "delivery fuel",
      "labor",
      "rent"
    ],
    channels: ["walk-in", "takeaway", "delivery apps", "GrabFood", "promotions"],
    customers:
      "nearby office workers, families, students, and delivery customers",
    watchlist: [
      "poultry disease",
      "chicken prices",
      "palm oil prices",
      "flour imports",
      "fuel prices",
      "food safety",
      "delivery platform fees",
      "minimum wage",
      "rent",
      "consumer spending"
    ],
    reaction_goal:
      "operations first: pricing, supplier checks, menu changes, delivery margins, promos, customer messaging"
  }
];

export function parseBusinessContext(context) {
  const company = matchLine(context, /^Company:\s*(.+)$/im);
  const website = matchLine(context, /^Website:\s*(\S+)/im);

  return {
    company,
    website
  };
}

export function inferSpecialization({ context, company = "", website = "" }) {
  const normalizedContext = normalize(context);
  const domain = pickDomain(normalizedContext);
  const keywords = extractKeywords(context);
  const inferredCompany = company || parseBusinessContext(context).company || "Your Business";
  const inferredWebsite = website || parseBusinessContext(context).website;

  return {
    inferred_domain: domain.id,
    market: domain.market,
    city: domain.city,
    operating_model: domain.operating_model,
    inputs: mergeUnique(domain.inputs, keywords.slice(0, 6)),
    channels: inferChannels(normalizedContext, domain.channels),
    customers: domain.customers,
    watchlist: mergeUnique(domain.watchlist, keywords.slice(0, 8)),
    reaction_goal: domain.reaction_goal,
    search_terms: mergeUnique(
      [
        domain.market,
        domain.city,
        domain.operating_model,
        domain.customers,
        domain.reaction_goal,
        inferredCompany,
        inferredWebsite
      ],
      domain.inputs,
      domain.channels,
      domain.watchlist,
      keywords
    )
  };
}

export function buildCreatorBackground({ context, specialization }) {
  const domainInstruction = getDomainInstruction(specialization.inferred_domain);
  const lines = [
    context,
    specialization.market || specialization.city
      ? `Market/location: ${[specialization.city, specialization.market]
          .filter(Boolean)
          .join(", ")}.`
      : "",
    specialization.operating_model
      ? `Operating model: ${specialization.operating_model}.`
      : "",
    specialization.inputs.length
      ? `Cost, dependency, and signal inputs to monitor: ${specialization.inputs.join(", ")}.`
      : "",
    specialization.channels.length
      ? `Business channels: ${specialization.channels.join(", ")}.`
      : "",
    specialization.customers ? `Audience/customers: ${specialization.customers}.` : "",
    specialization.watchlist.length
      ? `Only surface news if it plausibly touches these risks/opportunities: ${specialization.watchlist.join(
          ", "
        )}.`
      : "",
    specialization.reaction_goal
      ? `Preferred reaction type: ${specialization.reaction_goal}.`
      : "",
    domainInstruction,
    "Be strict: prioritize operationally, commercially, or content-strategically actionable stories over generic cultural relevance. Exclude loose hooks unless they directly affect the inferred market, inputs, channels, audience, risks, or reaction goal above. Explain the concrete mechanism and immediate reaction."
  ];

  return lines.filter(Boolean).join("\n");
}

function getDomainInstruction(domain) {
  if (domain === "career-advice") {
    return "Career-advice strictness: do not surface general AI, tech, legal, crypto, or social-media stories unless the source event directly affects layoffs, hiring, job availability, recruiters, resumes, interviews, LinkedIn, workplace policy, compensation, labor demand, or job seekers.";
  }

  if (domain === "purpose-leadership") {
    return "Purpose/leadership strictness: surface stories only when the source event directly affects meaningful work, workplace purpose, leadership models, business owners, coaching/training demand, AI ethics or AI coaching tools, employee engagement, burnout, mental wellness, values-led business, entrepreneurship, memberships, speakers, or presenters. Exclude generic economy, celebrity, entertainment, or culture stories unless they create a clear purpose, leadership, coaching, or business-owner reaction.";
  }

  if (domain === "fried-chicken") {
    return "Restaurant strictness: do not surface generic entertainment or cultural hooks unless the story directly affects food safety, ingredients, poultry, oil, flour, fuel, delivery, labor, rent, consumer spending, or customer demand.";
  }

  if (domain === "food-wine-pr") {
    return "Agency strictness: do not surface broad lifestyle hooks unless they create a client counsel moment for food, wine, spirits, restaurants, hospitality, regulation, reputation, events, partnerships, or media strategy.";
  }

  return "";
}

function pickDomain(normalizedContext) {
  const scored = DOMAIN_PROFILES.map((profile) => ({
    profile,
    score: profile.keywords.reduce(
      (total, keyword) => total + (normalizedContext.includes(keyword) ? 1 : 0),
      0
    )
  })).sort((left, right) => right.score - left.score);

  if (scored[0].score > 0) {
    return scored[0].profile;
  }

  return {
    id: "general-business",
    market: "",
    city: "",
    operating_model: "business described by pasted context",
    inputs: ["costs", "demand", "labor", "regulation", "supply chain", "reputation"],
    channels: ["website", "social media", "direct sales"],
    customers: "customers and audience described by the pasted context",
    watchlist: [
      "regulation",
      "inflation",
      "supply chain",
      "labor",
      "consumer sentiment",
      "platform changes",
      "competition",
      "reputation risk"
    ],
    reaction_goal:
      "business action first: pricing, messaging, content, operations, customer communication"
  };
}

function inferChannels(normalizedContext, defaults) {
  const channels = [...defaults];
  const channelMap = [
    ["blog", "blog"],
    ["newsletter", "newsletter"],
    ["linkedin", "LinkedIn"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["twitter", "X/Twitter"],
    ["products", "products/services"],
    ["services", "services"],
    ["member", "membership"],
    ["course", "courses"]
  ];

  channelMap.forEach(([needle, channel]) => {
    if (normalizedContext.includes(needle)) {
      channels.push(channel);
    }
  });

  return mergeUnique(channels);
}

function extractKeywords(context) {
  const words = normalize(context)
    .split(" ")
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  const counts = new Map();

  words.forEach((word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([word]) => word)
    .slice(0, 24);
}

function matchLine(value, pattern) {
  const match = value.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function mergeUnique(...groups) {
  const seen = new Set();
  const merged = [];

  groups.flat().filter(Boolean).forEach((item) => {
    const clean = String(item).trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(clean);
  });

  return merged;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/g, " ")
    .replace(/[^a-z0-9/.+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "about",
  "also",
  "been",
  "blog",
  "company",
  "content",
  "copyright",
  "from",
  "have",
  "home",
  "into",
  "learn",
  "link",
  "more",
  "navigation",
  "page",
  "primary",
  "read",
  "search",
  "seen",
  "site",
  "skip",
  "that",
  "their",
  "this",
  "today",
  "website",
  "with",
  "your"
]);
