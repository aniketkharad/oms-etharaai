import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useToast } from '../components/Toast.jsx'

export default function Dashboard({ goTo }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  if (loading) return <div className="loading">Loading dashboard…</div>
  if (!stats) return <div className="empty"><strong>Couldn't load stats</strong>Check that the backend is reachable.</div>

  const cards = [
    { label: 'Total products', value: stats.total_products, page: 'products' },
    { label: 'Total customers', value: stats.total_customers, page: 'customers' },
    { label: 'Total orders', value: stats.total_orders, page: 'orders' },
    { label: 'Low stock items', value: stats.low_stock_products.length, page: 'products' },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>A live summary of your inventory and sales activity.</p>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card stat"
            style={{ cursor: 'pointer' }}
            onClick={() => goTo(c.page)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && goTo(c.page)}
          >
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="section-title">
        Low stock (≤ {stats.low_stock_threshold} units)
      </div>
      <div className="card table-wrap">
        {stats.low_stock_products.length === 0 ? (
          <div className="empty">
            <strong>All stocked up</strong>
            No products are at or below the low-stock threshold.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="right">Units left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.low_stock_products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td className="right mono">{p.quantity}</td>
                  <td>
                    {p.quantity === 0 ? (
                      <span className="chip chip-danger">Out of stock</span>
                    ) : (
                      <span className="chip chip-warn">Low stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
