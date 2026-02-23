import { useRef, useEffect, useMemo } from 'react'

/**
 * AROverlay — Real-time skeleton overlay with smooth interpolation.
 * The skeleton mirrors the actual person's pose by rendering all 33
 * MediaPipe landmarks with lerp smoothing between frames.
 */

// All skeleton connections (MediaPipe Pose indices)
const CONNECTIONS = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],   // Left eye → ear
    [0, 4], [4, 5], [5, 6], [6, 8],   // Right eye → ear
    [9, 10],                            // Mouth
    // Torso
    [11, 12],                           // Shoulders
    [11, 23], [12, 24],                // Shoulder → hip
    [23, 24],                           // Hips
    // Left arm
    [11, 13], [13, 15],                // Shoulder → elbow → wrist
    [15, 17], [15, 19], [15, 21],      // Wrist → fingers
    [17, 19],
    // Right arm
    [12, 14], [14, 16],
    [16, 18], [16, 20], [16, 22],
    [18, 20],
    // Left leg
    [23, 25], [25, 27],                // Hip → knee → ankle
    [27, 29], [27, 31], [29, 31],      // Ankle → foot
    // Right leg
    [24, 26], [26, 28],
    [28, 30], [28, 32], [30, 32],
]

// Joint index → joint name for issue matching
const JOINT_NAME_MAP = {
    11: 'shoulder', 12: 'shoulder',
    13: 'elbow', 14: 'elbow',
    15: 'wrist', 16: 'wrist',
    23: 'hip', 24: 'hip',
    25: 'knee', 26: 'knee',
    27: 'ankle', 28: 'ankle',
}

// Connection visual groups for coloring
const LIMB_GROUPS = {
    torso: [[11, 12], [11, 23], [12, 24], [23, 24]],
    leftArm: [[11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19]],
    rightArm: [[12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20]],
    leftLeg: [[23, 25], [25, 27], [27, 29], [27, 31], [29, 31]],
    rightLeg: [[24, 26], [26, 28], [28, 30], [28, 32], [30, 32]],
}

// Lerp factor for smoothing (0 = no change, 1 = instant snap)
const LERP_FACTOR = 0.45

function lerp(a, b, t) {
    return a + (b - a) * t
}

