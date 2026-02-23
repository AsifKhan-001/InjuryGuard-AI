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
        const h = 110

        canvas.width = w * 2
        canvas.height = h * 2
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        ctx.scale(2, 2)

        ctx.clearRect(0, 0, w, h)

        if (history.length < 2) {
            ctx.fillStyle = '#6b6b82'
            ctx.font = '11px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('Collecting data...', w / 2, h / 2)
            return
        }

        const padding = { top: 8, right: 8, bottom: 16, left: 32 }
        const chartW = w - padding.left - padding.right
        const chartH = h - padding.top - padding.bottom

        // Y-axis labels
        ctx.fillStyle = '#6b6b82'
        ctx.font = '8px JetBrains Mono, monospace'
        ctx.textAlign = 'right'
        for (let v = 0; v <= 100; v += 25) {
            const y = padding.top + chartH - (v / 100) * chartH
            ctx.fillText(`${v}%`, padding.left - 5, y + 3)

            ctx.strokeStyle = 'rgba(255,255,255,0.03)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(padding.left, y)
            ctx.lineTo(w - padding.right, y)
            ctx.stroke()
        }

        // Threshold lines
        const yYellow = padding.top + chartH - (35 / 100) * chartH
        ctx.strokeStyle = 'rgba(255, 201, 60, 0.2)'
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(padding.left, yYellow)
        ctx.lineTo(w - padding.right, yYellow)
        ctx.stroke()

        const yRed = padding.top + chartH - (70 / 100) * chartH
        ctx.strokeStyle = 'rgba(255, 59, 92, 0.2)'
        ctx.beginPath()
        ctx.moveTo(padding.left, yRed)
        ctx.lineTo(w - padding.right, yRed)
        ctx.stroke()
        ctx.setLineDash([])

        // Data points
        const points = history.map((d, i) => ({
            x: padding.left + (i / (history.length - 1)) * chartW,
            y: padding.top + chartH - (d.risk / 100) * chartH,
            risk: d.risk,
            level: d.level
        }))

        // Gradient fill
        const lastRisk = history[history.length - 1]?.risk || 0
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
        if (lastRisk > 70) {
            gradient.addColorStop(0, 'rgba(255, 59, 92, 0.2)')
            gradient.addColorStop(1, 'rgba(255, 59, 92, 0)')
        } else if (lastRisk > 35) {
            gradient.addColorStop(0, 'rgba(255, 201, 60, 0.15)')
            gradient.addColorStop(1, 'rgba(255, 201, 60, 0)')
        } else {
            gradient.addColorStop(0, 'rgba(0, 255, 170, 0.1)')
            gradient.addColorStop(1, 'rgba(0, 255, 170, 0)')
        }

        // Fill area
        ctx.beginPath()
        ctx.moveTo(points[0].x, padding.top + chartH)
        points.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.lineTo(points[points.length - 1].x, padding.top + chartH)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()

        // Smooth line
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            const xc = (points[i - 1].x + points[i].x) / 2
            const yc = (points[i - 1].y + points[i].y) / 2
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc)
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)

        const lineColor = lastRisk > 70 ? '#ff3b5c' : lastRisk > 35 ? '#ffc93c' : '#00ffaa'
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.shadowColor = lineColor
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0

        // Current point
        const last = points[points.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = lineColor
        ctx.fill()
        ctx.beginPath()
        ctx.arc(last.x, last.y, 7, 0, Math.PI * 2)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3
        ctx.stroke()
        ctx.globalAlpha = 1
    }

    return (
        <div>
            <div style={{ position: 'relative' }}>
                <canvas ref={canvasRef} />
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '0.6rem', color: 'var(--text-dim)',
                marginTop: '4px', fontFamily: 'var(--font-mono)',
            }}>
                <span>{history.length} readings</span>
                <span>LIVE</span>
            </div>
        </div>
    )
}
