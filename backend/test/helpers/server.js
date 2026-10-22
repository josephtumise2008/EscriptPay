// Starts the real Express app on an ephemeral port for HTTP-level tests.
const startServer = async (app) => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, close: () => new Promise((r) => server.close(r)) };
};

// Tiny cookie-aware client so tests exercise the real httpOnly-cookie auth.
const createClient = (baseUrl) => {
  let cookie = "";
  const request = async (method, path, body, headers = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  };
  return {
    get: (p, h) => request("GET", p, undefined, h),
    post: (p, b, h) => request("POST", p, b, h),
    put: (p, b, h) => request("PUT", p, b, h),
    clearCookie: () => {
      cookie = "";
    },
  };
};

module.exports = { startServer, createClient };
