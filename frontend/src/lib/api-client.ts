import axios, {
  type AxiosRequestConfig,
  type AxiosError,
  type AxiosInstance,
} from "axios";

const LOCAL_API = "http://localhost:5000";

/** Direct backend URL (Render). Used for Socket.io and server-side calls. */
export function getBackendOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_PROXY_TARGET ||
    LOCAL_API
  ).replace(/\/$/, "");
}

/**
 * Base URL for REST API calls.
 * In the browser we use same-origin paths so Next.js rewrites proxy to Render (no CORS).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  return getBackendOrigin();
}

export function createBrowserApiClient(
  getToken: () => Promise<string | null>,
): AxiosInstance {
  const baseURL = getApiBaseUrl();

  const client = axios.create({
    baseURL,
    withCredentials: false,
  });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      return Promise.reject(error);
    },
  );

  return client;
}

export async function apiGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.get<{ data: T }>(url, config);

  return response.data.data;
}

export async function apiPost<TBody, TResponse>(
  client: AxiosInstance,
  url: string,
  body: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const res = await client.post<{ data: TResponse }>(url, body, config);

  // Handle 204 No Content responses
  if (res.status === 204 || !res.data) {
    return undefined as TResponse;
  }

  return res.data.data;
}

export async function apiPatch<TBody, TResponse>(
  client: AxiosInstance,
  url: string,
  body: TBody,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const res = await client.patch<{ data: TResponse }>(url, body, config);

  return res.data.data;
}

export async function apiDelete<TResponse>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
): Promise<TResponse> {
  const res = await client.delete<{ data: TResponse }>(url, config);

  // Handle 204 No Content responses
  if (res.status === 204 || !res.data) {
    return undefined as TResponse;
  }

  return res.data.data;
}
