function BpmFilter({ minBpm, maxBpm, onMinChange, onMaxChange }) {
  const min = 60;
  const max = 200;

  const leftPercent = ((minBpm - min) / (max - min)) * 100;
  const rightPercent = (maxBpm - min) / (max - min) + 100;

  return (
    <div className="bpm-filter">
      <div className="bpm-labels">
        <span>
          BPM:{minBpm}〜{maxBpm}
        </span>
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
        />
      </div>
    </div>
  );
}

export default BpmFilter;
