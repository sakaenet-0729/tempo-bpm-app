function SongList({ songs, onRating }) {
  return (
    <>
      <ul className="song-list">
        {songs.map((song) => (
          <li key={song.id} className="song-item">
            <div>
              <span className="song-title">{song.title}</span>
              <span> - {song.artist}</span>
            </div>
            <div className="song-right">
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
              <span className="song-bpm">（BPM：{song.bpm}）</span>
            </div>
          </li>
        ))}
      </ul>
      {songs.length === 0 && <p>該当する曲がありません</p>}
    </>
  );
}
export default SongList;
