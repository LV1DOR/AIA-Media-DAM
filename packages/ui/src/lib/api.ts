export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body &&
      !(options.body instanceof FormData) &&
      !(options.body instanceof Blob)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "The request could not be completed",
      response.status,
    );
  return data;
}
export const post = (path: string, body: unknown = {}) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
