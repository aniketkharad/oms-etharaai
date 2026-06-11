import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Modal from '../components/Modal.jsx'
import { useToast } from '../components/Toast.jsx'

const EMPTY = { full_name: '', email: '', phone: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errs = {}
  if (!form.full_name.trim()) errs.full_name = 'Full name is required.'
  if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.'
  if (form.phone.trim().length < 5) errs.phone = 'Enter a valid phone number.'
  return errs
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () =>
    api
      .listCustomers()
      .then(setCustomers)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await api.createCustomer({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      })
      toast('Customer added')
      setOpen(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c) => {
    if (!window.confirm(`Delete customer "${c.full_name}"? Their orders will also be removed.`)) return
    try {
      await api.deleteCustomer(c.id)
      toast('Customer deleted')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>Everyone who can place an order.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setErrors({}); setForm(EMPTY); setOpen(true) }}>
          + Add customer
        </button>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="loading">Loading customers…</div>
        ) : customers.length === 0 ? (
          <div className="empty">
            <strong>No customers yet</strong>
            Add a customer before creating orders.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td className="mono">{c.email}</td>
                  <td className="mono">{c.phone}</td>
                  <td className="right">
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title="Add customer" onClose={() => setOpen(false)}>
          <div className="field">
            <label htmlFor="c-name">Full name</label>
            <input id="c-name" className={errors.full_name ? 'invalid' : ''} value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Priya Sharma" />
            {errors.full_name && <div className="err">{errors.full_name}</div>}
          </div>
          <div className="field">
            <label htmlFor="c-email">Email address</label>
            <input id="c-email" type="email" className={errors.email ? 'invalid' : ''} value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
            {errors.email && <div className="err">{errors.email}</div>}
          </div>
          <div className="field">
            <label htmlFor="c-phone">Phone number</label>
            <input id="c-phone" className={errors.phone ? 'invalid' : ''} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            {errors.phone && <div className="err">{errors.phone}</div>}
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Add customer'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
