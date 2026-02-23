import { useMemo } from 'react'

export default function PlayerStatus({ analysis }) {
    const joints = analysis?.joint_angles || {}
    const asymmetry = analysis?.asymmetry || {}
    const issues = analysis?.issues || []
    const landmarks = analysis?.skeleton_landmarks || []
    const postureAlerts = analysis?.posture_alerts || []

    // Build set of danger joints
    const dangerJointSet = useMemo(() => {
        const set = new Set()
        for (const alert of postureAlerts) {
            set.add(`${alert.joint}_${alert.side}`)
            set.add(alert.joint)
        }
        return set
    }, [postureAlerts])

    const displayJoints = [
        { name: 'L Knee', key: 'knee_left', icon: '🦵' },
        { name: 'R Knee', key: 'knee_right', icon: '🦵' },
        { name: 'L Hip', key: 'hip_left', icon: '🫁' },
        { name: 'R Hip', key: 'hip_right', icon: '🫁' },
        { name: 'L Shoulder', key: 'shoulder_left', icon: '💪' },
        { name: 'R Shoulder', key: 'shoulder_right', icon: '💪' },
        { name: 'L Elbow', key: 'elbow_left', icon: '🤸' },
        { name: 'R Elbow', key: 'elbow_right', icon: '🤸' },
        { name: 'Spine', key: 'spine_center', icon: '🧘' },
    ]

    // Compute body diagram positions from actual landmarks
    const bodyPositions = useMemo(() => {
        if (!landmarks || landmarks.length < 33) return null
        // MediaPipe landmark indices
        return {
            head: landmarks[0],        // nose
            lShoulder: landmarks[11],
            rShoulder: landmarks[12],
            lElbow: landmarks[13],
            rElbow: landmarks[14],
            lWrist: landmarks[15],
            rWrist: landmarks[16],
            lHip: landmarks[23],
            rHip: landmarks[24],
            lKnee: landmarks[25],
            rKnee: landmarks[26],
            lAnkle: landmarks[27],
            rAnkle: landmarks[28],
        }
    }, [landmarks])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Status Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    letterSpacing: '1px',
                }}>
                    BIOMECHANICS
                </span>
                <span style={{
                    background: Object.keys(joints).length > 0
                        ? 'rgba(var(--primary-rgb), 0.1)'
                        : 'rgba(255,255,255,0.03)',
                    color: Object.keys(joints).length > 0 ? 'var(--primary)' : 'var(--text-dim)',
                    fontSize: '0.65rem',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${Object.keys(joints).length > 0 ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(255,255,255,0.04)'}`,
                    fontWeight: 600,
                    letterSpacing: '1px',
                }}>
                    {Object.keys(joints).length > 0 ? '● ACTIVE' : '○ WAITING'}
                </span>
            </div>

            {/* Body Diagram — animated from landmarks */}
            <div style={{
                display: 'flex', gap: '10px',
            }}>
                <div style={{ flex: '0 0 90px', position: 'relative' }}>
                    <svg viewBox="0 0 100 180" fill="none" style={{ width: '100%' }}>
                        {bodyPositions ? (
                            <AnimatedBody pos={bodyPositions} issues={issues} dangerJointSet={dangerJointSet} />
                        ) : (
                            <StaticBody issues={issues} dangerJointSet={dangerJointSet} />
                        )}
                    </svg>
                </div>

                {/* Joint readings */}
                <div style={{ flex: 1, fontSize: '0.75rem', overflow: 'auto' }}>
                    {displayJoints.map(({ name, key, icon }) => {
                        const val = joints[key]
                        const isDanger = dangerJointSet.has(key) || dangerJointSet.has(key.split('_')[0])
                        return (
                            <div key={key} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '3px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                animation: isDanger ? 'danger-flash 1s ease infinite' : 'none',
                                borderRadius: '4px',
                                paddingLeft: isDanger ? '6px' : '0',
                                transition: 'all 0.3s',
                            }}>
                                <span style={{ color: isDanger ? 'var(--alert-red)' : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.65rem' }}>{icon}</span> {name}
                                </span>
                                <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    color: isDanger ? 'var(--alert-red)' : getAngleColor(val),
                                    fontWeight: isDanger ? 700 : 400,
                                    fontSize: '0.72rem',
                                    textShadow: isDanger ? '0 0 8px var(--alert-red)' : 'none',
                                }}>
                                    {val != null ? `${val.toFixed(0)}°` : '—'}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Asymmetry */}
            {Object.keys(asymmetry).length > 0 && (
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    paddingTop: '8px',
                }}>
                    <div style={{
                        fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '4px',
                        textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600,
                    }}>
                        Asymmetry
                    </div>
                    {Object.entries(asymmetry).slice(0, 3).map(([joint, diff]) => (
                        <div key={joint} style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '2px 0', fontSize: '0.7rem',
                        }}>
                            <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{joint}</span>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                color: diff > 15 ? 'var(--alert-red)' : diff > 8 ? 'var(--alert-yellow)' : 'var(--primary)',
                                fontWeight: diff > 15 ? 700 : 400,
                            }}>
                                {diff.toFixed(1)}°
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// Animated body that follows actual landmark positions
function AnimatedBody({ pos, issues, dangerJointSet }) {
    // Map normalized coordinates to SVG viewBox (0-100 x, 0-180 y)
    const scale = (lm, xScale = 100, yScale = 180) => {
        if (!lm || lm[3] < 0.2) return null
        return { x: lm[0] * xScale, y: lm[1] * yScale }
    }

    const pts = {
        head: scale(pos.head) || { x: 50, y: 20 },
        ls: scale(pos.lShoulder) || { x: 35, y: 48 },
        rs: scale(pos.rShoulder) || { x: 65, y: 48 },
        le: scale(pos.lElbow) || { x: 20, y: 70 },
        re: scale(pos.rElbow) || { x: 80, y: 70 },
        lw: scale(pos.lWrist) || { x: 12, y: 95 },
        rw: scale(pos.rWrist) || { x: 88, y: 95 },
        lh: scale(pos.lHip) || { x: 38, y: 87 },
        rh: scale(pos.rHip) || { x: 62, y: 87 },
        lk: scale(pos.lKnee) || { x: 35, y: 130 },
        rk: scale(pos.rKnee) || { x: 65, y: 130 },
        la: scale(pos.lAnkle) || { x: 30, y: 170 },
        ra: scale(pos.rAnkle) || { x: 70, y: 170 },
    }

    const getC = (zone) => {
        if (dangerJointSet.has(zone)) return '#ff3b5c'
        return getZoneColor(zone, issues)
    }

    return (
        <>
            {/* Head */}
            <circle cx={pts.head.x} cy={pts.head.y} r="10" stroke={getC('head')} strokeWidth="1.5" fill="none" />
            {/* Torso */}
            <line x1={pts.ls.x} y1={pts.ls.y} x2={pts.rs.x} y2={pts.rs.y} stroke={getC('shoulder')} strokeWidth="1.5" />
            <line x1={pts.ls.x} y1={pts.ls.y} x2={pts.lh.x} y2={pts.lh.y} stroke={getC('spine')} strokeWidth="1.5" />
            <line x1={pts.rs.x} y1={pts.rs.y} x2={pts.rh.x} y2={pts.rh.y} stroke={getC('spine')} strokeWidth="1.5" />
            <line x1={pts.lh.x} y1={pts.lh.y} x2={pts.rh.x} y2={pts.rh.y} stroke={getC('hip')} strokeWidth="1.5" />
            {/* Left arm */}
            <line x1={pts.ls.x} y1={pts.ls.y} x2={pts.le.x} y2={pts.le.y} stroke={getC('shoulder_left')} strokeWidth="1.5" />
            <line x1={pts.le.x} y1={pts.le.y} x2={pts.lw.x} y2={pts.lw.y} stroke={getC('elbow_left')} strokeWidth="1.5" />
            {/* Right arm */}
            <line x1={pts.rs.x} y1={pts.rs.y} x2={pts.re.x} y2={pts.re.y} stroke={getC('shoulder_right')} strokeWidth="1.5" />
            <line x1={pts.re.x} y1={pts.re.y} x2={pts.rw.x} y2={pts.rw.y} stroke={getC('elbow_right')} strokeWidth="1.5" />
            {/* Left leg */}
            <line x1={pts.lh.x} y1={pts.lh.y} x2={pts.lk.x} y2={pts.lk.y} stroke={getC('hip_left')} strokeWidth="1.5" />
            <line x1={pts.lk.x} y1={pts.lk.y} x2={pts.la.x} y2={pts.la.y} stroke={getC('knee_left')} strokeWidth="1.5" />
            {/* Right leg */}
            <line x1={pts.rh.x} y1={pts.rh.y} x2={pts.rk.x} y2={pts.rk.y} stroke={getC('hip_right')} strokeWidth="1.5" />
            <line x1={pts.rk.x} y1={pts.rk.y} x2={pts.ra.x} y2={pts.ra.y} stroke={getC('knee_right')} strokeWidth="1.5" />
            {/* Joint dots */}
            {Object.values(pts).map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--secondary)" opacity="0.7" />
            ))}
        </>
    )
}

