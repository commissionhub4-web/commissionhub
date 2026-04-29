const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api";

interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const base = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    params.set(key, String(value));
  });
  const suffix = params.toString();
  return suffix ? `${base}?${suffix}` : base;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, body, ...rest } = options;
  const response = await fetch(buildUrl(path, query), {
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
    ...rest,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (errorBody.detail) message = errorBody.detail;
    } catch {
      // ignore parse error and keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export { API_BASE_URL };
