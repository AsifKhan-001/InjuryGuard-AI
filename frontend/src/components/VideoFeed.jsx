import { useRef, useEffect, useCallback, useState } from 'react'

export default function VideoFeed({ streaming, onToggle, onFrame, analysis, connected }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const intervalRef = useRef(null)
    const [hasCamera, setHasCamera] = useState(true)

    // Start/stop camera
    useEffect(() => {
        let subscribed = true

        if (streaming) {
            startCamera().then(() => {
                if (!subscribed) stopCamera()
            })
        } else {
            stopCamera()
        }
        return () => {
            subscribed = false
            stopCamera()
        }
    }, [streaming])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320 },
                    height: { ideal: 240 },
                    frameRate: { ideal: 15 },
                }
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }
            setHasCamera(true)

            // Start frame capture loop — 80ms interval (~12 FPS)
            intervalRef.current = setInterval(captureAndSend, 80)
        } catch (err) {
            console.error('Camera Error:', err)
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

        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 240

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Lower quality JPEG for faster transfer
        const base64 = canvas.toDataURL('image/jpeg', 0.5)
        onFrame(base64, canvas.width, canvas.height)
    }, [onFrame])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            {streaming && hasCamera ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            transform: 'scaleX(-1)'
                        }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </>
            ) : (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100%', gap: '16px'
                }}>
                    <div style={{
                        width: '80px', height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08), rgba(var(--secondary-rgb), 0.05))',
                        border: '1px solid rgba(var(--primary-rgb), 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2rem',
                        animation: 'float-subtle 3s ease-in-out infinite',
                    }}>
                        🎯
                    </div>
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--primary)',
                        opacity: 0.6,
                        fontSize: '0.8rem',
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                    }}>
                        System Standby
                    </div>
                    <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        maxWidth: '260px',
                        textAlign: 'center',
                        lineHeight: '1.6',
                    }}>
                        Press Initialize to start real-time injury detection
                    </div>
                </div>
            )}
        </div>
    )
}