export default function AROverlay({ analysis }) {
    const smoothedRef = useRef(null)

    // Get current landmarks
    const rawLandmarks = analysis?.skeleton_landmarks || null
    const issues = analysis?.issues || []
    const postureAlerts = analysis?.posture_alerts || []

    // Build set of danger joints from posture alerts
    const dangerJoints = useMemo(() => {
        const set = new Set()
        for (const alert of postureAlerts) {
            set.add(alert.joint)
        }
        return set
    }, [postureAlerts])

    // Smooth landmarks using lerp
    const landmarks = useMemo(() => {
        if (!rawLandmarks || rawLandmarks.length === 0) {
            smoothedRef.current = null
            return null
        }

        if (!smoothedRef.current || smoothedRef.current.length !== rawLandmarks.length) {
            // First frame or landmark count changed — snap to position
            smoothedRef.current = rawLandmarks.map(lm => [...lm])
            return smoothedRef.current
        }

        // Lerp each landmark toward new position
        const smoothed = smoothedRef.current.map((prev, i) => {
            const curr = rawLandmarks[i]
            if (!curr) return prev
            return [
                lerp(prev[0], curr[0], LERP_FACTOR),
                lerp(prev[1], curr[1], LERP_FACTOR),
                lerp(prev[2], curr[2], LERP_FACTOR),
                curr[3], // visibility — don't interpolate
            ]
        })
        smoothedRef.current = smoothed
        return smoothed
    }, [rawLandmarks])

    if (!landmarks) return null

    // Helper: check if a joint is in danger
    const isJointDanger = (idx) => {
        const name = JOINT_NAME_MAP[idx]
        if (!name) return false
        // Check posture alerts
        if (dangerJoints.has(name)) return true
        // Check issues text
        const issueStr = issues.join(' ').toLowerCase()
        return issueStr.includes(name)
    }

    // Get connection color
    const getLineColor = (startIdx, endIdx) => {
        const danger1 = isJointDanger(startIdx)
        const danger2 = isJointDanger(endIdx)
        if (danger1 || danger2) return '#ff3b5c'
        return 'rgba(0, 255, 170, 0.55)'
    }

    const getLineGlow = (startIdx, endIdx) => {
        const danger1 = isJointDanger(startIdx)
        const danger2 = isJointDanger(endIdx)
        if (danger1 || danger2) return 'url(#glowRed)'
        return 'url(#glowGreen)'
    }

    return (
        <svg
            className="ar-overlay"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
            }}
        >
            <defs>
                {/* Glow filters */}
                <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0.004" result="blur" />
                    <feFlood floodColor="#00ffaa" floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0.006" result="blur" />
                    <feFlood floodColor="#ff3b5c" floodOpacity="0.8" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <filter id="jointGlow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="0.005" />
                </filter>
            </defs>

            {/* Draw Connections (Bones) */}
            {CONNECTIONS.map(([start, end], i) => {
                const p1 = landmarks[start]
                const p2 = landmarks[end]
                if (!p1 || !p2 || p1[3] < 0.3 || p2[3] < 0.3) return null

                const color = getLineColor(start, end)
                const isDanger = color === '#ff3b5c'

                return (
                    <g key={`conn-${i}`}>
                        {/* Glow layer */}
                        <line
                            x1={p1[0]} y1={p1[1]}
                            x2={p2[0]} y2={p2[1]}
                            stroke={color}
                            strokeWidth={isDanger ? 0.012 : 0.006}
                            strokeLinecap="round"
                            opacity={isDanger ? 0.3 : 0.2}
                            filter={getLineGlow(start, end)}
                        />
                        {/* Main line */}
                        <line
                            x1={p1[0]} y1={p1[1]}
                            x2={p2[0]} y2={p2[1]}
                            stroke={color}
                            strokeWidth={isDanger ? 0.007 : 0.004}
                            strokeLinecap="round"
                            opacity={isDanger ? 1 : 0.8}
                        />
                    </g>
                )
            })}

            {/* Draw Joints */}
            {landmarks.map((lm, i) => {
                if (lm[3] < 0.3) return null
                // Skip some face landmarks for cleanliness (keep nose, eyes, ears, mouth)
                if (i > 10 && i < 11) return null

                const isDanger = isJointDanger(i)
                const isBody = i >= 11
                const radius = isDanger ? 0.012 : (isBody ? 0.007 : 0.004)
                const color = isDanger ? '#ff3b5c' : (isBody ? '#00ffaa' : 'rgba(0, 200, 255, 0.6)')

                return (
                    <g key={`joint-${i}`}>
                        {/* Outer glow for danger joints */}
                        {isDanger && (
                            <circle
                                cx={lm[0]} cy={lm[1]}
                                r={0.022}
                                fill="none"
                                stroke="#ff3b5c"
                                strokeWidth="0.002"
                                opacity="0.4"
                                className="pulse-anim"
                            />
                        )}
                        {/* Glow layer */}
                        <circle
                            cx={lm[0]} cy={lm[1]}
                            r={radius * 1.8}
                            fill={color}
                            opacity={0.15}
                            filter="url(#jointGlow)"
                        />
                        {/* Main joint */}
                        <circle
                            cx={lm[0]} cy={lm[1]}
                            r={radius}
                            fill={color}
                            stroke="rgba(0,0,0,0.3)"
                            strokeWidth="0.0015"
                        />
                    </g>
                )
            })}

            {/* Danger joint warning markers */}
            {postureAlerts.map((alert, i) => {
                // Find relevant landmark index
                const indices = Object.entries(JOINT_NAME_MAP)
                    .filter(([, name]) => name === alert.joint)
                    .map(([idx]) => parseInt(idx))

                return indices.map(idx => {
                    const lm = landmarks[idx]
                    if (!lm || lm[3] < 0.3) return null
                    return (
                        <g key={`warning-${i}-${idx}`}>
                            {/* Expanding pulse ring */}
                            <circle
                                cx={lm[0]} cy={lm[1]}
                                r={0.03}
                                fill="none"
                                stroke="#ff3b5c"
                                strokeWidth="0.002"
                                opacity="0.6"
                            >
                                <animate
                                    attributeName="r"
                                    from="0.015"
                                    to="0.04"
                                    dur="1s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="opacity"
                                    from="0.8"
                                    to="0"
                                    dur="1s"
                                    repeatCount="indefinite"
                                />
                            </circle>
                        </g>
                    )
                })
            })}
        </svg>
    )
}
