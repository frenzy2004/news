export function createMockFetch(routes) {
  return async function mockFetch(input, init = {}) {
    const url = new URL(input);
    const route = routes[url.pathname];

    if (!route) {
      return jsonResponse(
        {
          error: `No mock route for ${url.pathname}`
        },
        { status: 404 }
      );
    }

    const requestBody = init.body ? JSON.parse(init.body) : undefined;
    const result = await route({ url, init, body: requestBody });

    if (result?.status && result.status >= 400) {
      return jsonResponse(result.body, { status: result.status });
    }

    return jsonResponse(result);
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}
