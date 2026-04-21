import { useState, useEffect } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import GenreFilter from "./GenreFilter";
import SongList from "./SongList";
import songsData from "./data/songs";
import {
  loginWithSpotify,
  getAccessToken,
  searchTracks,
  getTrackBpm,
} from "./spotify";

const genres = ["All", ...new Set(songsData.map((song) => song.genre))];

function App() {
  const [minBpm, setMinBpm] = useState(100);
  const [maxBpm, setMaxBpm] = useState(140);
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [songs, setSongs] = useState(songsData);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [token, setToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      const accessToken = await getAccessToken();
      console.log("token:", accessToken);
      if (accessToken) {
        setToken(accessToken);
      }
    }

    // localStorageに既にトークンがあればそれを使う
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

    const results = await Promise.all(
      tracks.map(async (track) => {
        const bpm = await getTrackBpm(track.id, token);
        return {
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          bpm: bpm,
          image: track.album.images[2]?.url,
          rating: null,
        };
      }),
    );
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleRating = (id, rating) => {
    setSongs((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const handleSearchRating = (id, rating) => {
    setSearchResults((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const filteredSongs = songs
    .filter((song) => song.bpm >= minBpm && song.bpm <= maxBpm)
    .filter((song) => selectedGenre === "All" || song.genre === selectedGenre)
    .filter((song) => {
      if (ratingFilter === "all") return true;
      if (ratingFilter === "good") return song.rating === "good";
      if (ratingFilter === "bad") return song.rating === "bad";
      if (ratingFilter === "unrated") return song.rating === null;
      return true;
    })
    .slice()
    .sort((a, b) => a.bpm - b.bpm);

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
          <p className="section-label">{searchResults.length} RESULTS</p>
          <ul className="song-list">
            {searchResults.map((song) => (
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
                      onClick={() => handleSearchRating(song.id, "good")}
                    >
                      👍
                    </button>
                    <button
                      className={`rating-btn bad ${song.rating === "bad" ? "active" : ""}`}
                      onClick={() => handleSearchRating(song.id, "bad")}
                    >
                      👎
                    </button>
                  </div>
                  <span className="song-bpm-badge match-perfect">
                    {song.bpm}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

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

      <GenreFilter
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreChange={setSelectedGenre}
      />

      <div className="glass-card">
        <p className="section-label">FILTER BY RATING</p>
        <div className="genre-filter">
          {["all", "good", "bad", "unrated"].map((filter) => (
            <button
              key={filter}
              onClick={() => setRatingFilter(filter)}
              className={`genre-btn ${ratingFilter === filter ? "active" : ""}`}
            >
              {filter === "all" && "全て"}
              {filter === "good" && "👍 いい"}
              {filter === "bad" && "👎 微妙"}
              {filter === "unrated" && "未評価"}
            </button>
          ))}
        </div>
      </div>

      <p className="section-label">{filteredSongs.length} TRACKS</p>
      <SongList
        songs={filteredSongs}
        onRating={handleRating}
        targetBpm={targetBpm}
      />

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
