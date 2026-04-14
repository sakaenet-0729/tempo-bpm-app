function BpmFilter({ minBpm, maxBpm, onMinChange, onMaxChange }) {
  return (
    <div className="bpm-filter">
      <label>
        最小BPM:
        <input
          type="number"
          value={minBpm}
          onChange={(e) => onMinChange(Number(e.target.value))}
        />
      </label>
      <label>
        最大BPM:
        <input
          type="number"
          value={maxBpm}
          onChange={(e) => onMaxChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

export default BpmFilter;
