import { useMemo } from 'react'

export default function RiskMeter({ analysis }) {
    const score = analysis?.injury_probability || 0
    const level = analysis?.alert_level || 'GREEN'
    const injuryType = analysis?.injury_type || 'None'
    const timeHorizon = analysis?.time_horizon || 'long-term'

    const color = useMemo(() => {
        if (score < 35) return 'var(--primary)'
        if (score < 70) return 'var(--alert-yellow)'
        return 'var(--alert-red)'
    }, [score])

    const radius = 70
    const circumference = Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const centerX = 90
    const centerY = 85

    return (
        <div style={{ padding: 0 }}>
            {/* Gauge */}
            <div style={{ position: 'relative' }}>
                <svg viewBox="0 0 180 100">
                    {/* Background arc */}
                    <path
                        d="M 20 85 A 70 70 0 0 1 160 85"
                        className="risk-gauge-bg"
                        style={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 10 }}
                    />
                    {/* Filled arc */}
                    <path
                        d="M 20 85 A 70 70 0 0 1 160 85"
                        className="risk-gauge-fill"
                        style={{
                            stroke: color,
                            strokeDasharray: circumference,
                            strokeDashoffset: offset,
                            filter: `drop-shadow(0 0 10px ${color})`,
                            strokeWidth: 10,
                        }}
                    />
                    {/* Center value */}
                    <text
                        x={centerX} y={centerY - 18}
                        textAnchor="middle"
                        fill={color}
                        fontSize="30"
                        fontWeight="800"
                        fontFamily="var(--font-mono)"
                        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                    >
                        {score.toFixed(0)}
                    </text>
                    <text
                        x={centerX + 22} y={centerY - 20}
                        textAnchor="start"
                        fill={color}
                        fontSize="11"
                        fontWeight="400"
                        opacity="0.6"
                    >
                        %
                    </text>
                </svg>
            </div>

            {/* Labels */}
            <div style={{ textAlign: 'center', marginTop: '-18px' }}>
                <div style={{
                    color: color,
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    transition: 'color 0.3s',
                }}>
                    {injuryType}
                </div>
                <div style={{
                    color: 'var(--text-dim)',
                    fontSize: '0.7rem',
                    marginTop: '4px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '1px',
                }}>
                    {timeHorizon.toUpperCase()}
                </div>
            </div>
        </div>
    )
}
