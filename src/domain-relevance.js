const DOMAIN_RULES = {
  "purpose-leadership": {
    sourceRequired: false,
    strongTerms: [
      "purpose",
      "meaning",
      "meaningful",
      "mission",
      "values",
      "calling",
      "leadership",
      "leader",
      "ceo",
      "founder",
      "entrepreneur",
      "business owner",
      "workplace",
      "work",
      "workers",
      "labor",
      "wage",
      "employee",
      "engagement",
      "burnout",
      "wellbeing",
      "mental health",
      "productivity",
      "performance",
      "coaching",
      "coach",
      "training",
      "speaker",
      "presenter",
      "membership",
      "personal development",
      "profit",
      "ai ethics",
      "ai coaching"
    ],
    weakTerms: ["celebrity", "sports", "movie", "music", "crypto", "meme"],
    areas: [
      {
        area: "Purpose at work",
        terms: [
          "purpose",
          "meaning",
          "meaningful",
          "calling",
          "workplace",
          "work",
          "workers",
          "employee",
          "burnout",
          "mental health"
        ],
        audience:
          "professionals, leaders, and purpose seekers trying to connect work with calling",
        mechanism:
          "The story changes how people think about meaning, motivation, work pressure, or purpose-driven decisions.",
        action:
          "Turn it into a reflection prompt, coaching exercise, or practical lesson on staying on-purpose in changing work conditions.",
        angle: "How to stay on-purpose when work is changing"
      },
      {
        area: "Leadership and business purpose",
        terms: [
          "leadership",
          "leader",
          "ceo",
          "founder",
          "entrepreneur",
          "business owner",
          "mission",
          "values",
          "profit",
          "performance"
        ],
        audience: "business owners, executives, coaches, and licensed presenters",
        mechanism:
          "The story creates a leadership lesson about mission, values, profit, decision-making, or organizational purpose.",
        action:
          "Create a leadership note with discussion questions, presenter talking points, and a business-owner application.",
        angle: "What this leadership moment teaches about purpose and profit"
      },
      {
        area: "Coaching and training demand",
        terms: [
          "coaching",
          "coach",
          "training",
          "speaker",
          "presenter",
          "membership",
          "personal development",
          "engagement",
          "productivity"
        ],
        audience: "coaches, speakers, trainers, members, and program buyers",
        mechanism:
          "The story can shift demand for coaching, leadership development, presenter materials, or membership lessons.",
        action:
          "Package it as a workshop prompt, member lesson, or speaker-ready example.",
        angle: "A timely coaching prompt for purpose-driven leaders"
      },
      {
        area: "AI and human purpose",
        terms: ["ai", "ai ethics", "ai coaching", "automation", "productivity", "values"],
        audience:
          "professionals and leaders deciding how technology fits with human purpose",
        mechanism:
          "The story raises questions about ethical AI, human judgment, productivity, and values-led leadership.",
        action:
          "Explain how to use AI without outsourcing purpose, values, or leadership responsibility.",
        angle: "How to use AI without losing your purpose"
      }
    ]
  },
  "career-advice": {
    sourceRequired: true,
    strongTerms: [
      "layoff",
      "layoffs",
      "laid off",
      "laying off",
      "workforce reduction",
      "workforce",
      "jobless",
      "jobs",
      "job market",
      "job seekers",
      "hiring",
      "hiring freeze",
      "recruiter",
      "recruiting",
      "resume",
      "interview",
      "linkedin",
      "employment",
      "unemployment",
      "workers",
      "workplace",
      "labor",
      "wage",
      "salary",
      "promotion",
      "dei",
      "eeoc",
      "remote work",
      "skills"
    ],
    weakTerms: ["ai", "automation", "social media", "lawsuit", "platform", "crypto"],
    areas: [
      {
        area: "Layoff response",
        terms: ["layoff", "layoffs", "laid off", "laying off", "jobless", "workforce reduction"],
        audience: "laid-off workers, worried employees, and job seekers tracking unstable sectors",
        mechanism:
          "The story changes target-company risk, sector confidence, and the skills job seekers need to emphasize.",
        action:
          "Publish a layoff-response brief, update target-employer advice, and give readers a resume/LinkedIn positioning checklist.",
        angle: "What this layoff signal means for job seekers this week"
      },
      {
        area: "Hiring-market shift",
        terms: ["hiring", "job market", "employment", "unemployment", "labor", "workers", "wage", "salary"],
        audience: "active job seekers and career changers deciding where to focus applications",
        mechanism:
          "The story points to changing demand, compensation pressure, or sector-level job availability.",
        action:
          "Turn it into a job-search targeting note with sectors to watch, keywords to add, and roles to avoid or pursue.",
        angle: "Where job seekers should adjust their search now"
      },
      {
        area: "Recruiting and AI tools",
        terms: ["recruiter", "recruiting", "resume", "interview", "linkedin", "ai", "automation"],
        audience: "professionals using AI, LinkedIn, resumes, and interviews to stand out",
        mechanism:
          "The story affects how candidates are screened, how they present themselves, or how recruiters evaluate signals.",
        action:
          "Create practical guidance on safe AI use, resume proof points, LinkedIn positioning, and interview prep.",
        angle: "How to use AI and LinkedIn without weakening your job search"
      },
      {
        area: "Workplace policy and legal risk",
        terms: ["eeoc", "dei", "promotion", "discrimination", "workplace", "employment"],
        audience: "employees, managers, and candidates navigating workplace fairness and hiring rules",
        mechanism:
          "The story can change promotion, hiring, and workplace communication norms that candidates need to understand.",
        action:
          "Explain what candidates should document, how to discuss experience, and which interview questions to handle carefully.",
        angle: "What this workplace ruling changes for candidates"
      }
    ]
  },
  "fried-chicken": {
    sourceRequired: false,
    strongTerms: [
      "chicken",
      "poultry",
      "food safety",
      "salmonella",
      "recall",
      "cooking oil",
      "palm oil",
      "oil prices",
      "flour",
      "fuel",
      "delivery",
      "restaurant",
      "minimum wage",
      "rent",
      "consumer spending"
    ],
    weakTerms: ["holiday", "trend", "music", "film", "social media"],
    areas: [
      {
        area: "Food safety and trust",
        terms: ["food safety", "salmonella", "recall", "poultry", "chicken"],
        audience: "customers deciding whether the shop is safe and reliable",
        mechanism:
          "Food-safety news can change customer trust, supplier checks, and front-of-house messaging.",
        action:
          "Check suppliers, document freshness controls, and post a short safety/trust message before questions appear.",
        angle: "How we keep chicken safe when food recalls are in the news"
      },
      {
        area: "Input-cost pressure",
        terms: ["oil", "palm oil", "flour", "fuel", "wage", "rent", "consumer spending"],
        audience: "owners watching margins and customers reacting to price changes",
        mechanism:
          "The story affects delivery fees, ingredient costs, menu pricing, or customer spending power.",
        action:
          "Review supplier prices, protect best-margin combos, and prepare a value offer before margins get squeezed.",
        angle: "What this cost move means for fried chicken prices"
      }
    ]
  },
  "food-wine-pr": {
    sourceRequired: false,
    strongTerms: [
      "food",
      "wine",
      "spirits",
      "restaurant",
      "hospitality",
      "recall",
      "tariff",
      "alcohol",
      "beverage",
      "consumer sentiment",
      "travel",
      "event",
      "brand"
    ],
    weakTerms: ["celebrity", "film", "music", "social media"],
    areas: [
      {
        area: "Client counsel",
        terms: ["food", "wine", "spirits", "restaurant", "hospitality", "brand"],
        audience: "food, beverage, hospitality, and lifestyle brand clients",
        mechanism:
          "The story creates a brand-risk, earned-media, or consumer-demand moment clients may need to address.",
        action:
          "Draft a client advisory with the risk, media angle, suggested spokespeople, and timing.",
        angle: "Client advisory: what this story changes for food and beverage brands"
      },
      {
        area: "Reputation and safety",
        terms: ["recall", "food safety", "regulation", "tariff", "alcohol"],
        audience: "brands needing reputation protection and clear public messaging",
        mechanism:
          "The story can affect trust, compliance, pricing, or category reputation.",
        action:
          "Prepare holding statements, Q&A, and earned-media guidance before reporters or customers ask.",
        angle: "How brands should message this risk"
      }
    ]
  }
};

