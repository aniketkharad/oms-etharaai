import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  // order form state
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }])
  const [formError, setFormError] = useState('')

  const load = () =>
    Promise.all([api.listOrders(), api.listCustomers(), api.listProducts()])
      .then(([o, c, p]) => {
        setOrders(o)
        setCustomers(c)
        setProducts(p)
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [String(p.id), p])), [products])

  // Live preview of the total (the backend recomputes authoritatively).
  const previewTotal = lines.reduce((sum, l) => {
    const p = productById[l.product_id]
    return p ? sum + Number(p.price) * (Number(l.quantity) || 0) : sum
  }, 0)

  const openModal = () => {
    setCustomerId('')
    setLines([{ product_id: '', quantity: 1 }])
    setFormError('')
    setOpen(true)
  }

  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const submit = async () => {
    setFormError('')
    if (!customerId) return setFormError('Select a customer.')
    const cleaned = lines.filter((l) => l.product_id)
    if (cleaned.length === 0) return setFormError('Add at least one product.')
    if (cleaned.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1))
      return setFormError('Quantities must be whole numbers of at least 1.')
    const ids = cleaned.map((l) => l.product_id)
    if (new Set(ids).size !== ids.length)
      return setFormError('The same product appears twice — combine it into one line.')

    // Friendly pre-check (backend still enforces this atomically).
    for (const l of cleaned) {
      const p = productById[l.product_id]
      if (p && Number(l.quantity) > p.quantity)
        return setFormError(`Only ${p.quantity} unit(s) of "${p.name}" in stock.`)
    }

    setSaving(true)
    try {
      await api.createOrder({
        customer_id: Number(customerId),
        items: cleaned.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) })),
      })
      toast('Order placed — stock updated')
      setOpen(false)
      load()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (o) => {
    if (!window.confirm(`Cancel order #${o.id}? Stock will be restored.`)) return
    try {
      await api.deleteOrder(o.id)
      toast('Order cancelled — stock restored')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p>Placing an order reduces stock; cancelling restores it.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>+ Create order</button>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="loading">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="empty">
            <strong>No orders yet</strong>
            Create an order once you have products and customers.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th className="right">Items</th>
                <th className="right">Total</th>
                <th>Placed</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  expanded={expanded === o.id}
                  onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
                  onCancel={() => cancel(o)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title="Create order" onClose={() => setOpen(false)}>
          <div className="field">
            <label htmlFor="o-customer">Customer</label>
            <select id="o-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Items</label>
            {lines.map((l, i) => (
              <div className="line-item" key={i}>
                <select value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })}>
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                      {p.name} ({p.quantity} in stock)
                    </option>
                  ))}
                </select>
                <input
                  type="number" min="1" step="1" value={l.quantity} aria-label="Quantity"
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
                <button
                  className="icon-btn" aria-label="Remove line"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  disabled={lines.length === 1}
                >×</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setLines([...lines, { product_id: '', quantity: 1 }])}>
              + Add line
            </button>
          </div>

          <div className="line-total">Estimated total: ₹{previewTotal.toFixed(2)}</div>
          {formError && <div className="err" style={{ marginTop: 8, color: 'var(--danger)', fontSize: 13.5 }}>{formError}</div>}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Placing…' : 'Place order'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function OrderRow({ order, expanded, onToggle, onCancel }) {
  const placed = new Date(order.created_at).toLocaleString()
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td className="mono">#{order.id}</td>
        <td>{order.customer_name || `Customer ${order.customer_id}`}</td>
        <td className="right mono">{order.items.length}</td>
        <td className="right mono">₹{Number(order.total_amount).toFixed(2)}</td>
        <td className="muted">{placed}</td>
        <td className="right" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={onToggle}>{expanded ? 'Hide' : 'Details'}</button>{' '}
          <button className="btn btn-danger-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </td>
      </tr>
      {expanded && (
        <tr className="order-detail">
          <td colSpan={6}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="right">Qty</th>
                  <th className="right">Unit price</th>
                  <th className="right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product_name || `Product ${it.product_id}`}</td>
                    <td className="right mono">{it.quantity}</td>
                    <td className="right mono">₹{Number(it.unit_price).toFixed(2)}</td>
                    <td className="right mono">₹{Number(it.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
