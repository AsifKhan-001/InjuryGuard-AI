import { useRef, useEffect } from 'react'

export default function HistoryChart({ history }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        drawChart()
    }, [history])

    const drawChart = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const container = canvas.parentElement
        const w = container.clientWidth
        const h = 120

        canvas.width = w * 2 // retina
        canvas.height = h * 2
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        ctx.scale(2, 2)

        ctx.clearRect(0, 0, w, h)

        if (history.length < 2) {
            ctx.fillStyle = '#64748b'
            ctx.font = '12px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('Collecting data...', w / 2, h / 2)
            return
        }

        const padding = { top: 10, right: 10, bottom: 20, left: 35 }
        const chartW = w - padding.left - padding.right
        const chartH = h - padding.top - padding.bottom

        // Y-axis labels
        ctx.fillStyle = '#64748b'
        ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'right'
        for (let v = 0; v <= 100; v += 25) {
            const y = padding.top + chartH - (v / 100) * chartH
            ctx.fillText(`${v}%`, padding.left - 6, y + 3)

            // Grid line
            ctx.strokeStyle = 'rgba(255,255,255,0.04)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(padding.left, y)
            ctx.lineTo(w - padding.right, y)
            ctx.stroke()
        }

        // Threshold lines
        // Yellow threshold (35%)
        const yYellow = padding.top + chartH - (35 / 100) * chartH
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(padding.left, yYellow)
        ctx.lineTo(w - padding.right, yYellow)
        ctx.stroke()

        // Red threshold (70%)
        const yRed = padding.top + chartH - (70 / 100) * chartH
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
        ctx.beginPath()
        ctx.moveTo(padding.left, yRed)
        ctx.lineTo(w - padding.right, yRed)
        ctx.stroke()
        ctx.setLineDash([])

        // Data line
        const points = history.map((d, i) => ({
            x: padding.left + (i / (history.length - 1)) * chartW,
            y: padding.top + chartH - (d.risk / 100) * chartH,
            risk: d.risk,
            level: d.level
        }))

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
        const lastRisk = history[history.length - 1]?.risk || 0
        if (lastRisk > 70) {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
        } else if (lastRisk > 35) {
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.2)')
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0)')
        } else {
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.15)')
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')
        }

        // Fill area under curve
        ctx.beginPath()
        ctx.moveTo(points[0].x, padding.top + chartH)
        points.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()

        // Draw line
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            // Smooth curve
            const xc = (points[i - 1].x + points[i].x) / 2
            const yc = (points[i - 1].y + points[i].y) / 2
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc)
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)

        const lineColor = lastRisk > 70 ? '#ef4444' : lastRisk > 35 ? '#f59e0b' : '#22c55e'
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.shadowColor = lineColor
        ctx.shadowBlur = 6
        ctx.stroke()
        ctx.shadowBlur = 0

        // Current point glow
        const last = points[points.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = lineColor
        ctx.fill()
        ctx.beginPath()
        ctx.arc(last.x, last.y, 7, 0, Math.PI * 2)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.4
        ctx.stroke()
        ctx.globalAlpha = 1
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Risk Timeline</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Last {history.length} readings
                </span>
            </div>
            <div className="history-chart-container">
                <canvas ref={canvasRef} className="history-chart-canvas" />
            </div>
        </div>
    )
}
