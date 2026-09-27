import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import BookPage from './pages/BookPage'
import PracticePage from './pages/PracticePage'
import ImportPage from './pages/ImportPage'
import SearchPage from './pages/SearchPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<BookPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<BookPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}