export function evaluateBusinessRelevance({ profile, story }) {
  const domain = profile.specialization?.inferred_domain ?? "general-business";
  const rules = DOMAIN_RULES[domain];
  const sourceText = normalize(
    [
      story.title,
      story.summary,
      story.theme,
      story.category_keys.join(" "),
      Object.values(story.subcategories).flat().join(" "),
      story.key_points.join(" "),
      story.discourse_notes.join(" "),
      story.entities.join(" ")
    ].join(" ")
  );
  const reasonText = normalize(story.why_relevant);

  if (!rules) {
    return buildGeneralRelevance({ story });
  }

  const sourceStrongSignals = findHits(rules.strongTerms, sourceText);
  const reasonStrongSignals = findHits(rules.strongTerms, reasonText);
  const weakSignals = findHits(rules.weakTerms, `${sourceText} ${reasonText}`);
  const area = chooseArea(rules.areas, `${sourceText} ${reasonText}`);
  const allowed = rules.sourceRequired
    ? sourceStrongSignals.length > 0
    : sourceStrongSignals.length > 0 || reasonStrongSignals.length > 0;

  if (!allowed) {
    return {
      decision: "cut",
      impact_area: "Weak fit",
      audience: "",
      business_mechanism: "",
      recommended_reaction: "",
      content_angle: "",
      why_allowed: "",
      cut_reason:
        "Cut because the underlying BTW story does not contain a direct domain signal; the connection only appears as a loose interpretation.",
      source_signals: [],
      reason_signals: reasonStrongSignals,
      weak_signals: weakSignals
    };
  }

  return {
    decision: "show",
    impact_area: area.area,
    audience: area.audience,
    business_mechanism: area.mechanism,
    recommended_reaction: area.action,
    content_angle: area.angle,
    why_allowed: `Allowed because the source story contains ${sourceStrongSignals
      .slice(0, 4)
      .join(", ")}.`,
    cut_reason: "",
    source_signals: sourceStrongSignals,
    reason_signals: reasonStrongSignals,
    weak_signals: weakSignals
  };
}

