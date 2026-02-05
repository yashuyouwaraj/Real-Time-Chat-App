import axios, {
  type AxiosRequestConfig,
  type AxiosError,
  type AxiosInstance,
} from "axios";

export function createBrowserApiClient(
  getToken: () => Promise<string | null>,
): AxiosInstance {
  // Determine API base URL with proper fallback chain:
  // 1. Environment variable (set at build time)
  // 2. Runtime detection from window
  // 3. Fallback to localhost
  let baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
  
  if (typeof window !== 'undefined') {
    // At runtime, if we have the env var, use it (highest priority)
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      // Otherwise, always use localhost:5000 for local development
      // Backend is running locally, not on the network interface
      baseURL = "http://localhost:5000";
    }
  }
  
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
