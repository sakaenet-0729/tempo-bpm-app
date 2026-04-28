import { useState, useEffect } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import {
  loginWithSpotify,
  getAccessToken,
  searchTracks,
  getTrackBpm,
  getMyTracks,
  getMyPlaylists,
  getPlaylistTracks,
  searchByBpm,
} from "./spotify";

function App() {
  const [minBpm, setMinBpm] = useState(60);
  const [maxBpm, setMaxBpm] = useState(200);
  const [token, setToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [mode, setMode] = useState("search");
  const [displayCount, setDisplayCount] = useState(50);
  const [selectedSong, setSelectedSong] = useState(null);
  const [similarTracks, setSimilarTracks] = useState([]);

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

  // トークンが取れたらライブラリ取得
  useEffect(() => {
    async function fetchLibrary() {
      if (token) {
        // いいねした曲を取得
        const likedData = await getMyTracks(token);
        const likedTracks = likedData.items
          .filter((item) => item.track)
          .map((item) => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists[0].name,
            bpm: null,
            image: item.track.album.images[2]?.url,
            rating: null,
          }));

        // プレイリストの曲を取得
        const playlists = await getMyPlaylists(token);
        let playlistTracks = [];
        for (const pl of playlists) {
          const items = await getPlaylistTracks(pl.id, token);
          const tracks = items
            .filter((item) => item.track || item.item)
            .map((item) => {
              const t = item.track || item.item;
              return {
                id: t.id,
                title: t.name,
                artist: t.artists[0].name,
                bpm: null,
                image: t.album.images[2]?.url,
                rating: null,
              };
            });
          playlistTracks = [...playlistTracks, ...tracks];
        }

        // 重複を除去して統合
        const allTracks = [...likedTracks, ...playlistTracks];
        const unique = allTracks.filter(
          (track, index, self) =>
            self.findIndex((t) => t.id === track.id) === index,
        );

        setLibraryTracks(unique);
        console.log("ライブラリ曲数:", unique.length);

        // BPMを取得
        for (const track of unique) {
          console.log("BPM取得中:", track.title, track.artist);
          const bpm = await getTrackBpm(track.title, track.artist);
          console.log("BPM結果:", track.title, bpm);
          setLibraryTracks((prev) =>
            prev.map((s) => (s.id === track.id ? { ...s, bpm: bpm ?? 0 } : s)),
          );
        }
      }
    }
    fetchLibrary();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("spotify_token");
    setToken(null);
    setSearchResults([]);
  };

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
        prev.map((s) => (s.id === result.id ? { ...s, bpm: bpm ?? 0 } : s)),
      );
    }
  };

  const handlePlaylistSelect = async (playlist) => {
    setSelectedPlaylist(playlist);
    setIsSearching(true);

    const items = await getPlaylistTracks(playlist.id, token);

    const results = items
      .filter((item) => item.track)
      .map((item) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists[0].name,
        bpm: null,
        image: item.track.album.images[2]?.url,
        rating: null,
      }));

    setPlaylistTracks(results);
    setIsSearching(false);

    for (const result of results) {
      const bpm = await getTrackBpm(result.title, result.artist);
      setPlaylistTracks((prev) =>
        prev.map((s) => (s.id === result.id ? { ...s, bpm: bpm ?? 0 } : s)),
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

  const filteredLibraryTracks = libraryTracks
    .filter((song) => {
      if (libraryQuery) {
        const q = libraryQuery.toLowerCase();
        return (
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .filter((song) => {
      if (song.bpm === null || song.bpm === 0) return true;
      return song.bpm >= minBpm && song.bpm <= maxBpm;
    })
    .sort((a, b) => {
      if (a.bpm === null || a.bpm === 0) return 1;
      if (b.bpm === null || b.bpm === 0) return -1;
      return a.bpm - b.bpm;
    });

  const displayedTracks =
    mode === "search"
      ? filteredResults
      : filteredLibraryTracks.slice(0, displayCount);

  const targetBpm = Math.round((minBpm + maxBpm) / 2);

  const handleSongSelect = async (song) => {
    if (!song.bpm || song.bpm === 0) return;
    setSelectedSong(song);
    const results = await searchByBpm(song.bpm);
    setSimilarTracks(results);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      {selectedSong && similarTracks.length > 0 ? (
        <>
          <div className="app-header">
            <button
              onClick={() => {
                setSelectedSong(null);
                setSimilarTracks([]);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#00d672",
                fontSize: "20px",
                cursor: "pointer",
              }}
            >
              ← 戻る
            </button>
          </div>

          <div className="bpm-display">
            <span className="bpm-value">{selectedSong.bpm}</span>
            <span className="bpm-label">BPM</span>
          </div>

          <div className="glass-card">
            <p className="section-label">
              {selectedSong.title} - {selectedSong.artist} と同じBPMの楽曲
            </p>
          </div>

          <p className="section-label">{similarTracks.length} TRACKS</p>
          <ul className="song-list">
            {similarTracks.map((song) => (
              <li key={song.id} className="song-item">
                <div className="song-info">
                  <div className="song-title">{song.title}</div>
                  <div className="song-artist">{song.artist}</div>
                </div>
                <span className="song-bpm-badge match-perfect">{song.bpm}</span>
              </li>
            ))}
          </ul>

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
        </>
      ) : (
        <>
          <div className="app-header">
            <h1>TEMPO</h1>
            {!token ? (
              <button className="genre-btn active" onClick={loginWithSpotify}>
                Spotifyログイン
              </button>
            ) : (
              <button
                onClick={handleLogout}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00d672",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ● 接続済み（ログアウト）
              </button>
            )}{" "}
          </div>

          {token && (
            <>
              <div className="glass-card">
                <div className="genre-filter">
                  <button
                    className={`genre-btn ${mode === "search" ? "active" : ""}`}
                    onClick={() => setMode("search")}
                  >
                    検索
                  </button>
                  <button
                    className={`genre-btn ${mode === "library" ? "active" : ""}`}
                    onClick={() => setMode("library")}
                  >
                    マイライブラリ
                  </button>
                </div>
              </div>

              {mode === "search" && (
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

              {mode === "library" && (
                <div className="glass-card">
                  <p className="section-label">MY LIBRARY</p>
                  <div className="search-box">
                    <input
                      type="text"
                      value={libraryQuery}
                      onChange={(e) => setLibraryQuery(e.target.value)}
                      placeholder="ライブラリ内を検索"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {isSearching && <p className="section-label">検索中...</p>}

          {((mode === "search" && searchResults.length > 0) ||
            (mode === "library" && libraryTracks.length > 0)) && (
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

              <p className="section-label">
                {mode === "search"
                  ? filteredResults.length
                  : filteredLibraryTracks.length}{" "}
                TRACKS
              </p>
              <ul className="song-list">
                {displayedTracks.map((song) => (
                  <li
                    key={song.id}
                    className="song-item"
                    style={{
                      cursor:
                        song.bpm && song.bpm !== 0 ? "pointer" : "default",
                    }}
                    onClick={() => handleSongSelect(song)}
                  >
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
                      <span
                        className={`song-bpm-badge ${song.bpm === null ? "" : song.bpm === 0 ? "match-far" : "match-perfect"}`}
                      >
                        {song.bpm === null
                          ? "..."
                          : song.bpm === 0
                            ? "-"
                            : song.bpm}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {mode === "library" &&
                displayCount < filteredLibraryTracks.length && (
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 50)}
                    className="genre-btn active"
                    style={{ display: "block", margin: "16px auto" }}
                  >
                    もっと見る（残り
                    {filteredLibraryTracks.length - displayCount}
                    曲）
                  </button>
                )}
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
        </>
      )}
    </div>
  );
}

export default App;
