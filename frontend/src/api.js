// Single place where the frontend talks to the backend.
// The base URL is injected at build time via VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0)
  }

  if (res.status === 204) return null

  let body = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    // FastAPI puts messages in `detail` — either a string or a list of
    // validation errors. Normalise both into one readable string.
    let message = `Request failed (${res.status})`
    if (body?.detail) {
      message = Array.isArray(body.detail)
        ? body.detail.map((d) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join('; ')
        : body.detail
    }
    throw new ApiError(message, res.status)
  }
  return body
}

export const api = {
  // Products
  listProducts: () => request('/products'),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Customers
  listCustomers: () => request('/customers'),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  // Orders
  listOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE' }),

  // Dashboard
  stats: () => request('/stats'),
}
