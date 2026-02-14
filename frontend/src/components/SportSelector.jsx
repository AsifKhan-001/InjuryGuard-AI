const SPORTS = [
    { id: 'football', label: '⚽ Football', emoji: '⚽' },
    { id: 'cricket', label: '🏏 Cricket', emoji: '🏏' },
    { id: 'weightlifting', label: '🏋️ Weights', emoji: '🏋️' },
    { id: 'generic', label: '🏃 Generic', emoji: '🏃' },
]

export default function SportSelector({ sport, onChange }) {
    return (
        <div className="sport-selector">
            {SPORTS.map(s => (
                <button
                    key={s.id}
                    className={`sport-btn ${sport === s.id ? 'active' : ''}`}
                    onClick={() => onChange(s.id)}
                    title={s.label}
                >
                    {s.label}
                </button>
            ))}
        </div>
    )
}
