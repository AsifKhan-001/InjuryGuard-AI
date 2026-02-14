import { useState } from 'react'

export default function AlertPanel({ alerts }) {
    const [expanded, setExpanded] = useState(null)

    if (alerts.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Alerts</span>
                    <span className="card-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                        Clear
                    </span>
                </div>
                <div style={{
                    textAlign: 'center', padding: '24px 0',
                    fontSize: '0.85rem', color: '#64748b'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>✓</div>
                    No alerts — all clear
                </div>
            </div>
        )
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Alerts</span>
                <span className="card-badge" style={{
                    background: alerts[0]?.alert_level === 'RED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: alerts[0]?.alert_level === 'RED' ? '#ef4444' : '#f59e0b'
                }}>
                    {alerts.length}
                </span>
            </div>

            <div className="alert-list">
                {alerts.slice(0, 20).map((alert, idx) => (
                    <div
                        key={alert.id || idx}
                        className={`alert-item ${alert.alert_level?.toLowerCase()}`}
                        onClick={() => setExpanded(expanded === idx ? null : idx)}
                    >
                        <div className="alert-header">
                            <span className="alert-level" style={{
                                color: alert.alert_level === 'RED' ? '#ef4444' : '#f59e0b'
                            }}>
                                {alert.alert_level === 'RED' ? '🔴' : '🟡'} {alert.alert_level}
                            </span>
                            <span className="alert-time">{alert.timestamp}</span>
                        </div>
                        <div className="alert-message">
                            {alert.injury_type && alert.injury_type !== 'Unknown' && (
                                <strong>{alert.injury_type} — </strong>
                            )}
                            Risk: {alert.injury_probability?.toFixed(0)}%
                            {alert.time_horizon && ` (${alert.time_horizon})`}
                        </div>

                        {/* Expanded factors */}
                        {expanded === idx && alert.contributing_factors?.length > 0 && (
                            <div className="alert-factors">
                                {alert.contributing_factors.map((factor, fi) => (
                                    <div key={fi} className="alert-factor">{factor}</div>
                                ))}
                                {alert.recommended_action && (
                                    <div style={{
                                        marginTop: '8px', padding: '8px',
                                        borderRadius: '6px', background: 'rgba(6, 182, 212, 0.08)',
                                        fontSize: '0.72rem', color: '#06b6d4', lineHeight: 1.4
                                    }}>
                                        💡 {alert.recommended_action}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
