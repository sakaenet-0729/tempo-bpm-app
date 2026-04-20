function SongList({ songs, onRating, targetBpm }) {
  const getMatchClass = (songBpm) => {
    const diff = Math.abs(songBpm - targetBpm);
    if (diff <= 5) return "match-perfect";
    if (diff <= 15) return "match-close";
    return "match-far";
  };

  const getMatchLabel = (songBpm) => {
    const diff = Math.abs(songBpm - targetBpm);
    if (diff <= 5) return "PERFECT MATCH";
    return null;
  };

  return (
    <>
      <ul className="song-list">
        {songs.map((song) => (
          <li key={song.id} className="song-item">
            <div className={`song-bpm-badge ${getMatchClass(song.bpm)}`}>
              {song.bpm}
            </div>
            <div className="song-info">
              <div className="song-title">{song.title}</div>
              <div className="song-artist">{song.artist}</div>
              {getMatchLabel(song.bpm) && (
                <div className="song-match-label">
                  ● {getMatchLabel(song.bpm)}
                </div>
              )}
            </div>
            <div className="song-actions">
              <div className="rating-buttons">
                <button
                  className={`rating-btn good ${song.rating === "good" ? "active" : ""}`}
                  onClick={() => onRating(song.id, "good")}
                >
                  👍
                </button>
                <button
                  className={`rating-btn bad ${song.rating === "bad" ? "active" : ""}`}
                  onClick={() => onRating(song.id, "bad")}
                >
                  👎
                </button>
              </div>
              <button className="add-btn">+</button>
            </div>
          </li>
        ))}
      </ul>
      {songs.length === 0 && (
        <p className="empty-state">該当する曲がありません</p>
      )}
    </>
  );
}

export default SongList;