// Static fallback body diagram
function StaticBody({ issues, dangerJointSet }) {
    const getC = (zone) => {
        if (dangerJointSet.has(zone)) return '#ff3b5c'
        return getZoneColor(zone, issues)
    }

    return (
        <>
            <circle cx="50" cy="20" r="10" stroke={getC('head')} strokeWidth="1.5" fill="none" />
            <line x1="50" y1="30" x2="50" y2="42" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            <rect x="30" y="42" width="40" height="45" rx="5" stroke={getC('spine')} strokeWidth="1.5" fill="none" />
            <line x1="30" y1="48" x2="12" y2="70" stroke={getC('shoulder_left')} strokeWidth="1.5" />
            <line x1="12" y1="70" x2="8" y2="95" stroke={getC('elbow_left')} strokeWidth="1.5" />
            <line x1="70" y1="48" x2="88" y2="70" stroke={getC('shoulder_right')} strokeWidth="1.5" />
            <line x1="88" y1="70" x2="92" y2="95" stroke={getC('elbow_right')} strokeWidth="1.5" />
            <line x1="38" y1="87" x2="30" y2="130" stroke={getC('hip_left')} strokeWidth="1.5" />
            <line x1="30" y1="130" x2="25" y2="170" stroke={getC('knee_left')} strokeWidth="1.5" />
            <line x1="62" y1="87" x2="70" y2="130" stroke={getC('hip_right')} strokeWidth="1.5" />
            <line x1="70" y1="130" x2="75" y2="170" stroke={getC('knee_right')} strokeWidth="1.5" />
            {[
                [50, 20], [30, 48], [70, 48], [12, 70], [88, 70],
                [38, 87], [62, 87], [30, 130], [70, 130], [25, 170], [75, 170]
            ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="2.5" fill="var(--secondary)" opacity="0.4" />
            ))}
        </>
    )
}

function getZoneColor(zone, issues) {
    const issueStr = issues.join(' ').toLowerCase()
    const zoneLower = zone.toLowerCase().replace('_', ' ')
    if (issueStr.includes(zoneLower) || issueStr.includes(zone.split('_')[0])) {
        return '#ff3b5c'
    }
    return 'rgba(255,255,255,0.12)'
}

function getAngleColor(val) {
    if (val == null) return 'var(--text-dim)'
    if (val < 40 || val > 175) return 'var(--alert-red)'
    if (val < 60 || val > 165) return 'var(--alert-yellow)'
    return 'var(--primary)'
}