export function relevanceScoreBonus(relevance) {
  if (relevance.decision === "cut") {
    return -100;
  }

  const sourceSignalBonus = relevance.source_signals.length * 12;
  const reasonSignalBonus = relevance.reason_signals.length * 6;
  const signalAlignmentBonus =
    relevance.source_signals.length > 0 && relevance.reason_signals.length > 0
      ? 18
      : 0;

  return sourceSignalBonus + reasonSignalBonus + signalAlignmentBonus;
}

function buildGeneralRelevance({ story }) {
  return {
    decision: "show",
    impact_area: "Business signal",
    audience: "the audience described in the pasted business context",
    business_mechanism:
      "The story may affect costs, demand, regulation, reputation, channels, or customer behavior.",
    recommended_reaction:
      "Review the story against the business context and decide whether to message customers, adjust operations, or create content.",
    content_angle: `Why ${story.title} may matter to this business`,
    why_allowed: "Allowed by general-business fallback.",
    cut_reason: "",
    source_signals: [],
    reason_signals: [],
    weak_signals: []
  };
}

function chooseArea(areas, text) {
  const scored = areas
    .map((area) => ({
      area,
      score: findHits(area.terms, text).length
    }))
    .sort((left, right) => right.score - left.score);

  return scored[0].score > 0 ? scored[0].area : areas[0];
}

function findHits(terms, text) {
  return terms.filter((term) => text.includes(normalize(term)));
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
