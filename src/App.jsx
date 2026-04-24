import { useState, useEffect } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import {
  loginWithSpotify,
  getAccessToken,
  searchTracks,
  getTrackBpm,
} from "./spotify";

function App() {
  const [minBpm, setMinBpm] = useState(60);
  const [maxBpm, setMaxBpm] = useState(200);
  const [token, setToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      const accessToken = await getAccessToken();
      if (accessToken) {
        setToken(accessToken);
      }
    }

    const saved = localStorage.getItem("spotify_token");
    if (saved) {
      setToken(saved);
    } else {
      fetchToken();
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery || !token) return;
    setIsSearching(true);

    const tracks = await searchTracks(searchQuery, token);

    const results = tracks.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists[0].name,
      bpm: null,
      image: track.album.images[2]?.url,
      rating: null,
    }));
    setSearchResults(results);
    setIsSearching(false);

    for (const result of results) {
      const bpm = await getTrackBpm(result.title, result.artist);
      setSearchResults((prev) =>
        prev.map((s) => (s.id === result.id ? { ...s, bpm } : s)),
      );
    }
  };

  const handleRating = (id, rating) => {
    setSearchResults((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const filteredResults = searchResults
    .filter((song) => {
      if (song.bpm === null) return true;
      return song.bpm >= minBpm && song.bpm <= maxBpm;
    })
    .sort((a, b) => {
      if (a.bpm === null) return 1;
      if (b.bpm === null) return -1;
      return a.bpm - b.bpm;
    });

  const targetBpm = Math.round((minBpm + maxBpm) / 2);

  return (
    <div className="app">
      <div className="app-header">
        <h1>TEMPO</h1>
        {!token ? (
          <button className="genre-btn active" onClick={loginWithSpotify}>
            Spotifyログイン
          </button>
        ) : (
          <span style={{ color: "#00d672", fontSize: "13px" }}>● 接続済み</span>
        )}
      </div>

      {token && (
        <div className="glass-card">
          <p className="section-label">SEARCH TRACKS</p>
          <div className="search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="曲名やアーティスト名で検索"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button onClick={handleSearch} className="search-btn">
              検索
            </button>
          </div>
        </div>
      )}

      {isSearching && <p className="section-label">検索中...</p>}

      {searchResults.length > 0 && (
        <>
          <div className="bpm-display">
            <span className="bpm-value">{targetBpm}</span>
            <span className="bpm-label">BPM</span>
          </div>

          <BpmFilter
            minBpm={minBpm}
            maxBpm={maxBpm}
            onMinChange={setMinBpm}
            onMaxChange={setMaxBpm}
          />

          <p className="section-label">{filteredResults.length} TRACKS</p>
          <ul className="song-list">
            {filteredResults.map((song) => (
              <li key={song.id} className="song-item">
                {song.image && (
                  <img
                    src={song.image}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 8 }}
                  />
                )}
                <div className="song-info">
                  <div className="song-title">{song.title}</div>
                  <div className="song-artist">{song.artist}</div>
                </div>
                <div className="song-actions">
                  <div className="rating-buttons">
                    <button
                      className={`rating-btn good ${song.rating === "good" ? "active" : ""}`}
                      onClick={() => handleRating(song.id, "good")}
                    >
                      👍
                    </button>
                    <button
                      className={`rating-btn bad ${song.rating === "bad" ? "active" : ""}`}
                      onClick={() => handleRating(song.id, "bad")}
                    >
                      👎
                    </button>
                  </div>
                  <span className="song-bpm-badge match-perfect">
                    {song.bpm ? song.bpm : "..."}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="bottom-nav">
        <button className="nav-item">
          <span className="nav-icon">◎</span>
          BPM
        </button>
        <button className="nav-item active">
          <span className="nav-icon">≡</span>
          Tracks
        </button>
        <button className="nav-item">
          <span className="nav-icon">▶</span>
          Playing
        </button>
        <button className="nav-item">
          <span className="nav-icon">⚙</span>
          Settings
        </button>
      </div>
    </div>
  );
}

export default App;
