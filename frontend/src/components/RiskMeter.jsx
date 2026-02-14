import { useMemo } from 'react'

export default function RiskMeter({ analysis }) {
    const score = analysis?.injury_probability || 0
    const level = analysis?.alert_level || 'GREEN'
    const injuryType = analysis?.injury_type || 'None'
    const timeHorizon = analysis?.time_horizon || 'long-term'

    const color = useMemo(() => {
        if (score < 35) return '#22c55e'
        if (score < 70) return '#f59e0b'
        return '#ef4444'
    }, [score])

    // SVG arc math for the gauge
    const radius = 70
    const strokeWidth = 12
    const centerX = 90
    const centerY = 85
    const circumference = Math.PI * radius // half circle
    const offset = circumference - (score / 100) * circumference

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Injury Risk</span>
                <span className={`status-badge ${level.toLowerCase()}`}>{level}</span>
            </div>

            <div className="risk-meter-container">
                {/* Gauge */}
                <div className="risk-gauge">
                    <svg viewBox="0 0 180 100">
                        {/* Background arc */}
                        <path
                            d="M 20 85 A 70 70 0 0 1 160 85"
                            className="risk-gauge-bg"
                        />
                        {/* Filled arc */}
                        <path
                            d="M 20 85 A 70 70 0 0 1 160 85"
                            className="risk-gauge-fill"
                            style={{
                                stroke: color,
                                strokeDasharray: circumference,
                                strokeDashoffset: offset,
                            }}
                        />
                        {/* Center value */}
                        <text
                            x={centerX}
                            y={centerY - 15}
                            textAnchor="middle"
                            fill={color}
                            fontSize="32"
                            fontWeight="800"
                            fontFamily="'Inter', sans-serif"
                        >
                            {score.toFixed(0)}
                        </text>
                        <text
                            x={centerX + 25}
                            y={centerY - 18}
                            textAnchor="start"
                            fill={color}
                            fontSize="12"
                            fontWeight="400"
                            opacity="0.6"
                        >
                            %
                        </text>
                    </svg>
                </div>

                {/* Labels */}
                <div className="risk-value">
                    <div className="label" style={{ color }}>{injuryType}</div>
                    <div className="label" style={{ opacity: 0.6, marginTop: '4px' }}>
                        Horizon: {timeHorizon}
                    </div>
                </div>

                {/* Detail grid */}
                <div className="risk-details">
                    <div className="risk-detail-item">
                        <span className="value" style={{ color: getColor(analysis?.pose_risk) }}>
                            {(analysis?.pose_risk || 0).toFixed(0)}%
                        </span>
                        <span className="label">Posture</span>
                    </div>
                    <div className="risk-detail-item">
                        <span className="value" style={{ color: getColor(analysis?.facial_stress) }}>
                            {(analysis?.facial_stress || 0).toFixed(0)}%
                        </span>
                        <span className="label">Facial</span>
                    </div>
                    <div className="risk-detail-item">
                        <span className="value" style={{ color: getColor(analysis?.object_risk) }}>
                            {(analysis?.object_risk || 0).toFixed(0)}%
                        </span>
                        <span className="label">Impact</span>
                    </div>
                    <div className="risk-detail-item">
                        <span className="value" style={{ color: getColor(analysis?.fatigue_score) }}>
                            {(analysis?.fatigue_score || 0).toFixed(0)}%
                        </span>
                        <span className="label">Fatigue</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function getColor(value) {
    if (!value || value < 35) return '#22c55e'
    if (value < 70) return '#f59e0b'
    return '#ef4444'
}
