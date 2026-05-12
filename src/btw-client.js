import { BtwApiError } from "./errors.js";

const DEFAULT_BASE_URL = "https://btw.co";

export class BtwClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch }) {
    if (!fetchImpl) {
      throw new Error("A fetch implementation is required.");
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
  }

  async discoverCreatorStories({ creatorBackground, dateRange }) {
    return this.#request("/api/creator", {
      method: "POST",
      body: {
        CreatorBackground: creatorBackground,
        DateRange: dateRange
      }
    });
  }

  async fetchDetailedStories(input) {
    const body = Array.isArray(input)
      ? {
          StoryIds: input
        }
      : buildTrendsBody(input);

    if (Array.isArray(body.StoryIds) && body.StoryIds.length === 0) {
      return { Stories: [] };
    }

    return this.#request("/api/trends/detailed", {
      method: "POST",
      body
    });
  }

  async listTrendingStories(input = {}) {
    return this.#request("/api/trends/list", {
      method: "POST",
      body: buildTrendsBody(input)
    });
  }

  async searchTrends(query) {
    return this.#request("/api/trends/search", {
      method: "POST",
      body: {
        Query: query
      }
    });
  }

  async #request(endpoint, { method, body }) {
    const url = new URL(endpoint, this.baseUrl);
    const response = await this.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();
    const parsedBody = parseJson(responseText);

    if (!response.ok) {
      throw new BtwApiError(
        `BTW request failed for ${endpoint} with status ${response.status}.`,
        {
          endpoint,
          status: response.status,
          body: parsedBody ?? responseText
        }
      );
    }

    if (parsedBody === null) {
      throw new BtwApiError(`BTW returned invalid JSON for ${endpoint}.`, {
        endpoint,
        status: response.status,
        body: responseText
      });
    }

    return parsedBody;
  }
}

function buildTrendsBody({ storyIds, categoryKeys, num } = {}) {
  return {
    ...(Array.isArray(storyIds) && storyIds.length ? { StoryIds: storyIds } : {}),
    ...(Array.isArray(categoryKeys) && categoryKeys.length
      ? { CategoryKeys: categoryKeys }
      : {}),
    ...(Number.isInteger(num) ? { Num: num } : {})
  };
}

function parseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
