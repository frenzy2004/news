import { ExaApiError } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.exa.ai";

export class ExaClient {
  constructor({
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch
  } = {}) {
    if (!fetchImpl) {
      throw new Error("A fetch implementation is required.");
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
  }

  async search({ query, numResults = 6, maxCharacters = 900 }) {
    return this.#request("/search", {
      method: "POST",
      body: {
        query,
        numResults,
        contents: {
          text: {
            maxCharacters
          }
        }
      }
    });
  }

  async #request(endpoint, { method, body }) {
    const url = new URL(endpoint, this.baseUrl);
    const response = await this.fetch(url, {
      method,
      headers: {
        "x-api-key": this.apiKey,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    const responseText = await response.text();
    const parsedBody = parseJson(responseText);

    if (!response.ok) {
      throw new ExaApiError(
        `Exa request failed for ${endpoint} with status ${response.status}.`,
        {
          endpoint,
          status: response.status,
          body: parsedBody ?? responseText
        }
      );
    }

    if (parsedBody === null) {
      throw new ExaApiError(`Exa returned invalid JSON for ${endpoint}.`, {
        endpoint,
        status: response.status,
        body: responseText
      });
    }

    return parsedBody;
  }
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
