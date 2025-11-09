import React from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'

// Импорт основных стилей
import './styles/style.css'
import './styles/components/header.css'
import './styles/components/sidebar.css'
import './styles/components/cards.css'
import './styles/components/forms.css'
import './styles/components/background.css'
import './styles/components/execution.css'

// Импорт компонентов
import BackgroundShapes from './components/BackgroundShapes'
import Header from './components/Header'
import Sidebar from './components/Sidebar'

// Импорт страниц
import HomePage from './pages/HomePage'
import StatsPage from './pages/StatsPage'
import ProcessesPage from './pages/ProcessesPage'
import UploadPage from './pages/UploadPage'
import SettingsPage from './pages/SettingsPage'
import MappingPage from './pages/MappingPage'
import ExecutionPage from './pages/ExecutionPage'

function App() {
  return (
    <div className="app">
      <BackgroundShapes />
      <Header />
      <div className="main-layout">
        <Sidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/reports" element={<StatsPage />} />
            <Route path="/processes" element={<ProcessesPage />} />
            <Route path="/mapping" element={<MappingPage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
