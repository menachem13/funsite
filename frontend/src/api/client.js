const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "funsite_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Thin fetch wrapper: attaches the JWT if present, parses JSON, and throws
 * ApiError (with the backend's own message) on a non-2xx response.
 */
async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // A 401 on a request that carried a token means that token is stale
    // (expired or otherwise invalid) — the account itself may still be
    // fine, it's just no longer a valid session. Notify AuthContext so it
    // can log out and redirect once, instead of every protected page on
    // its own showing a generic "couldn't load" error for what's really a
    // session problem. A 401 with no token attached (e.g. a wrong-password
    // login attempt) is just a normal request error, left to the caller.
    //
    // The "show a session-expired notice" signal lives in sessionStorage,
    // not a ?expired= URL param: logging out flips `user` to null, and
    // ProtectedRoute (on whatever protected page triggered this) reacts to
    // that on its own with its own bare `/login` redirect — a second,
    // independent navigation racing this one. Whichever wins, the URL it
    // lands on can't be relied on to carry state; sessionStorage survives
    // either.
    if (res.status === 401 && token) {
      setToken(null);
      try {
        sessionStorage.setItem("funsite_session_expired", "1");
      } catch {
        // Private browsing / storage disabled — the notice just won't show;
        // the user is still correctly logged out and redirected either way.
      }
      window.dispatchEvent(new Event("funsite:session-expired"));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

// Uploaded media is served from the backend's origin at /uploads/..., not
// under /api — strip that suffix to get the plain origin.
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");
export function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export { API_URL };
