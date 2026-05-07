import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CreateEpisode from './pages/CreateEpisode'
import EpisodeDetail from './pages/EpisodeDetail'
import StyleConfig from './pages/StyleConfig'

const navItems = [
  { path: '/', label: '剧集总览' },
  { path: '/create', label: '新建剧集' },
  { path: '/style-config', label: '风格配置' },
]

function NavBar() {
  const location = useLocation()
  return (
    <nav className="flex items-center gap-6 px-6 py-3 bg-gray-900 border-b border-gray-800">
      <Link to="/" className="text-tech-400 font-bold text-lg tracking-tight">
        AI-Vedio
      </Link>
      {navItems.map(({ path, label }) => (
        <Link
          key={path}
          to={path}
          className={`text-sm transition-colors ${
            location.pathname === path
              ? 'text-tech-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main className="max-w-7xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateEpisode />} />
          <Route path="/episode/:slug" element={<EpisodeDetail />} />
          <Route path="/style-config" element={<StyleConfig />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
