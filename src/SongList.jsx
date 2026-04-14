function SongList({ songs }) {
  return (
    <>
      <ul className="song-list">
        {songs.map((song) => (
          <li key={song.id} className="song-item">
            <span className="song-title">{song.title}</span>
            <span> - {song.artist}</span>
            <span className="song-bpm">（BPM：{song.bpm}）</span>
          </li>
        ))}
      </ul>
      {songs.length === 0 && <p>該当する曲がありません</p>}
    </>
  );
}
export default SongList;
