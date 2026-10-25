let refreshPromise: Promise<boolean> | undefined;

async function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status !== 401 || typeof window === "undefined") return response;

  const refreshed = await refreshTokens();
  if (!refreshed) {
    window.location.assign("/login");
    return response;
  }

  return fetch(input, init);
}
