import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import type { NavLinkRenderProps } from 'react-router-dom';
import POSPage from './pages/pos/POSPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import DonationsPage from './pages/donations/DonationsPage';
import MerchPage from './pages/merch/MerchPage';
import LiveOrdersPage from './pages/live-orders/LiveOrdersPage';
import HojichaStationPage from './pages/stations/HojichaStationPage';
import CoffeeStationPage from './pages/stations/CoffeeStationPage';
import KitchenStationPage from './pages/stations/KitchenStationPage';

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

function AppShell() {
  const location = useLocation();
  const [isStationsOpen, setIsStationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isStationsActive = location.pathname.startsWith('/stations/');

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsStationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, []);

  return (
    <>
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
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsStationsOpen(current => !current)}
              style={{
                ...navLinkStyle({ isActive: isStationsActive, isPending: false, isTransitioning: false }),
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              Stations
              <span style={{ fontSize: '10px', lineHeight: 1 }}>{isStationsOpen ? '▲' : '▼'}</span>
            </button>
            {isStationsOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 0.5rem)',
                left: 0,
                minWidth: '160px',
                padding: '0.45rem',
                borderRadius: '18px',
                background: '#F0E4BF',
                border: '1px solid rgba(104, 40, 55, 0.12)',
                boxShadow: '0 12px 28px rgba(82, 48, 26, 0.14)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                zIndex: 20,
              }}>
                <NavLink to="/stations/hojicha" style={navLinkStyle} onClick={() => setIsStationsOpen(false)}>Hojicha</NavLink>
                <NavLink to="/stations/coffee" style={navLinkStyle} onClick={() => setIsStationsOpen(false)}>Coffee</NavLink>
                <NavLink to="/stations/kitchen" style={navLinkStyle} onClick={() => setIsStationsOpen(false)}>Kitchen</NavLink>
              </div>
            )}
          </div>
          <NavLink to="/receipts" style={navLinkStyle}>Receipts</NavLink>
          <NavLink to="/donations" style={navLinkStyle}>Donations</NavLink>
          <NavLink to="/dashboard" style={navLinkStyle}>Dashboard</NavLink>
          <NavLink to="/merch" style={navLinkStyle}>Merch</NavLink>
        </div>
      </nav>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<POSPage />} />
          <Route path="/live-orders" element={<LiveOrdersPage />} />
          <Route path="/stations/hojicha" element={<HojichaStationPage />} />
          <Route path="/stations/coffee" element={<CoffeeStationPage />} />
          <Route path="/stations/kitchen" element={<KitchenStationPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/donations" element={<DonationsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/merch" element={<MerchPage />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
