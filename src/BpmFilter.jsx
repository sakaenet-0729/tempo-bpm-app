function BpmFilter({ minBpm, maxBpm, onMinChange, onMaxChange }) {
  const min = 60;
  const max = 200;

  const leftPercent = ((minBpm - min) / (max - min)) * 100;
  const rightPercent = ((maxBpm - min) / (max - min)) * 100;

  return (
    <div className="glass-card">
      <p className="section-label">TEMPO RANGE</p>
      <div className="bpm-filter">
        <div className="bpm-range-display">
          <span className="bpm-num">{minBpm}</span>
          <span className="bpm-separator">— BPM —</span>
          <span className="bpm-num">{maxBpm}</span>
        </div>
        <div className="range-slider">
          <div
            className="range-track"
            style={{
              left: `${leftPercent}%`,
              width: `${rightPercent - leftPercent}%`,
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={minBpm}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value <= maxBpm) onMinChange(value);
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            value={maxBpm}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= minBpm) onMaxChange(value);
            }}
            style={{ pointerEvents: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

export default BpmFilter;
