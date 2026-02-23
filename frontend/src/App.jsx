import { useState, useCallback, useRef, useEffect } from 'react'
import VideoFeed from './components/VideoFeed'
import AROverlay from './components/AROverlay'
import RiskMeter from './components/RiskMeter'
import PlayerStatus from './components/PlayerStatus'
import AlertPanel from './components/AlertPanel'
import SportSelector from './components/SportSelector'
import HistoryChart from './components/HistoryChart'
import SessionSummary from './components/SessionSummary'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/analyze'

function App() {
  const [sport, setSport] = useState('generic')
  const [analysis, setAnalysis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [connected, setConnected] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [riskHistory, setRiskHistory] = useState([])
  const [sessionStats, setSessionStats] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)
  const [goodStreak, setGoodStreak] = useState(0)
  const [postureWarning, setPostureWarning] = useState(null)

  const handleMuteToggle = useCallback(() => {
    setIsMuted(p => {
      const next = !p
      isMutedRef.current = next
      if (next && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      return next
    })
  }, [])
  const wsRef = useRef(null)
  const audioRef = useRef(null)
  const startTimeRef = useRef(null)
  const lastCoachTime = useRef(0)
  const lastPostureAlertTime = useRef(0)

  // Initialize audio for RED alerts
  useEffect(() => {
    try {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRigBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQBAADg/+D/4P/g/+D/4P/g/+D/4P/g/+D/4P/g/8D/wP+g/4D/YP9A/yD/AP/g/sD+oP6A/mD+QP4g/gD+4P3A/aD9gP2A/YD9gP2g/aD9wP3g/QD+IP5A/mD+gP6g/sD+4P4A/yD/QP9g/4D/oP/A/+D/AAAQACAAQABQAGAAYAB4AIgAmACgAKgAsAC4ALgAuACwAKAAlACIAHgAYABQAEAAMAAgABAAAADg/8D/oP+A/2D/QP8g/wD/4P7A/qD+gP5g/kD+IP4A/uD9wP2g/YD9YP1A/SD9AP3g/MD8oPyA/GD8QPwg/AD84PvA+6D7gPtg+0D7')
      audioRef.current.volume = 0.3
    } catch (e) {
      console.error("Audio initialization failed:", e)
    }
  }, [])

  // Text-to-Speech Helper
  const speak = useCallback((text, priority = 'normal') => {
    if (isMutedRef.current || !window.speechSynthesis) return

    try {
      if (priority === 'high') {
        window.speechSynthesis.cancel()
      } else if (window.speechSynthesis.speaking) {
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0

      const voices = window.speechSynthesis.getVoices()
      const preferredVoice = voices.find(v =>
        v.name.includes('Google US English') ||
        v.name.includes('Natural') ||
        v.name.includes('Samantha') ||
        v.name.includes('Microsoft David') ||
        v.lang.startsWith('en-US')
      )
      if (preferredVoice) utterance.voice = preferredVoice
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.error("Speech synthesis failed:", e)
    }
  }, [isMuted])

  // Connect WebSocket
  const reconnectAttempts = useRef(0)
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setConnected(true)
      reconnectAttempts.current = 0
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setAnalysis(data)

      // ── Posture Alert Handling ──
      if (data.posture_alerts && data.posture_alerts.length > 0) {
        const topAlert = data.posture_alerts[0]
        setPostureWarning(topAlert.message)

        // Voice alert for posture dangers (max once per 5 seconds)
        const now = Date.now()
        if (now - lastPostureAlertTime.current > 5000) {
          const voiceMsg = "I'm sorry, but your posture is wrong. Please take a moment to correct your form."
          speak(voiceMsg, 'high')
          lastPostureAlertTime.current = now
        }

        // Auto-clear posture warning after 4 seconds
        setTimeout(() => setPostureWarning(null), 4000)
      }

      // AI Coach Logic: Positive Reinforcement
      const risk = data.injury_probability || 0
      if (risk < 20 && data.alert_level === 'GREEN') {
        setGoodStreak(prev => {
          const next = prev + 1
          if (next >= 50 && (Date.now() - lastCoachTime.current) > 15000) {
            const compliments = [
              "Great form, keep it up!",
              "Balance looks perfect. You're in the zone.",
              "Excellent control. This is how pros do it.",
              "Your posture is rock solid. Nice work.",
              "Stay focused, you're doing amazing."
            ]
            const randomMsg = compliments[Math.floor(Math.random() * compliments.length)]
            speak(randomMsg, 'normal')
            lastCoachTime.current = Date.now()
            return 0
          }
          return next
        })
      } else if (risk > 40) {
        setGoodStreak(0)
      }

      // Track risk history
      setRiskHistory(prev => {
        const next = [...prev, {
          time: Date.now(),
          risk: data.injury_probability || 0,
          level: data.alert_level || 'GREEN'
        }]
        return next.slice(-60)
      })

      // Cricket Specific: Sudden Object Detection Voice Alert
      if (sport === 'cricket' && data.object_risk > 80 && data.object_speed > 30) {
        const now = Date.now()
        if (now - lastCoachTime.current > 5000) {
          speak("Save yourself! Sudden object detected!", 'high')
          lastCoachTime.current = now
        }
      }

      // Add to alerts if not GREEN
      if (data.alert_level && data.alert_level !== 'GREEN') {
        setAlerts(prev => [{
          ...data,
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50))

        if (data.alert_level === 'RED') {
          if (!isMutedRef.current) {
            audioRef.current?.play().catch(() => { })
          }
          if (!data.posture_alerts?.length) {
            const msg = data.recommended_action || data.injury_type || "High risk detected"
            speak(msg, 'high')
          }
        }
      }
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('WebSocket disconnected')

      // Auto-reconnect if we were manually streaming
      setStreaming(currentStreaming => {
        if (currentStreaming) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          console.log(`Will attempt reconnect in ${delay}ms...`)
          setTimeout(() => {
            reconnectAttempts.current += 1
            connectWS()
          }, delay)
        }
        return currentStreaming
      })
    }

    ws.onerror = () => {
      setConnected(false)
    }

    wsRef.current = ws
  }, [speak])

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

  // Toggle streaming with Session Summary logic
  const toggleStreaming = useCallback(() => {
    if (!streaming) {
      connectWS()
      setRiskHistory([])
      setAlerts([])
      setSessionStats(null)
      startTimeRef.current = Date.now()
    } else {
      wsRef.current?.close()
      if (startTimeRef.current && riskHistory.length > 0) {
        const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const min = Math.floor(durationSec / 60)
        const sec = durationSec % 60
        const duration = `${min}m ${sec}s`
        const avgRisk = riskHistory.reduce((a, b) => a + b.risk, 0) / riskHistory.length
        const avgScore = Math.max(0, 100 - avgRisk).toFixed(0)
        const peakRisk = Math.max(...riskHistory.map(r => r.risk), 0).toFixed(0)

        let mostDangerousAct = "None detected."
        let suggestion = "Maintain this level of safety."

        if (alerts.length > 0) {
          const redAlerts = alerts.filter(a => a.alert_level === 'RED')
          if (redAlerts.length > 0) {
            mostDangerousAct = redAlerts[0].alert_message || redAlerts[0].injury_type || "High risk activity detected"
            suggestion = "Focus on form correction and avoid sudden, jerky movements."
          } else {
            mostDangerousAct = alerts[0].alert_message || alerts[0].message || "Warning triggered"
            suggestion = "Pay attention to minor form deviations before they escalate."
          }
        }

        setSessionStats({ duration, avgScore, peakRisk, alertCount: alerts.length, suggestion, mostDangerousAct })
      }
    }
    setStreaming(prev => !prev)
  }, [streaming, connectWS, riskHistory, alerts.length])

  // Change sport → send to WS
  const handleSportChange = useCallback((newSport) => {
    setSport(newSport)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ sport: newSport }))
    }
  }, [])

  const alertLevel = analysis?.alert_level || 'GREEN'

  const getBannerType = () => {
    if (postureWarning) {
      return analysis?.posture_alerts?.[0]?.severity === 'danger' ? 'danger' : 'warning'
    }
    if (analysis?.alert_level === 'RED') return 'danger'
    if (analysis?.alert_level === 'YELLOW') return 'warning'
    return 'secure'
  }

  const getBannerMessage = () => {
    if (postureWarning) return postureWarning
    if (analysis?.alert_level === 'RED' || analysis?.alert_level === 'YELLOW') {
      return analysis.alert_message || 'Risk detected'
    }
    return 'SYSTEM SECURE — POSTURE OPTIMAL'
  }

  return (
    <div className="app-container">

      {/* ─── Header ───────────────────────────────────────────── */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="header-logo" title="InjuryGuard AI">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Dark base character abstract */}
              <circle cx="50" cy="20" r="10" fill="rgba(255, 255, 255, 0.15)" stroke="var(--primary)" strokeWidth="2" />
              <path d="M50 30 V 55" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
              <path d="M50 40 L 30 60" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
              <path d="M50 40 L 70 30" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
              <path d="M50 55 L 35 85" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
              <path d="M50 55 L 65 85" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
              {/* Detection nodes (glowing dots) */}
              <circle cx="50" cy="40" r="4" fill="var(--secondary)" />
              <circle cx="30" cy="60" r="3" fill="var(--alert-red)" />
              <circle cx="70" cy="30" r="3" fill="var(--primary)" />
              <circle cx="35" cy="85" r="3" fill="var(--primary)" />
              <circle cx="65" cy="85" r="3" fill="var(--primary)" />
              <circle cx="50" cy="55" r="4" fill="var(--secondary)" />
            </svg>
          </div>
          <h1>InjuryGuard <span>AI</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SportSelector sport={sport} onChange={handleSportChange} />
          <div className={`status-badge ${alertLevel.toLowerCase()}`}>
            {connected ? `● ${alertLevel}` : '○ OFFLINE'}
          </div>
        </div>
      </header>

      {/* ─── Main Grid ────────────────────────────────────────── */}
      <main className="main-grid">
        {/* Left: Video Feed */}
        <section className="video-section">
          {/* ─── Persistent Status Bar ──────────────────────────── */}
          <div className={`status-bar ${getBannerType()}`}>
            <span className="status-label">STATUS:</span>
            <span className="status-message">{getBannerMessage()}</span>
          </div>

          <div className="video-container">
            <VideoFeed
              streaming={streaming}
              onToggle={toggleStreaming}
              onFrame={sendFrame}
              analysis={analysis}
              connected={connected}
            />

            {/* AR Skeleton Overlay (Mirrored to match video) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}>
              <AROverlay analysis={analysis} />
            </div>

            {/* Overlay Info (Top Left) */}
            <div className="video-overlay">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ opacity: 0.7 }}>MODE:</span>
                <span style={{ fontWeight: 600 }}>{sport.toUpperCase()}</span>
                <button
                  onClick={handleMuteToggle}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-pill)',
                    color: isMuted ? 'var(--alert-red)' : 'var(--primary)',
                    padding: '2px 10px',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    transition: 'all 0.2s',
                    pointerEvents: 'auto',
                  }}
                >
                  {isMuted ? '🔇 OFF' : '🔊 ON'}
                </button>
              </div>
              <div style={{ marginTop: '4px', opacity: 0.5 }}>
                <span>FPS: {analysis ? '12' : '0'}</span>
                <span style={{ marginLeft: '12px' }}>TIME: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            {/* ─── Start / Stop Controls ───────────────────────── */}
            {!streaming && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 200, pointerEvents: 'auto', textAlign: 'center'
              }}>
                <button
                  id="btn-initialize"
                  onClick={toggleStreaming}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: '#000',
                    border: 'none',
                    padding: '18px 44px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '3px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-pill)',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-main)',
                    boxShadow: '0 0 40px rgba(var(--primary-rgb), 0.3), 0 8px 32px rgba(0,0,0,0.4)',
                    transition: 'all 0.3s var(--ease-spring)',
                  }}
                  onMouseEnter={e => {
                    e.target.style.transform = 'scale(1.05)'
                    e.target.style.boxShadow = '0 0 60px rgba(var(--primary-rgb), 0.5), 0 12px 40px rgba(0,0,0,0.5)'
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'scale(1)'
                    e.target.style.boxShadow = '0 0 40px rgba(var(--primary-rgb), 0.3), 0 8px 32px rgba(0,0,0,0.4)'
                  }}
                >
                  ▶ Initialize
                </button>
                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Ready to Connect
                </div>
              </div>
            )}

          </div>

          {/* Bottom Bar Metrics (Redesigned Glassmorphism) */}
          <div className="metrics-bar">
            {streaming && (
              <div className="scan-line" style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(var(--primary-rgb), 0.6), transparent)',
                boxShadow: '0 0 12px rgba(var(--primary-rgb), 0.4)',
                animation: 'scan 3s linear infinite',
                pointerEvents: 'none',
                zIndex: 5,
                borderRadius: 'var(--radius-lg)'
              }} />
            )}

            <div className="metrics-wrapper">
              <MetricItem label="Pose Risk" value={analysis?.pose_risk} />

              {sport === 'cricket' ? (
                <>
                  <MetricItem label="Impact Risk" value={analysis?.object_risk} />
                  <div className="metric-item">
                    <span className="metric-label">Speed</span>
                    <span className="metric-value" style={{ color: 'var(--secondary)' }}>
                      {analysis?.object_speed?.toFixed(0) || '0'} <small style={{ fontSize: '0.8rem', opacity: 0.6 }}>km/h</small>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <MetricItem label="Facial Stress" value={analysis?.facial_stress} />
                  <MetricItem label="Joint Stress" value={analysis?.fatigue_score} />
                </>
              )}
            </div>

            {streaming && (
              <button
                id="btn-terminate"
                onClick={toggleStreaming}
                style={{
                  background: 'rgba(var(--alert-red-rgb), 0.8)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '10px 24px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(var(--alert-red-rgb), 0.3)',
                  pointerEvents: 'auto',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontFamily: 'var(--font-main)',
                  transition: 'all 0.3s',
                  marginLeft: 'auto'
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(var(--alert-red-rgb), 1)'}
                onMouseLeave={e => e.target.style.background = 'rgba(var(--alert-red-rgb), 0.8)'}
              >
                ⏹ Terminate
              </button>
            )}
          </div>
        </section>

        {/* Right: Analysis Panel */}
        <aside className="right-panel">
          <div className="panel-card">
            <h3>Live Analysis</h3>
            <RiskMeter analysis={analysis} />
          </div>

          <div className="panel-card">
            <h3>Player Status</h3>
            <PlayerStatus analysis={analysis} />
          </div>

          <div className="panel-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3>Alert Log</h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AlertPanel alerts={alerts} postureAlerts={analysis?.posture_alerts} />
            </div>
          </div>

          <div className="panel-card">
            <h3>Risk Trend</h3>
            <HistoryChart history={riskHistory} />
          </div>
        </aside>
      </main>

      {/* Session Summary Modal */}
      <SessionSummary stats={sessionStats} onClose={() => setSessionStats(null)} />
    </div>
  )
}

function MetricItem({ label, value }) {
  const color = getColor(value)
  return (
    <div className="metric-item">
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ color }}>
        {value?.toFixed(0) || '0'}%
      </span>
    </div>
  )
}

function getColor(value) {
  if (!value || value < 35) return 'var(--primary)'
  if (value < 70) return 'var(--alert-yellow)'
  return 'var(--alert-red)'
}

export default App
