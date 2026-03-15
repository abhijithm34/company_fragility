import { NavLink, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { FilterProvider } from './context/FilterContext'
import './App.css'
import { UploadPage } from './pages/UploadPage'
import { HistoryPage } from './pages/HistoryPage'
import { RunDetailsPage } from './pages/RunDetailsPage'
import { CompanyRiskProfilePage } from './pages/CompanyRiskProfilePage'
import { CompanyLookupPage } from './pages/CompanyLookupPage'
import { RiskHeatmapPage } from './pages/RiskHeatmapPage'

function AppLayout() {
  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Fragility Dashboard</h1>
          <p className="app-subtitle">Corporate distress scoring</p>
        </div>
        <nav className="nav">
          <NavLink
            to="/upload"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            Upload &amp; Score
          </NavLink>
          <NavLink
            to="/companies"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            Company Analytics
          </NavLink>
          <NavLink
            to="/heatmap"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            Visualizations
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            History
          </NavLink>
        </nav>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <FilterProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/runs/:id" element={<RunDetailsPage />} />
          <Route path="/companies" element={<CompanyLookupPage />} />
          <Route path="/companies/:companyName" element={<CompanyRiskProfilePage />} />
          <Route path="/heatmap" element={<RiskHeatmapPage />} />
        </Route>
      </Routes>
    </FilterProvider>
  )
}

