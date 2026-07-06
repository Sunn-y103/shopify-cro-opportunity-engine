import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Home from './pages/Home'
import Report from './pages/Report'
import './App.css'

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </MainLayout>
    </Router>
  )
}

export default App
