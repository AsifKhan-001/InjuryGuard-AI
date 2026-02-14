import { useRef, useEffect, useCallback, useState } from 'react'

export default function VideoFeed({ streaming, onToggle, onFrame, analysis, connected }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const overlayRef = useRef(null)
    const intervalRef = useRef(null)
    const [hasCamera, setHasCamera] = useState(true)

    // Start/stop camera
    useEffect(() => {
        if (streaming) {
            startCamera()
        } else {
            stopCamera()
        }
        return () => stopCamera()
    }, [streaming])

    // Draw skeleton overlay when analysis updates
    useEffect(() => {
        if (analysis?.skeleton_landmarks?.length > 0) {
            drawSkeleton(analysis.skeleton_landmarks, analysis.alert_level)
        }
    }, [analysis])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
            setHasCamera(true)

            // Start frame capture loop
            intervalRef.current = setInterval(captureAndSend, 150) // ~7 FPS
        } catch (err) {
            console.warn('Camera not available:', err)
            setHasCamera(false)
        }
    }

    const stopCamera = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop())
            videoRef.current.srcObject = null
        }
    }

    const captureAndSend = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        onFrame(base64, canvas.width, canvas.height)
    }, [onFrame])

    const drawSkeleton = (landmarks, alertLevel) => {
        const overlay = overlayRef.current
        if (!overlay) return

        const container = overlay.parentElement
        const w = container.clientWidth
        const h = container.clientHeight

        overlay.width = w
        overlay.height = h

        const ctx = overlay.getContext('2d')
        ctx.clearRect(0, 0, w, h)

        // Skeleton color based on alert level
        const colors = {
            GREEN: '#22c55e',
            YELLOW: '#f59e0b',
            RED: '#ef4444'
        }
        const color = colors[alertLevel] || '#06b6d4'

        // Connection pairs (MediaPipe indices)
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27], [24, 26], [26, 28]
        ]

        // Draw connections
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.shadowColor = color
        ctx.shadowBlur = 8

        for (const [i, j] of connections) {
            if (i < landmarks.length && j < landmarks.length) {
                const [x1, y1, , v1] = landmarks[i]
                const [x2, y2, , v2] = landmarks[j]
                if (v1 > 0.5 && v2 > 0.5) {
                    ctx.beginPath()
                    ctx.moveTo(x1 * w, y1 * h)
                    ctx.lineTo(x2 * w, y2 * h)
                    ctx.stroke()
                }
            }
        }

        // Draw keypoints
        ctx.shadowBlur = 12
        for (let i = 0; i < landmarks.length; i++) {
            const [x, y, , v] = landmarks[i]
            if (v > 0.5 && [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i)) {
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(x * w, y * h, 5, 0, Math.PI * 2)
                ctx.fill()

                // White center
                ctx.fillStyle = '#fff'
                ctx.beginPath()
                ctx.arc(x * w, y * h, 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }
        ctx.shadowBlur = 0
    }

    return (
        <div className="video-container">
            {streaming && hasCamera ? (
                <>
                    <video ref={videoRef} autoPlay muted playsInline style={{ transform: 'scaleX(-1)' }} />
                    <canvas ref={overlayRef} className="video-overlay-canvas" style={{ transform: 'scaleX(-1)' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="video-status">
                        <span className="dot" style={{ backgroundColor: connected ? '#22c55e' : '#f59e0b' }} />
                        {connected ? 'Analyzing Live' : 'Connecting...'}
                    </div>
                </>
            ) : (
                <div className="video-placeholder">
                    <div className="video-placeholder-icon">🎥</div>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                        {!hasCamera ? 'Camera not available' : 'Click Start to begin analysis'}
                    </p>
                    <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                        Real-time pose detection & injury risk analysis
                    </p>
                </div>
            )}

            <div className="video-controls">
                <button className={`btn ${streaming ? 'btn-danger' : 'btn-primary'}`} onClick={onToggle}>
                    {streaming ? '■ Stop' : '▶ Start Analysis'}
                </button>
            </div>
        </div>
    )
}
