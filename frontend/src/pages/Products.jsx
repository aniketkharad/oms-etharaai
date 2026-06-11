import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

const EMPTY = { name: '', sku: '', price: '', quantity: '' }

function validate(form) {
  const errs = {}
  if (!form.name.trim()) errs.name = 'Product name is required.'
  if (!form.sku.trim()) errs.sku = 'SKU is required.'
  const price = Number(form.price)
  if (form.price === '' || Number.isNaN(price)) errs.price = 'Enter a valid price.'
  else if (price < 0) errs.price = 'Price cannot be negative.'
  const qty = Number(form.quantity)
  if (form.quantity === '' || !Number.isInteger(qty)) errs.quantity = 'Enter a whole number.'
  else if (qty < 0) errs.quantity = 'Quantity cannot be negative.'
  return errs
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | {mode:'add'} | {mode:'edit', product}
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () =>
    api
      .listProducts()
      .then(setProducts)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (mode, product = null) => {
    setErrors({})
    setForm(
      product
        ? { name: product.name, sku: product.sku, price: product.price, quantity: String(product.quantity) }
        : EMPTY,
    )
    setModal({ mode, product })
  }

  const submit = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price).toFixed(2),
      quantity: Number(form.quantity),
    }
    try {
      if (modal.mode === 'add') {
        await api.createProduct(payload)
        toast('Product created')
      } else {
        await api.updateProduct(modal.product.id, payload)
        toast('Product updated')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" (${p.sku})? This cannot be undone.`)) return
    try {
      await api.deleteProduct(p.id)
      toast('Product deleted')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const maxQty = Math.max(10, ...products.map((p) => p.quantity))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>Catalogue and live stock levels.</p>
        </div>
        <button className="btn btn-primary" onClick={() => open('add')}>+ Add product</button>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="loading">Loading products…</div>
        ) : products.length === 0 ? (
          <div className="empty">
            <strong>No products yet</strong>
            Add your first product to start tracking inventory.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th className="right">Price</th>
                <th>Stock</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td className="right mono">₹{Number(p.price).toFixed(2)}</td>
                  <td>
                    <div className="stock-cell">
                      <div className="stock-bar">
                        <span
                          className={p.quantity === 0 ? 'out' : p.quantity <= 5 ? 'low' : ''}
                          style={{ width: `${Math.min(100, (p.quantity / maxQty) * 100)}%` }}
                        />
                      </div>
                      <span className="mono">{p.quantity}</span>
                    </div>
                  </td>
                  <td className="right">
                    <button className="btn btn-ghost btn-sm" onClick={() => open('edit', p)}>Edit</button>{' '}
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add product' : `Edit ${modal.product.name}`} onClose={() => setModal(null)}>
          <div className="field">
            <label htmlFor="p-name">Product name</label>
            <input id="p-name" className={errors.name ? 'invalid' : ''} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless mouse" />
            {errors.name && <div className="err">{errors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="p-sku">SKU / code</label>
            <input id="p-sku" className={errors.sku ? 'invalid' : ''} value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. WM-2041" />
            {errors.sku && <div className="err">{errors.sku}</div>}
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="p-price">Price (₹)</label>
              <input id="p-price" type="number" min="0" step="0.01" className={errors.price ? 'invalid' : ''}
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              {errors.price && <div className="err">{errors.price}</div>}
            </div>
            <div className="field">
              <label htmlFor="p-qty">Quantity in stock</label>
              <input id="p-qty" type="number" min="0" step="1" className={errors.quantity ? 'invalid' : ''}
                value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
              {errors.quantity && <div className="err">{errors.quantity}</div>}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : modal.mode === 'add' ? 'Create product' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
