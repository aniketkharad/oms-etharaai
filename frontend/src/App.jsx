import { useState } from 'react'
import { ToastProvider } from './components/Toast.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Products from './pages/Products.jsx'
import Customers from './pages/Customers.jsx'
import Orders from './pages/Orders.jsx'

const PAGES = [
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'products', label: 'Products', icon: '▤' },
  { key: 'customers', label: 'Customers', icon: '◉' },
  { key: 'orders', label: 'Orders', icon: '⇄' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            Stockroom
            <small>Inventory &amp; orders</small>
          </div>
          {PAGES.map((p) => (
            <button
              key={p.key}
              className={`nav-btn ${page === p.key ? 'active' : ''}`}
              onClick={() => setPage(p.key)}
            >
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </button>
          ))}
        </aside>
        <main className="main">
          {page === 'dashboard' && <Dashboard goTo={setPage} />}
          {page === 'products' && <Products />}
          {page === 'customers' && <Customers />}
          {page === 'orders' && <Orders />}
        </main>
      </div>
    </ToastProvider>
  )
}
