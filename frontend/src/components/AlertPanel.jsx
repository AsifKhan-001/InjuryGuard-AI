import { useState } from 'react'

export default function AlertPanel({ alerts, postureAlerts = [] }) {
    const [expanded, setExpanded] = useState(null)

    // Combine posture alerts with regular alerts at the top
    const hasPosture = postureAlerts.length > 0

    if (alerts.length === 0 && !hasPosture) {
        return (
            <div style={{
                textAlign: 'center', padding: '28px 0',
            }}>
                <div style={{
                    width: '48px', height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(var(--primary-rgb), 0.06)',
                    border: '1px solid rgba(var(--primary-rgb), 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '1.2rem',
                }}>
                    ✓
                </div>
                <div style={{
                    fontSize: '0.78rem', color: 'var(--text-dim)',
                    fontWeight: 500,
                }}>
                    All Clear — No Alerts
                </div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Posture Alerts (Priority) */}
            {hasPosture && postureAlerts.slice(0, 3).map((alert, idx) => (
                <div
                    key={`posture-${idx}`}
                    style={{
                        padding: '10px 12px',
                        background: alert.severity === 'danger'
                            ? 'rgba(var(--alert-red-rgb), 0.08)'
                            : 'rgba(var(--alert-yellow-rgb), 0.06)',
                        borderLeft: `3px solid ${alert.severity === 'danger' ? 'var(--alert-red)' : 'var(--alert-yellow)'}`,
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        animation: 'slide-in-right 0.3s var(--ease-out-expo) both',
                        animationDelay: `${idx * 0.05}s`,
                    }}
                >
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '4px',
                    }}>
                        <span style={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: alert.severity === 'danger' ? 'var(--alert-red)' : 'var(--alert-yellow)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}>
                            {alert.severity === 'danger' ? '🚨 POSTURE DANGER' : '⚠️ POSTURE WARNING'}
                        </span>
                        <span style={{
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-dim)',
                        }}>
                            {alert.angle?.toFixed(0)}°
                        </span>
                    </div>
                    <div style={{
                        fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4',
                    }}>
                        {alert.message}
                    </div>
                </div>
            ))}

            {/* Regular Alerts */}
            {alerts.slice(0, 30).map((alert, idx) => (
                <div
                    key={alert.id || idx}
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                    style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderLeft: `3px solid ${alert.alert_level === 'RED' ? 'var(--alert-red)' : 'var(--alert-yellow)'}`,
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        animation: 'slide-in-right 0.3s var(--ease-out-expo) both',
                        animationDelay: `${(idx + postureAlerts.length) * 0.03}s`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '4px',
                    }}>
                        <span style={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: alert.alert_level === 'RED' ? 'var(--alert-red)' : 'var(--alert-yellow)',
                            letterSpacing: '0.5px',
                        }}>
                            {alert.alert_level === 'RED' ? '🛑 DANGER' : '⚠️ WARNING'}
                        </span>
                        <span style={{
                            fontSize: '0.62rem',
                            color: 'var(--text-dim)',
                            fontFamily: 'var(--font-mono)',
                        }}>
                            {alert.timestamp}
                        </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {alert.alert_message || alert.message}
                    </div>

                    {/* Expanded Details */}
                    {expanded === idx && (
                        <div style={{
                            marginTop: '10px', padding: '10px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: 'var(--radius-sm)',
                            animation: 'slide-in-up 0.2s var(--ease-out-expo)',
                        }}>
                            <div style={{
                                fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '6px',
                                textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600,
                            }}>
                                Contributing Factors
                            </div>
                            {alert.contributing_factors?.map((factor, fi) => (
                                <div key={fi} style={{
                                    fontSize: '0.75rem', color: 'var(--text-secondary)',
                                    paddingLeft: '8px', paddingTop: '2px',
                                }}>
                                    • {factor}
                                </div>
                            ))}
                            {alert.recommended_action && (
                                <div style={{
                                    marginTop: '8px',
                                    color: 'var(--secondary)',
                                    fontSize: '0.78rem',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}>
                                    💡 {alert.recommended_action}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
