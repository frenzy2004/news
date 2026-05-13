# BTW Business Relevance JSON Generator

Generate a local JSON report of live BTW stories that matter to specific businesses. The v1 implementation uses only the BTW API: it calls `/api/creator` for business relevance, then uses `/api/trends/search` to pull deep trend objects with article links, key points, entities, discourse notes, sentiment, dates, and source coverage.

## Setup

Requires Node.js 22 or newer.

```powershell
$env:BTW_API_KEY = "your_btw_api_key_here"
$env:EXA_API_KEY = "your_exa_api_key_here"
$env:OPENAI_API_KEY = "your_fresh_openai_api_key_here"
npm test
npm run generate
```

The default report is written to:

```text
reports/business-relevance.json
```

Generated reports and local secrets are ignored by git.

## Commands

```powershell
npm run generate
node src/cli.js --out reports/custom.json
node src/cli.js --date-range Week
node src/cli.js --profile teuwen
node src/cli.js --profile careersherpa
node src/cli.js --context "I run a fried chicken shop" --company "Fried Chicken Shop" --out reports/fried-chicken.json
```

## Output

The report contains one business object per profile, each with normalized relevance items:

```json
{
  "generated_at": "2026-05-06T00:00:00.000Z",
  "date_range": "Now",
  "source": {
    "provider": "BTW",
    "endpoints": ["/api/creator", "/api/trends/detailed"]
  },
  "businesses": [
    {
      "id": "teuwen",
      "company": "Teuwen",
      "website": "http://www.teuwen.com",
      "items": []
    }
  ],
  "errors": []
}
```

If one business fails, the generator still writes the other business results and records the failure in `errors`. If `BTW_API_KEY` is missing, it exits cleanly without writing a report.

Each item includes BTW's business-specific `why_relevant` reason plus deep trend fields such as `key_points`, `discourse_notes`, `entities`, `key_dates`, `sentiment`, `article_count`, and `articles[].url`.

## Evidence chat

The Next.js UI includes a source-grounded chat drawer after a scan finishes. It sends the selected BTW report evidence to `/api/chat`, uses the OpenAI Responses API server-side, and asks the model to answer only from the evidence pack with article citations. Keep `OPENAI_API_KEY` server-only in `.env` or Vercel environment variables; never expose it with `NEXT_PUBLIC_`.

## Sparse query and entity handling

When a short person, company, or keyword query is entered, the API treats it as an entity-resolution problem before showing raw results. If `EXA_API_KEY` is configured, it runs multiple targeted source searches across official, community, founder, project, and professional-profile lenses, builds a source-backed profile, then uses the enriched context to search BTW for nearby live or historical signals.

Direct BTW matches are labeled `adjacent`. Source-grounded identity context is labeled `background` so it is not confused with live news.
