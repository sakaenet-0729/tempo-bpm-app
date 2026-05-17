import { useState, useEffect, useRef } from "react";
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
  getMyTopTracks,
} from "./spotify";

import {
  initAppleMusic,
  loginWithAppleMusic,
  searchAppleMusic,
  getAppleMusicLibrary,
  getAppleMusicRecentlyPlayed,
  playAppleMusicTrack,
  pauseAppleMusic,
  createAppleMusicPlaylist,
} from "./applemusic";

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
  const [libraryError, setLibraryError] = useState("");
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [musicService, setMusicService] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [libraryOffset, setLibraryOffset] = useState(0);
  const [libraryHasMore, setLibraryHasMore] = useState(true);
  const loadMoreRef = useRef(null);

  // ===== 初期化 =====
  useEffect(() => {
    async function init() {
      const savedService = localStorage.getItem("music_service");

      if (savedService === "apple") {
        setMusicService("apple");
        try {
          await loginWithAppleMusic();
          setToken("apple-music-authorized");
        } catch (err) {
          console.error("Apple Music auto-login failed:", err);
          // ログイン失敗してもApple Music検索は使える
        }
        setIsInitializing(false);
        return;
      }

      if (savedService === "spotify") {
        const saved = localStorage.getItem("spotify_token");
        if (saved) {
          setMusicService("spotify");
          setToken(saved);
        } else {
          const accessToken = await getAccessToken();
          if (accessToken) {
            setMusicService("spotify");
            setToken(accessToken);
          }
        }
        setIsInitializing(false);
        return;
      }

      // 初回アクセス: Apple Music検索だけ使えるようにする
      try {
        await initAppleMusic();
      } catch (err) {
        console.error("MusicKit init error:", err);
      }
      setIsInitializing(false);
    }
    init();
  }, []);

  // ===== ライブラリ取得（ログイン時のみ） =====
  useEffect(() => {
    async function fetchLibrary() {
      if (!token || !musicService) return;

      // Apple Musicの場合
      if (musicService === "apple") {
        const cached = localStorage.getItem("apple_library_cache");
        if (cached) {
          const cachedData = JSON.parse(cached);
          setLibraryTracks(cachedData);
          setIsLibraryLoading(false);

          const needsBpm = cachedData.filter((t) => t.bpm === null);
          for (let i = 0; i < needsBpm.length; i++) {
            await new Promise((r) => setTimeout(r, 800));
            const bpm = await getTrackBpm(
              needsBpm[i].title,
              needsBpm[i].artist,
            );
            setLibraryTracks((prev) => {
              const updated = prev.map((s) =>
                s.id === needsBpm[i].id ? { ...s, bpm: bpm ?? 0 } : s,
              );
              localStorage.setItem(
                "apple_library_cache",
                JSON.stringify(updated),
              );
              return updated;
            });
          }
          return;
        }

        setIsLibraryLoading(true);

        // 1. まず最近聞いた曲を取得（最優先）
        let allTracks = [];
        try {
          const recent = await getAppleMusicRecentlyPlayed();
          // 重複除去して先頭に配置
          allTracks = [...recent];
          setLibraryTracks(allTracks);
          setIsLibraryLoading(false);

          // 最近聞いた曲のBPMを先に取得（20件）
          for (let i = 0; i < Math.min(allTracks.length, 20); i++) {
            await new Promise((r) => setTimeout(r, 800));
            const bpm = await getTrackBpm(
              allTracks[i].title,
              allTracks[i].artist,
            );
            setLibraryTracks((prev) =>
              prev.map((s) =>
                s.id === allTracks[i].id ? { ...s, bpm: bpm ?? 0 } : s,
              ),
            );
          }
        } catch (err) {
          console.error("Recent played error:", err);
          setIsLibraryLoading(false);
        }

        // 2. ライブラリの残りを20件ずつ取得
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          await new Promise((r) => setTimeout(r, 1000));
          const result = await getAppleMusicLibrary(offset, 20);
          if (result.tracks.length > 0) {
            // 既に最近聞いた曲に含まれてるものは除外
            const newTracks = result.tracks.filter(
              (t) => !allTracks.find((a) => a.id === t.id),
            );
            allTracks = [...allTracks, ...newTracks];

            setLibraryTracks((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const toAdd = newTracks.filter((t) => !existingIds.has(t.id));
              return [...prev, ...toAdd];
            });

            // 新しく追加した曲のBPMを取得
            for (const track of newTracks) {
              await new Promise((r) => setTimeout(r, 800));
              const bpm = await getTrackBpm(track.title, track.artist);
              setLibraryTracks((prev) => {
                const updated = prev.map((s) =>
                  s.id === track.id ? { ...s, bpm: bpm ?? 0 } : s,
                );
                return updated;
              });
            }

            offset += 20;
            hasMore = result.hasMore;
          } else {
            hasMore = false;
          }
        }

        // キャッシュ保存
        setLibraryTracks((current) => {
          localStorage.setItem("apple_library_cache", JSON.stringify(current));
          return current;
        });
        return;
      }

      // Spotifyの場合
      if (musicService !== "spotify") return;
      const cached = localStorage.getItem("library_cache");

      if (cached) {
        const cachedData = JSON.parse(cached);
        setLibraryTracks(cachedData);
        setIsLibraryLoading(false);

        const needsBpm = cachedData.filter((t) => t.bpm === null);
        for (const track of needsBpm) {
          await new Promise((r) => setTimeout(r, 1000));
          const bpm = await getTrackBpm(track.title, track.artist);
          setLibraryTracks((prev) => {
            const updated = prev.map((s) =>
              s.id === track.id ? { ...s, bpm: bpm ?? 0 } : s,
            );
            localStorage.setItem("library_cache", JSON.stringify(updated));
            return updated;
          });
        }
        return;
      }

      setIsLibraryLoading(true);

      // よく聞く曲を先に取得
      const topData = await getMyTopTracks(token, 0);
      const topTracks = topData.items
        .filter((item) => item)
        .map((track) => ({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          bpm: null,
          image: track.album.images[2]?.url,
        }));

      setLibraryTracks(topTracks);
      setIsLibraryLoading(false);

      // BPM取得（20件ずつ）
      for (let i = 0; i < Math.min(topTracks.length, 20); i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const bpm = await getTrackBpm(topTracks[i].title, topTracks[i].artist);
        setLibraryTracks((prev) =>
          prev.map((s) =>
            s.id === topTracks[i].id ? { ...s, bpm: bpm ?? 0 } : s,
          ),
        );
      }

      // いいねした曲
      const likedData = await getMyTracks(token);
      const likedTracks = likedData.items
        .filter((item) => item.track)
        .map((item) => ({
          id: item.track.id,
          title: item.track.name,
          artist: item.track.artists[0].name,
          bpm: null,
          image: item.track.album.images[2]?.url,
        }));

      setLibraryTracks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTracks = likedTracks.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTracks];
      });

      // プレイリストの曲
      const playlists = await getMyPlaylists(token);
      for (const pl of playlists) {
        await new Promise((r) => setTimeout(r, 2000));
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
            };
          });

        setLibraryTracks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTracks = tracks.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newTracks];
        });
      }

      // キャッシュ保存＋残りBPM取得
      setLibraryTracks((current) => {
        const unique = current.filter(
          (track, index, self) =>
            self.findIndex((t) => t.id === track.id) === index,
        );
        localStorage.setItem("library_cache", JSON.stringify(unique));

        (async () => {
          const needsBpm = unique.filter((t) => t.bpm === null);
          for (const track of needsBpm) {
            await new Promise((r) => setTimeout(r, 1000));
            const bpm = await getTrackBpm(track.title, track.artist);
            setLibraryTracks((prev) => {
              const updated = prev.map((s) =>
                s.id === track.id ? { ...s, bpm: bpm ?? 0 } : s,
              );
              localStorage.setItem("library_cache", JSON.stringify(updated));
              return updated;
            });
          }
        })();

        return unique;
      });
    }
    fetchLibrary();
  }, [token, musicService]);

  // ===== 無限スクロール =====
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          if (mode === "library") {
            setIsLoadingMore(true);
            setTimeout(() => {
              setDisplayCount((prev) => prev + 50);
              setIsLoadingMore(false);
            }, 800);
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [displayCount, libraryTracks.length, isLoadingMore, mode]);

  // ===== ハンドラー =====
  const handleLogout = () => {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("library_cache");
    localStorage.removeItem("apple_library_cache");
    localStorage.removeItem("music_service");
    setToken(null);
    setSearchResults([]);
    setLibraryTracks([]);
    setMusicService(null);
    setPlayingTrackId(null);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setPlayingTrackId(null);

    let results = [];

    if (musicService === "spotify" && token) {
      const tracks = await searchTracks(searchQuery, token);
      results = tracks.map((track) => ({
        id: track.id,
        title: track.name,
        artist: track.artists[0].name,
        bpm: null,
        image: track.album.images[2]?.url,
      }));
    } else {
      results = await searchAppleMusic(searchQuery);
    }

    setSearchResults(results);
    setIsSearching(false);

    for (const result of results) {
      const bpm = await getTrackBpm(result.title, result.artist);
      setSearchResults((prev) =>
        prev.map((s) => (s.id === result.id ? { ...s, bpm: bpm ?? 0 } : s)),
      );
    }
  };

  const handleSongSelect = async (song) => {
    if (!song.bpm || song.bpm === 0) return;
    setSelectedSong(song);
    setIsSimilarLoading(true);
    setSimilarGenre("All");
    setPlaylistName("");
    setSelectedTracks([song]);
    setSimilarMode("library");
    setPlayingTrackId(null);

    const bpmRange = 10;
    const matches = libraryTracks.filter(
      (t) =>
        t.id !== song.id &&
        t.bpm &&
        t.bpm !== 0 &&
        Math.abs(t.bpm - song.bpm) <= bpmRange,
    );
    setLibraryMatches(matches);

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
    setPlayingTrackId(null);
    if (musicService === "apple") {
      try {
        pauseAppleMusic();
      } catch {}
    }
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
    if (selectedTracks.length === 0) return;
    setIsCreatingPlaylist(true);

    if (musicService === "apple") {
      try {
        const trackIds = selectedTracks.map((t) => t.id);
        await createAppleMusicPlaylist(
          playlistName || `TEMPO - BPM ${selectedSong.bpm} Mix`,
          trackIds,
        );
      } catch (err) {
        console.error("Apple Music playlist error:", err);
      }
    } else if (musicService === "spotify" && token) {
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
    }

    setIsCreatingPlaylist(false);
    setPlaylistCreated(true);
    setTimeout(() => setPlaylistCreated(false), 3000);
  };

  // ===== フィルタリング =====
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
        const title = (song.title || "").toLowerCase();
        const artist = (song.artist || "").toLowerCase();
        return title.includes(q) || artist.includes(q);
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

  // ===== 再生ボタン =====
  const renderPlayButton = (song) => (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        if (playingTrackId === song.id) {
          setPlayingTrackId(null);
          try {
            pauseAppleMusic();
          } catch {}
          return;
        }
        setPlayingTrackId(song.id);
        // Apple Music（ログインあり・なし両方）で再生
        if (musicService !== "spotify") {
          try {
            await playAppleMusicTrack(song.id);
          } catch (err) {
            console.error("Play error:", err);
          }
        }
      }}
      style={{
        background: "none",
        border: "none",
        fontSize: "18px",
        cursor: "pointer",
        padding: "4px",
        color: playingTrackId === song.id ? "#00d672" : "#888",
        flexShrink: 0,
      }}
    >
      {playingTrackId === song.id ? "⏸" : "▶"}
    </button>
  );

  // ===== フローティングコントロール =====
  const renderFloatingControls = () => {
    const hasEmbed = musicService === "spotify" && playingTrackId;
    const hasPlaylist = selectedTracks.length > 0 && token;

    if (!hasEmbed && !hasPlaylist) return null;

    return (
      <div className="floating-controls">
        {hasEmbed && (
          <div className="floating-embed">
            <iframe
              src={`https://open.spotify.com/embed/track/${playingTrackId}?theme=0`}
              allow="autoplay; clipboard-write; encrypted-media"
              loading="lazy"
            />
          </div>
        )}

        {hasPlaylist && (
          <div className="floating-playlist">
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
        )}
      </div>
    );
  };

  const renderPlaylistMessage = () => {
    if (!playlistCreated) return null;
    const name =
      musicService === "apple"
        ? "Apple Music"
        : musicService === "spotify"
          ? "Spotify"
          : "";
    return (
      <div
        style={{
          position: "fixed",
          bottom: "120px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
        }}
      >
        <p
          style={{
            color: "#00d672",
            fontSize: "14px",
            background: "rgba(255,255,255,0.9)",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          ✓ {name}にプレイリストを作成しました！
        </p>
      </div>
    );
  };

  // ===== 初期化中 =====
  if (isInitializing) {
    return (
      <div className="app" style={{ textAlign: "center", paddingTop: "40vh" }}>
        <div className="loading-spinner" />
        <p className="section-label" style={{ marginTop: "12px" }}>
          TEMPO
        </p>
      </div>
    );
  }

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
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <div className="loading-spinner" />
            <p className="section-label" style={{ marginTop: "12px" }}>
              BPM {selectedSong.bpm} の楽曲を検索中...
            </p>
          </div>
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

            {token && (
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
            )}

            {(!token || similarMode === "discover") && (
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
              {token && similarMode === "library"
                ? `${libraryMatches.length} TRACKS`
                : `${filteredSimilarTracks.length} TRACKS`}
            </p>
            <ul className="song-list">
              {(token && similarMode === "library"
                ? libraryMatches
                : filteredSimilarTracks
              ).map((song) => {
                const isSelected = selectedTracks.find((t) => t.id === song.id);
                return (
                  <li
                    key={song.id}
                    className="song-item"
                    style={{
                      cursor: "pointer",
                      border: isSelected
                        ? "2px solid #00d672"
                        : "1px solid rgba(255, 255, 255, 0.8)",
                    }}
                    onClick={() => toggleTrackSelect(song)}
                  >
                    {song.image && (
                      <img
                        src={song.image}
                        alt=""
                        style={{ borderRadius: 8, flexShrink: 0 }}
                      />
                    )}
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
                    {renderPlayButton(song)}
                    <div
                      className={`song-bpm-badge ${isSelected ? "" : "match-perfect"}`}
                      style={
                        isSelected
                          ? { background: "#00d672", color: "#fff" }
                          : {}
                      }
                    >
                      {isSelected ? "✓" : song.bpm}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {renderFloatingControls()}
        {renderPlaylistMessage()}

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
        {token ? (
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
        ) : null}
      </div>

      {/* ログインボタン（未ログイン時） */}
      {!token && (
        <div className="glass-card" style={{ textAlign: "center" }}>
          <p className="section-label">アカウント連携</p>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px" }}>
            ログインするとマイライブラリやプレイリスト作成が使えます
          </p>
          <div className="genre-filter" style={{ justifyContent: "center" }}>
            <button
              className="genre-btn active"
              onClick={() => {
                localStorage.setItem("music_service", "spotify");
                setMusicService("spotify");
                loginWithSpotify();
              }}
            >
              Spotify
            </button>
            <button
              className="genre-btn active"
              onClick={async () => {
                try {
                  await loginWithAppleMusic();
                  setMusicService("apple");
                  setToken("apple-music-authorized");
                  localStorage.setItem("music_service", "apple");
                } catch (err) {
                  console.error("Apple Music login failed:", err);
                }
              }}
              style={{ background: "#fc3c44" }}
            >
              Apple Music
            </button>
          </div>
        </div>
      )}

      {/* タブ切り替え（ログイン時のみライブラリ表示） */}
      {token ? (
        <div className="glass-card">
          <div className="genre-filter">
            <button
              className={`genre-btn ${mode === "library" ? "active" : ""}`}
              onClick={() => setMode("library")}
            >
              マイライブラリ
            </button>
            <button
              className={`genre-btn ${mode === "search" ? "active" : ""}`}
              onClick={() => setMode("search")}
            >
              検索
            </button>
          </div>
        </div>
      ) : null}

      {/* 検索ボックス（常に表示） */}
      {(mode === "search" || !token) && (
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

      {/* ライブラリ検索（ログイン時） */}
      {token && mode === "library" && (
        <div className="glass-card">
          <p className="section-label">MY LIBRARY</p>
          {isLibraryLoading ? (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <div className="loading-spinner" />
              <p style={{ color: "#888", marginTop: "8px", fontSize: "13px" }}>
                ライブラリを読み込み中...
              </p>
            </div>
          ) : (
            <div className="search-box">
              <input
                type="text"
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="ライブラリ内を検索"
              />
            </div>
          )}
        </div>
      )}

      {isSearching && (
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <div className="loading-spinner" />
          <p className="section-label" style={{ marginTop: "12px" }}>
            検索中...
          </p>
        </div>
      )}

      {/* 曲リスト */}
      {((mode === "search" && searchResults.length > 0) ||
        (mode === "library" && libraryTracks.length > 0) ||
        (!token && searchResults.length > 0)) && (
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
            {mode === "search" || !token
              ? filteredResults.length
              : filteredLibraryTracks.length}{" "}
            TRACKS
          </p>
          <ul className="song-list">
            {(mode === "search" || !token
              ? filteredResults
              : displayedTracks
            ).map((song) => (
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
                    style={{ borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                <div className="song-info">
                  <div className="song-title">{song.title}</div>
                  <div className="song-artist">{song.artist}</div>
                </div>
                {renderPlayButton(song)}
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
              </li>
            ))}
          </ul>

          {musicService === "spotify" && playingTrackId && (
            <div className="floating-controls">
              <div className="floating-embed">
                <iframe
                  src={`https://open.spotify.com/embed/track/${playingTrackId}?theme=0`}
                  allow="autoplay; clipboard-write; encrypted-media"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {mode === "library" &&
            token &&
            displayCount < filteredLibraryTracks.length && (
              <div
                ref={loadMoreRef}
                style={{ textAlign: "center", margin: "16px 0" }}
              >
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
          <span className="nav-icon">⚙</span>
          Settings
        </button>
      </div>
    </div>
  );
}

export default App;
