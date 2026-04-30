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
  createPlaylist,
  addTracksToPlaylist,
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
  const [similarGenre, setSimilarGenre] = useState("All");
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [playlistCreated, setPlaylistCreated] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [libraryMatches, setLibraryMatches] = useState([]);
  const [similarMode, setSimilarMode] = useState("library");

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

  useEffect(() => {
    async function fetchLibrary() {
      if (token) {
        setIsLibraryLoading(true);

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

        // まずいいねした曲だけ表示
        setLibraryTracks(likedTracks);

        // プレイリスト一覧を取得
        const playlists = await getMyPlaylists(token);

        // プレイリストを1つずつ取得して追加
        for (const pl of playlists) {
          // 1秒待ってからリクエスト（API制限対策）
          await new Promise((r) => setTimeout(r, 1000));

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

          // 重複を除いて追加
          setLibraryTracks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTracks = tracks.filter((t) => !existingIds.has(t.id));
            return [...prev, ...newTracks];
          });
        }

        setIsLibraryLoading(false);

        // BPMを順番に取得
        setLibraryTracks((current) => {
          const tracksToFetch = [...current];
          (async () => {
            for (const track of tracksToFetch) {
              await new Promise((r) => setTimeout(r, 500));
              const bpm = await getTrackBpm(track.title, track.artist);
              setLibraryTracks((prev) =>
                prev.map((s) =>
                  s.id === track.id ? { ...s, bpm: bpm ?? 0 } : s,
                ),
              );
            }
          })();
          return current;
        });
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

  const handleRating = (id, rating) => {
    setSearchResults((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const handleSongSelect = async (song) => {
    if (!song.bpm || song.bpm === 0) return;
    setSelectedSong(song);
    setIsSimilarLoading(true);
    setSimilarGenre("All");
    setPlaylistName("");
    setSelectedTracks([]);
    setSimilarMode("library");

    // ライブラリ内の同じBPM帯の曲をフィルタ
    const bpmRange = 10;
    const libraryMatches = libraryTracks.filter(
      (t) =>
        t.id !== song.id &&
        t.bpm &&
        t.bpm !== 0 &&
        Math.abs(t.bpm - song.bpm) <= bpmRange,
    );
    setLibraryMatches(libraryMatches);

    // GetSongBPMからも取得
    const results = await searchByBpm(song.bpm);
    setSimilarTracks(results);
    setIsSimilarLoading(false);
    window.scrollTo(0, 0);
  };

  const handleBackFromSimilar = () => {
    setSelectedSong(null);
    setSimilarTracks([]);
    setSimilarGenre("All");
    setSelectedTracks([]);
    setPlaylistCreated(false);
    setSimilarMode("library");
  };

  const toggleTrackSelect = (song) => {
    setSelectedTracks((prev) => {
      if (prev.find((t) => t.id === song.id)) {
        return prev.filter((t) => t.id !== song.id);
      }
      return [...prev, song];
    });
  };

  const handleCreatePlaylist = async () => {
    if (selectedTracks.length === 0 || !token) return;
    setIsCreatingPlaylist(true);

    const playlist = await createPlaylist(
      token,
      playlistName || `TEMPO - BPM ${selectedSong.bpm} Mix`,
    );

    if (playlist.id) {
      const trackUris = [];
      for (const track of selectedTracks) {
        const results = await searchTracks(
          `${track.title} ${track.artist}`,
          token,
        );
        if (results.length > 0) {
          trackUris.push(`spotify:track:${results[0].id}`);
        }
      }

      if (trackUris.length > 0) {
        await addTracksToPlaylist(token, playlist.id, trackUris);
      }
    }

    setIsCreatingPlaylist(false);
    setPlaylistCreated(true);
    setTimeout(() => setPlaylistCreated(false), 3000);
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

  const filteredSimilarTracks = similarTracks.filter(
    (s) => similarGenre === "All" || s.genre === similarGenre,
  );

  const targetBpm = Math.round((minBpm + maxBpm) / 2);

  // ===== 類似曲画面 =====
  if (selectedSong) {
    return (
      <div className="app">
        <div className="app-header">
          <button
            onClick={handleBackFromSimilar}
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
          <h1>TEMPO</h1>
        </div>

        {isSimilarLoading ? (
          <p
            className="section-label"
            style={{ textAlign: "center", marginTop: "32px" }}
          >
            BPM {selectedSong.bpm} の楽曲を検索中...
          </p>
        ) : (
          <>
            <div className="glass-card">
              <p className="section-label">SIMILAR TRACKS</p>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <span className="song-title">{selectedSong.title}</span>
                <span style={{ color: "#888" }}> - {selectedSong.artist}</span>
              </div>
              <div className="bpm-display" style={{ margin: "8px 0" }}>
                <span className="bpm-value">{selectedSong.bpm}</span>
                <span className="bpm-label">BPM</span>
              </div>
            </div>

            <div className="glass-card">
              <div className="genre-filter">
                <button
                  className={`genre-btn ${similarMode === "library" ? "active" : ""}`}
                  onClick={() => setSimilarMode("library")}
                >
                  マイライブラリ
                </button>
                <button
                  className={`genre-btn ${similarMode === "discover" ? "active" : ""}`}
                  onClick={() => setSimilarMode("discover")}
                >
                  オススメ
                </button>
              </div>
            </div>

            {similarMode === "discover" && (
              <div className="glass-card">
                <p className="section-label">GENRE</p>
                <div className="genre-filter">
                  {["All", ...new Set(similarTracks.map((s) => s.genre))].map(
                    (genre) => (
                      <button
                        key={genre}
                        className={`genre-btn ${similarGenre === genre ? "active" : ""}`}
                        onClick={() => setSimilarGenre(genre)}
                      >
                        {genre}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            <p className="section-label">
              {similarMode === "library"
                ? `${libraryMatches.length} TRACKS`
                : `${filteredSimilarTracks.length} TRACKS`}
            </p>
            <ul className="song-list">
              {(similarMode === "library"
                ? libraryMatches
                : filteredSimilarTracks
              ).map((song) => (
                <li
                  key={song.id}
                  className="song-item"
                  style={{
                    cursor: "pointer",
                    border: selectedTracks.find((t) => t.id === song.id)
                      ? "2px solid #00d672"
                      : "1px solid rgba(255, 255, 255, 0.8)",
                  }}
                  onClick={() => toggleTrackSelect(song)}
                >
                  {song.image && (
                    <img
                      src={song.image}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 8 }}
                    />
                  )}
                  <div className="song-bpm-badge match-perfect">{song.bpm}</div>
                  <div className="song-info">
                    <div className="song-title">{song.title}</div>
                    <div className="song-artist">{song.artist}</div>
                  </div>
                  {song.genre && (
                    <span
                      className="genre-btn"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                    >
                      {song.genre}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {selectedTracks.length > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: "72px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: "420px",
              padding: "0 16px",
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
                borderRadius: "16px",
                padding: "12px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              }}
            >
              <div className="search-box" style={{ marginBottom: "8px" }}>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="プレイリストに名前を追加"
                  style={{ fontSize: "13px" }}
                />
              </div>
              <button
                onClick={handleCreatePlaylist}
                className="genre-btn active"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px",
                  fontSize: "15px",
                  borderRadius: "10px",
                }}
                disabled={isCreatingPlaylist}
              >
                {isCreatingPlaylist
                  ? "作成中..."
                  : `${selectedTracks.length}曲でプレイリスト作成`}
              </button>
            </div>
          </div>
        )}

        {playlistCreated && (
          <div
            style={{
              position: "fixed",
              bottom: "120px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
            }}
          >
            <p
              style={{
                color: "#00d672",
                fontSize: "14px",
                background: "rgba(255,255,255,0.9)",
                padding: "8px 16px",
                borderRadius: "8px",
              }}
            >
              ✓ Spotifyにプレイリストを作成しました！
            </p>
          </div>
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

  // ===== 通常画面 =====
  return (
    <div className="app">
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
        )}
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
          )}{" "}
        </>
      )}

      {isSearching && <p className="section-label">検索中...</p>}

      {((mode === "search" && searchResults.length > 0) ||
        (mode === "library" && libraryTracks.length > 0)) && (
        <>
          <div className="bpm-display">
            <span className="bpm-value">{targetBpm}</span>
            <span className="bpm-label">BPM</span>
          </div>{" "}
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
                  cursor: song.bpm && song.bpm !== 0 ? "pointer" : "default",
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRating(song.id, "good");
                      }}
                    >
                      👍
                    </button>
                    <button
                      className={`rating-btn bad ${song.rating === "bad" ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRating(song.id, "bad");
                      }}
                    >
                      👎
                    </button>
                  </div>
                  <span
                    className={`song-bpm-badge ${song.bpm === null ? "" : song.bpm === 0 ? "match-far" : "match-perfect"}`}
                  >
                    {song.bpm === null ? (
                      <div className="loading-spinner-small" />
                    ) : song.bpm === 0 ? (
                      "-"
                    ) : (
                      song.bpm
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {isSearching && <p className="section-label">検索中...</p>}
          {mode === "library" &&
            displayCount < filteredLibraryTracks.length &&
            !isLoadingMore && (
              <button
                onClick={() => {
                  setIsLoadingMore(true);
                  setTimeout(() => {
                    setDisplayCount((prev) => prev + 50);
                    setIsLoadingMore(false);
                  }, 800);
                }}
                className="genre-btn active"
                style={{ display: "block", margin: "16px auto" }}
              >
                もっと見る（残り
                {filteredLibraryTracks.length - displayCount}曲）
              </button>
            )}
          {isLoadingMore && (
            <div style={{ textAlign: "center", margin: "16px 0" }}>
              <div className="loading-spinner" />
            </div>
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
    </div>
  );
}

export default App;
