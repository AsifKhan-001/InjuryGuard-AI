import { useState, useCallback, useRef, useEffect } from 'react'
import VideoFeed from './components/VideoFeed'
import RiskMeter from './components/RiskMeter'
import PlayerStatus from './components/PlayerStatus'
import AlertPanel from './components/AlertPanel'
import SportSelector from './components/SportSelector'
import HistoryChart from './components/HistoryChart'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/analyze'
const API_URL = API_BASE

function App() {
  const [sport, setSport] = useState('generic')
  const [analysis, setAnalysis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [riskHistory, setRiskHistory] = useState([])
  const wsRef = useRef(null)
  const audioRef = useRef(null)

  // Initialize audio for RED alerts
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRigBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQBAADg/+D/4P/g/+D/4P/g/+D/4P/g/+D/4P/g/8D/wP+g/4D/YP9A/yD/AP/g/sD+oP6A/mD+QP4g/gD+4P3A/aD9gP2A/YD9gP2g/aD9wP3g/QD+IP5A/mD+gP6g/sD+4P4A/yD/QP9g/4D/oP/A/+D/AAAQACAAQABQAGAAYAB4AIgAmACgAKgAsAC4ALgAuACwAKAAlACIAHgAYABQAEAAMAAgABAAAADg/8D/oP+A/2D/QP8g/wD/4P7A/qD+gP5g/kD+IP4A/uD9wP2g/YD9YP1A/SD9AP3g/MD8oPyA/GD8QPwg/AD84PvA+6D7gPtg+0D7')
    audioRef.current.volume = 0.3
  }, [])

  // Connect WebSocket
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setConnected(true)
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setAnalysis(data)

      // Track risk history
      setRiskHistory(prev => {
        const next = [...prev, {
          time: Date.now(),
          risk: data.injury_probability || 0,
          level: data.alert_level || 'GREEN'
        }]
        return next.slice(-60) // keep last 60 data points
      })

      // Add to alerts if not GREEN
      if (data.alert_level && data.alert_level !== 'GREEN') {
        setAlerts(prev => [{
          ...data,
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50))

        // Audio alert on RED
        if (data.alert_level === 'RED' && audioRef.current) {
          audioRef.current.play().catch(() => { })
        }
      }
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('WebSocket disconnected')
    }

    ws.onerror = () => {
      setConnected(false)
    }

    wsRef.current = ws
  }, [])

  // Send frame over WebSocket
  const sendFrame = useCallback((base64Frame, width, height) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        image_base64: base64Frame,
        sport: sport,
        frame_width: width,
        frame_height: height
      }))
    }
  }, [sport])

  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    if (!streaming) {
      connectWS()
    } else {
      wsRef.current?.close()
    }
    setStreaming(!streaming)
  }, [streaming, connectWS])

  // Change sport → send to WS
  const handleSportChange = useCallback((newSport) => {
    setSport(newSport)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ sport: newSport }))
    }
  }, [])

  const alertLevel = analysis?.alert_level || 'GREEN'

  return (
    <div className="app-container">
      {/* ─── Header ───────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">⚡</div>
          <h1>InjuryGuard <span>AI</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SportSelector sport={sport} onChange={handleSportChange} />
          <div className={`status-badge ${alertLevel.toLowerCase()}`}>
            {connected ? `● ${alertLevel}` : '○ Offline'}
          </div>
        </div>
      </header>

      {/* ─── Main Grid ────────────────────────────────────────── */}
      <main className="main-grid">
        {/* Video + Metrics */}
        <section className="video-section">
          <VideoFeed
            streaming={streaming}
            onToggle={toggleStreaming}
            onFrame={sendFrame}
            analysis={analysis}
            connected={connected}
          />

          {/* Quick Metrics Bar */}
          <div className="metrics-bar">
            <div className="metric-item">
              <span className="metric-value" style={{ color: getColor(analysis?.pose_risk) }}>
                {analysis?.pose_risk?.toFixed(0) || '0'}
              </span>
              <span className="metric-label">Pose Risk</span>
            </div>
            <div className="metric-item">
              <span className="metric-value" style={{ color: getColor(analysis?.facial_stress) }}>
                {analysis?.facial_stress?.toFixed(0) || '0'}
              </span>
              <span className="metric-label">Facial Stress</span>
            </div>
            <div className="metric-item">
              <span className="metric-value" style={{ color: getColor(analysis?.object_risk) }}>
                {analysis?.object_risk?.toFixed(0) || '0'}
              </span>
              <span className="metric-label">Impact Risk</span>
            </div>
            <div className="metric-item">
              <span className="metric-value" style={{ color: '#06b6d4' }}>
                {analysis?.object_speed?.toFixed(0) || '0'}
              </span>
              <span className="metric-label">Speed km/h</span>
            </div>
          </div>
        </section>

        {/* Right Panel */}
        <aside className="right-panel">
          <RiskMeter analysis={analysis} />
          <PlayerStatus analysis={analysis} />
          <AlertPanel alerts={alerts} />
          <HistoryChart history={riskHistory} />
        </aside>
      </main>
    </div>
  )
}

function getColor(value) {
  if (!value || value < 35) return '#22c55e'
  if (value < 70) return '#f59e0b'
  return '#ef4444'
}

export default App
