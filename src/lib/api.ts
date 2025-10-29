export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const defaultApiBase = '/api'

function buildUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE ?? defaultApiBase
  if (!path.startsWith('/')) {
    // ensure single slash between base and path
    return `${base}/${path}`
  }
  return `${base}${path}`
}

// Auth token and unauthorized handler hooks are set by the auth/session layer.
let authTokenGetter: (() => string | undefined) | undefined
let unauthorizedHandler: (() => void) | undefined

export function setAuthTokenGetter(getter: () => string | undefined) {
  authTokenGetter = getter
}

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export async function apiFetch<TResponse>(
  path: string,
  options: {
    method?: HttpMethod
    headers?: Record<string, string>
    body?: unknown
    // when true, we send body as JSON and parse JSON
    json?: boolean
    // pass through fetch init overrides if needed later
    credentials?: RequestCredentials
    signal?: AbortSignal
  } = {},
): Promise<TResponse> {
  const { method = 'GET', headers = {}, body, json = true, credentials, signal } = options

  const finalHeaders: Record<string, string> = { ...headers }
  let payload: BodyInit | undefined

  if (json) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] ?? 'application/json'
  }

  // Attach Authorization header if available
  const token = authTokenGetter?.()
  if (token) {
    finalHeaders['Authorization'] = finalHeaders['Authorization'] ?? `Bearer ${token}`
  }

  if (body !== undefined) {
    payload = json ? JSON.stringify(body) : (body as BodyInit)
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: finalHeaders,
    body: payload,
    credentials,
    signal,
  })

  // Centralized 401 handling: notify auth layer, then throw.
  if (response.status === 401) {
    try {
      unauthorizedHandler?.()
    } catch {
      // no-op
    }
    const text = await response.text().catch(() => '')
    throw new Error(`API ${method} ${path} failed: 401 Unauthorized ${text}`)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `API ${method} ${path} failed: ${response.status} ${response.statusText} ${text}`,
    )
  }

  if (response.status === 204) {
    return undefined as unknown as TResponse
  }

  if (json) {
    // Defensive parsing: read text first, then try JSON.parse, else return raw text.
    const raw = await response.text().catch(() => '')
    if (!raw) {
      return undefined as unknown as TResponse
    }
    try {
      return JSON.parse(raw) as TResponse
    } catch {
      return raw as unknown as TResponse
    }
  }

  // @ts-expect-error caller must cast when json=false
  return response
}
