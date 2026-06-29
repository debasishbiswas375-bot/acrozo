export const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

/**
 * Returns the backend base URL.
 * - In production: uses VITE_API_URL env var (e.g. https://your-backend.onrender.com)
 * - In development: returns "" so all /api/* requests go through Vite's proxy
 *   automatically — no matter what port the backend is running on.
 */
export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? "";
}


export function setToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");
  }
}

export function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  localStorage.removeItem("is_admin");
  localStorage.removeItem("username");
  localStorage.removeItem("avatar_url");
  // Clear remember token cookie
  document.cookie = "remember_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

export function isLoggedIn() {
  return Boolean(getToken());
}

// Check if user is authenticated (either JWT or remember token)
export async function checkAuthStatus() {
  try {
    // Try to make an authenticated request to FastAPI backend
    const token = getToken();
    const response = await fetch(`${getApiUrl()}/api/my-plan`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return { authenticated: false, user: { is_admin: false } };
    }

    const data = await response.json();
    return { authenticated: true, user: { is_admin: data.user?.is_admin || false } };
  } catch (error) {
    return { authenticated: false, user: { is_admin: false } };
  }
}

export function getStoredUsername() {
  return localStorage.getItem("username") || "";
}

export function isAdmin() {
  return localStorage.getItem("is_admin") === "true";
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include', // Include cookies for remember token
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}
