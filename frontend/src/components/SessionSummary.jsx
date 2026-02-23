import { useRef, useEffect } from 'react'

export default function SessionSummary({ stats, onClose }) {
    const modalRef = useRef(null)

    useEffect(() => {
        if (modalRef.current) {
            modalRef.current.style.opacity = 0
            modalRef.current.style.transform = 'scale(0.92) translateY(20px)'
            void modalRef.current.offsetWidth
            modalRef.current.style.transition = 'opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-spring)'
            modalRef.current.style.opacity = 1
            modalRef.current.style.transform = 'scale(1) translateY(0)'
        }
    }, [])

    if (!stats) return null

    const { duration, avgScore, peakRisk, alertCount, suggestion, mostDangerousAct } = stats

    let rank = "ROOKIE"
    let rankColor = "var(--text-dim)"
    let rankGlow = "transparent"
    const score = parseInt(avgScore)

    if (score >= 95) { rank = "ELITE"; rankColor = "#ffd700"; rankGlow = "rgba(255, 215, 0, 0.3)"; }
    else if (score >= 85) { rank = "PRO"; rankColor = "#c0c0c0"; rankGlow = "rgba(192, 192, 192, 0.2)"; }
    else if (score >= 70) { rank = "SKILLED"; rankColor = "#cd7f32"; rankGlow = "rgba(205, 127, 50, 0.2)"; }
    else if (score >= 50) { rank = "AMATEUR"; rankColor = "var(--primary)"; rankGlow = "rgba(var(--primary-rgb), 0.15)"; }

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fade-in 0.3s ease',
        }}>
            <div
                ref={modalRef}
                style={{
                    background: 'linear-gradient(160deg, rgba(18, 18, 28, 0.95), rgba(8, 8, 16, 0.98))',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '44px 40px',
                    width: '90%', maxWidth: '440px',
                    textAlign: 'center',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(var(--primary-rgb), 0.05)',
                    position: 'relative',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}
            >
                <h2 style={{
                    fontSize: '1.4rem', marginBottom: '4px', fontWeight: 800,
                    letterSpacing: '3px', textTransform: 'uppercase',
                    background: 'linear-gradient(135deg, var(--text-main), var(--text-secondary))',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                    Session Complete
                </h2>
                <div style={{
                    color: 'var(--text-dim)', marginBottom: '32px',
                    fontSize: '0.72rem', letterSpacing: '2px', textTransform: 'uppercase',
                }}>
                    Performance Report
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px',
                }}>
                    <StatBox label="Duration" value={duration} />
                    <StatBox label="Safety Score" value={avgScore} color={getColor(avgScore)} suffix="/100" />
                    <StatBox label="Peak Risk" value={`${peakRisk}%`} color={getRiskColor(peakRisk)} />
                    <StatBox label="Alerts" value={alertCount} color={alertCount > 0 ? 'var(--alert-red)' : 'var(--primary)'} />
                </div>

                {/* Insights Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', textAlign: 'left' }}>

                    <div style={{
                        background: 'rgba(var(--alert-red-rgb), 0.08)',
                        borderLeft: '3px solid var(--alert-red)',
                        padding: '12px', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--alert-red)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>
                            Most Dangerous Act Detected
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            {mostDangerousAct}
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(var(--primary-rgb), 0.08)',
                        borderLeft: '3px solid var(--primary)',
                        padding: '12px', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                    }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '1px' }}>
                            Suggestions for Improvement
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            {suggestion}
                        </div>
                    </div>

                </div>

                {/* Rank */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', marginBottom: '28px',
                }}>
                    <div style={{
                        fontSize: '0.62rem', color: 'var(--text-dim)', marginBottom: '10px',
                        textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600,
                    }}>
                        Achieved Rank
                    </div>
                    <div style={{
                        fontSize: '2.2rem', fontWeight: 900, color: rankColor,
                        textShadow: `0 0 24px ${rankGlow}`, letterSpacing: '4px',
                    }}>
                        {rank}
                    </div>
                </div>

                <button
                    id="btn-session-close"
                    onClick={onClose}
                    style={{
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        color: '#000', border: 'none',
                        padding: '14px 48px', fontSize: '0.85rem', fontWeight: 700,
                        borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(var(--primary-rgb), 0.25)',
                        transition: 'all 0.3s var(--ease-spring)',
                        letterSpacing: '2px', textTransform: 'uppercase',
                        fontFamily: 'var(--font-main)',
                    }}
                    onMouseEnter={e => e.target.style.transform = 'translateY(-3px) scale(1.02)'}
                    onMouseLeave={e => e.target.style.transform = 'translateY(0) scale(1)'}
                >
                    Continue
                </button>
            </div>
        </div>
    )
}

function StatBox({ label, value, color = 'var(--text-main)', suffix = '' }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.03)',
        }}>
            <div style={{
                fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '6px',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px',
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '1.3rem', fontWeight: 700, color: color,
                fontFamily: 'var(--font-mono)',
            }}>
                {value}<span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{suffix}</span>
            </div>
        </div>
    )
}

function getColor(score) {
    if (score >= 90) return 'var(--primary)'
    if (score >= 70) return 'var(--alert-yellow)'
    return 'var(--alert-red)'
}

function getRiskColor(risk) {
    if (risk < 30) return 'var(--primary)'
    if (risk < 70) return 'var(--alert-yellow)'
    return 'var(--alert-red)'
}
