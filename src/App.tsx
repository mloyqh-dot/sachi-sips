import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import type { NavLinkRenderProps } from 'react-router-dom';
import POSPage from './pages/pos/POSPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import LiveOrdersPage from './pages/live-orders/LiveOrdersPage';

function navLinkStyle({ isActive }: NavLinkRenderProps): React.CSSProperties {
  return {
    fontFamily: "'Public Sans', sans-serif",
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#682837' : '#52301A',
    textDecoration: 'none',
    padding: '5px 14px',
    borderRadius: '999px',
    background: isActive ? 'rgba(229, 144, 144, 0.22)' : 'transparent',
    transition: 'background 0.15s, color 0.15s',
    letterSpacing: '0.01em',
  };
}

function App() {
  return (
    <BrowserRouter>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid rgba(104, 40, 55, 0.15)',
        background: '#F0E4BF',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Pinyon Script', cursive",
          fontSize: '1.875rem',
          color: '#682837',
          lineHeight: 1,
          letterSpacing: '0.01em',
          userSelect: 'none',
        }}>
          Sachi Sips
        </span>
        <div style={{ display: 'flex', gap: '0.125rem', alignItems: 'center' }}>
          <NavLink to="/" end style={navLinkStyle}>POS</NavLink>
          <NavLink to="/live-orders" style={navLinkStyle}>Live Orders</NavLink>
          <NavLink to="/receipts" style={navLinkStyle}>Receipts</NavLink>
          <NavLink to="/dashboard" style={navLinkStyle}>Dashboard</NavLink>
        </div>
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<POSPage />} />
          <Route path="/live-orders" element={<LiveOrdersPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
