import { useState, useEffect, useRef } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import {
  loginWithSpotify,
  getAccessToken,
  searchTracks,
  getTrackBpm,
  checkBpmApi,
  getMyTracks,
  getMyPlaylists,
  getPlaylistTracks,
  getPlaylistTracksAll,
  searchByBpm,
  createPlaylist,
  addTracksToPlaylist,
  getMyTopTracks,
  getRecentlyPlayed,
  renamePlaylist,
  removeTracksFromPlaylist,
  reorderPlaylistTracks,
} from "./spotify";

import {
  loginWithAppleMusic,
  searchAppleMusic,
  getAppleMusicLibrary,
  playAppleMusicTrack,
  pauseAppleMusic,
  createAppleMusicPlaylist,
  getAppleMusicRecentlyPlayed,
} from "./applemusic";

function App() {
  const loadMoreRef = useRef(null);

  const [minBpm, setMinBpm] = useState(60);
  const [maxBpm, setMaxBpm] = useState(200);
  const [token, setToken] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [mode, setMode] = useState("library");
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
  const [musicService, setMusicService] = useState("spotify");
  const [appleMusicInstance, setAppleMusicInstance] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [bpmProgress, setBpmProgress] = useState({ loaded: 0, total: 0 });

  // ===== Play画面用state =====
  const [navTab, setNavTab] = useState("tracks"); // "tracks" | "play"
  const [playlists, setPlaylists] = useState([]);
  const [isPlaylistsLoading, setIsPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // 詳細表示中のプレイリスト
  const [playlistTracks, setPlaylistTracks] = useState([]); // 詳細の曲一覧
  const [isPlaylistTracksLoading, setIsPlaylistTracksLoading] = useState(false);
  const [editingPlaylistName, setEditingPlaylistName] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dragIndex, setDragIndex] = useState(null); // ドラッグ中のインデックス
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [backgroundTracks, setBackgroundTracks] = useState([]);
  const [bgTotal, setBgTotal] = useState(0); // ライブラリ総曲数
  const [bgLoaded, setBgLoaded] = useState(0); // BPM取得済み曲数
  const SCOPES =
    "user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-top-read";

  // ===== トークン取得 =====
  useEffect(() => {
    async function init() {
      const savedService = localStorage.getItem("music_service");

      if (savedService === "apple") {
        setMusicService("apple");
        try {
          const music = await loginWithAppleMusic();
          setAppleMusicInstance(music);
          setToken("apple-music-authorized");
        } catch (err) {
          console.error("Apple Music auto-login failed:", err);
        }
        setIsInitializing(false);
        return;
      }

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
    }
    init();
  }, []);

  // ===== ライブラリ取得 =====
  useEffect(() => {
    let cancelled = false; // コンポーネントがアンマウントされたら処理を止める

    // BPMを安全に更新するヘルパー（APIが落ちていても表示が壊れない）
    async function fetchBpmSafely(track) {
      try {
        const bpm = await getTrackBpm(track.title, track.artist);
        return { id: track.id, bpm: bpm ?? 0 };
      } catch {
        return { id: track.id, bpm: 0 };
      }
    }

    // バックグラウンド用：BPM取得結果をchunk自体に埋め込んで返す
    async function fetchBpmForBackground(tracks) {
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 300;
      const result = [...tracks];

      const apiAlive = await checkBpmApi();
      if (!apiAlive) return result; // 落ちていたらbpm:nullのまま返す

      for (let i = 0; i < result.length; i += BATCH_SIZE) {
        if (cancelled) return result;
        const batch = result.slice(i, i + BATCH_SIZE);
        const bpmResults = await Promise.all(batch.map(fetchBpmSafely));
        bpmResults.forEach((r) => {
          const idx = result.findIndex((t) => t.id === r.id);
          if (idx !== -1) result[idx] = { ...result[idx], bpm: r.bpm };
        });
        if (i + BATCH_SIZE < result.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY));
        }
      }
      return result;
    }

    // 3曲ずつ並列でBPM取得（APIレート制限に配慮しつつ高速化）
    async function fetchBpmInBatches(tracks, cacheKey) {
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 300;

      // APIが落ちていたら即スキップ
      const apiAlive = await checkBpmApi();
      if (!apiAlive) {
        setBpmProgress({ loaded: 0, total: 0 });
        return;
      }

      setBpmProgress({ loaded: 0, total: tracks.length });

      for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
        if (cancelled) return;

        const batch = tracks.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchBpmSafely));

        if (cancelled) return;

        setBpmProgress((prev) => ({
          ...prev,
          loaded: Math.min(prev.loaded + results.length, prev.total),
        }));

        setLibraryTracks((prev) => {
          const bpmMap = new Map(results.map((r) => [r.id, r.bpm]));
          const updated = prev.map((s) =>
            bpmMap.has(s.id) ? { ...s, bpm: bpmMap.get(s.id) } : s,
          );
          if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(updated));
          return updated;
        });

        if (i + BATCH_SIZE < tracks.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY));
        }
      }

      setBpmProgress({ loaded: 0, total: 0 });
    }

    async function fetchLibrary() {
      if (!token) return;

      // ===== Apple Musicの場合 =====
      if (musicService === "apple") {
        const cached = localStorage.getItem("apple_library_cache");
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (!cancelled) {
              setLibraryTracks(cachedData.slice(0, 50));
              setIsLibraryLoading(false);
            }

            // キャッシュから50件ずつBPM取得しながら自動追加
            const CHUNK = 50;
            for (let i = 0; i < cachedData.length; i += CHUNK) {
              if (cancelled) return;
              const chunk = cachedData
                .slice(i, i + CHUNK)
                .filter((t) => t.bpm === null);
              if (chunk.length > 0) {
                await fetchBpmInBatches(chunk, "apple_library_cache");
              }
              if (cancelled) return;
              const nextChunk = cachedData.slice(i + CHUNK, i + CHUNK * 2);
              if (nextChunk.length > 0 && !cancelled) {
                setLibraryTracks((prev) => {
                  const existingKeys = new Set(
                    prev.map((t) => `${t.title}|||${t.artist}`),
                  );
                  const newTracks = nextChunk.filter(
                    (t) => !existingKeys.has(`${t.title}|||${t.artist}`),
                  );
                  return [...prev, ...newTracks];
                });
              }
            }
          } catch {
            localStorage.removeItem("apple_library_cache");
            localStorage.removeItem("apple_background_cache");
          }
          return;
        }

        setIsLibraryLoading(true);
        try {
          const [allTracks, recentTracks] = await Promise.all([
            getAppleMusicLibrary(),
            getAppleMusicRecentlyPlayed(),
          ]);
          if (cancelled) return;

          // RecentlyPlayed順に並び替え
          let sorted;
          if (recentTracks.length > 0) {
            const recentKeys = recentTracks.map(
              (t) => `${t.title}|||${t.artist}`,
            );
            const recentKeySet = new Set(recentKeys);
            const recentFirst = allTracks
              .filter((t) => recentKeySet.has(`${t.title}|||${t.artist}`))
              .sort(
                (a, b) =>
                  recentKeys.indexOf(`${a.title}|||${a.artist}`) -
                  recentKeys.indexOf(`${b.title}|||${b.artist}`),
              );
            const rest = allTracks.filter(
              (t) => !recentKeySet.has(`${t.title}|||${t.artist}`),
            );
            sorted = [...recentFirst, ...rest];
          } else {
            sorted = allTracks;
          }

          // 最初の50件を即表示
          const CHUNK = 50;
          setLibraryTracks(sorted.slice(0, CHUNK));
          localStorage.setItem("apple_library_cache", JSON.stringify(sorted));
          setIsLibraryLoading(false);

          // 残りをbackgroundTracksに保存しながら進捗表示
          const rest = sorted.slice(CHUNK);
          if (rest.length > 0) {
            setBgProgress({ loaded: CHUNK, total: sorted.length });
            setBackgroundTracks(rest);
          }

          // BPM取得（最初の50件から順番に）
          await fetchBpmInBatches(
            sorted.slice(0, CHUNK),
            "apple_library_cache",
          );
          if (!cancelled) setBgProgress({ loaded: 0, total: 0 });
        } catch (err) {
          console.error("Apple Music library error:", err);
          if (!cancelled) setIsLibraryLoading(false);
        }
        return;
      }

      // ===== Spotifyの場合 =====
      const cached = localStorage.getItem("library_cache");
      const cachedTopIds = localStorage.getItem("spotify_top_ids");

      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          let sorted = cachedData;

          // top曲の順番が保存されていれば先頭に並び替え
          if (cachedTopIds) {
            const topIds = JSON.parse(cachedTopIds);
            const topSet = new Set(topIds);
            const topFirst = cachedData
              .filter((t) => topSet.has(t.id))
              .sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id));
            const rest = cachedData.filter((t) => !topSet.has(t.id));
            sorted = [...topFirst, ...rest];
          }

          if (!cancelled) {
            setLibraryTracks(sorted);
            setIsLibraryLoading(false);
          }
          const needsBpm = sorted.filter((t) => t.bpm === null);
          await fetchBpmInBatches(needsBpm, "library_cache");
        } catch {
          localStorage.removeItem("library_cache");
          localStorage.removeItem("spotify_top_ids");
        }
        return;
      }

      setIsLibraryLoading(true);

      // Step1: いいね曲を即取得→即表示
      const likedData = await getMyTracks(token);
      if (cancelled) return;

      const likedTracks = (likedData.items || [])
        .filter((item) => item?.track)
        .map((item) => ({
          id: item.track.id,
          title: item.track.name,
          artist: item.track.artists[0].name,
          bpm: null,
          image: item.track.album.images[2]?.url,
        }));

      setLibraryTracks(likedTracks);
      setBgTotal(likedTracks.length);
      setIsLibraryLoading(false);

      // Step2: いいね曲のBPM取得
      await fetchBpmInBatches(likedTracks, "library_cache");
      if (cancelled) return;
      setBgLoaded(likedTracks.length);

      // Step3: プレイリストをバックグラウンドで50件取得→BPM取得→追加を繰り返す
      (async () => {
        const playlistsData = await getMyPlaylists(token);
        if (cancelled) return;

        const CHUNK = 50;
        const seenKeys = new Set(
          likedTracks.map((t) => `${t.title}|||${t.artist}`),
        );
        let buf = [];
        let totalCount = likedTracks.length;

        const processBuf = async () => {
          if (buf.length === 0 || cancelled) return;
          const chunk = [...buf];
          buf = [];
          // BPM取得してchunk自体に埋め込む
          const chunkWithBpm = await fetchBpmForBackground(chunk);
          if (cancelled) return;
          // BPM取得済みのものだけbackgroundTracksに追加
          setBackgroundTracks((prev) => [...prev, ...chunkWithBpm]);
          setBgLoaded((prev) => prev + chunkWithBpm.length);
        };

        for (const pl of playlistsData) {
          if (cancelled) return;
          const items = await getPlaylistTracks(pl.id, token);
          const tracks = (items || [])
            .filter((item) => item?.track || item?.item)
            .map((item) => {
              const t = item.track || item.item;
              return {
                id: t.id,
                title: t.name,
                artist: t.artists[0]?.name || "Unknown",
                bpm: null,
                image: t.album?.images[2]?.url,
              };
            })
            .filter((t) => {
              const key = `${t.title}|||${t.artist}`;
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            });

          totalCount += tracks.length;
          buf.push(...tracks);
          setBgTotal(totalCount);

          if (buf.length >= CHUNK) {
            await processBuf();
          }
        }

        // 残りも処理
        if (buf.length > 0 && !cancelled) {
          await processBuf();
        }

        // 全曲キャッシュ保存
        if (!cancelled) {
          setBackgroundTracks((bg) => {
            setLibraryTracks((current) => {
              localStorage.setItem(
                "library_cache",
                JSON.stringify([...current, ...bg]),
              );
              return current;
            });
            return bg;
          });
        }
      })();
    }

    fetchLibrary();
    return () => {
      cancelled = true;
    };
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
    setMusicService("spotify");
    setAppleMusicInstance(null);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    if (musicService === "spotify" && !token) return;
    setIsSearching(true);
    setPlayingTrackId(null);

    let results = [];

    if (musicService === "spotify") {
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

    const bpmRange = 5;
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
      pauseAppleMusic();
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
    } else {
      if (!token) return;
      const playlist = await createPlaylist(
        token,
        playlistName || `TEMPO - BPM ${selectedSong.bpm} Mix`,
      );
      console.log("作成されたプレイリスト:", playlist);

      if (playlist.id) {
        const trackUris = [];
        for (const track of selectedTracks) {
          const results = await searchTracks(
            `${track.title} ${track.artist}`,
            token,
          );
          console.log("検索結果:", track.title, results.length);
          if (results.length > 0) {
            trackUris.push(`spotify:track:${results[0].id}`);
          }
        }
        console.log("追加するトラック:", trackUris);
        if (trackUris.length > 0) {
          const addResult = await addTracksToPlaylist(
            token,
            playlist.id,
            trackUris,
          );
          console.log("追加結果:", addResult);
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
          if (musicService === "apple") {
            pauseAppleMusic();
          }
          return;
        }
        setPlayingTrackId(song.id);
        if (musicService === "apple") {
          try {
            await playAppleMusicTrack(song.id);
          } catch (err) {
            console.error("Apple Music play error:", err);
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
    const hasPlaylist = selectedTracks.length > 0;

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

  // ===== プレイリスト作成完了メッセージ =====
  const renderPlaylistCreatedMessage = () => {
    if (!playlistCreated) return null;
    const serviceName = musicService === "apple" ? "Apple Music" : "Spotify";
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
          ✓ {serviceName}にプレイリストを作成しました！
        </p>
      </div>
    );
  };

  // ===== Play画面: プレイリスト一覧取得 =====
  useEffect(() => {
    if (navTab !== "play" || !token) return;
    async function loadPlaylists() {
      setIsPlaylistsLoading(true);
      if (musicService === "spotify") {
        const data = await getMyPlaylists(token);
        // "Created by TEMPO"のdescriptionで絞り込み（nameより確実）
        setPlaylists(
          data.filter(
            (pl) =>
              pl.description?.includes("TEMPO") || pl.name?.startsWith("TEMPO"),
          ),
        );
      } else {
        // Apple Music: ライブラリのプレイリスト取得
        try {
          const music = MusicKit.getInstance();
          const result = await music.api.music(
            "/v1/me/library/playlists?limit=100",
          );
          setPlaylists(
            (result.data.data || [])
              .filter((pl) => pl.attributes.name?.startsWith("TEMPO"))
              .map((pl) => ({
                id: pl.id,
                name: pl.attributes.name,
                trackCount: pl.attributes.trackCount,
                image: pl.attributes.artwork?.url
                  ?.replace("{w}", "64")
                  ?.replace("{h}", "64"),
              })),
          );
        } catch {
          setPlaylists([]);
        }
      }
      setIsPlaylistsLoading(false);
    }
    loadPlaylists();
  }, [navTab, token, musicService]);

  // ===== Play画面: プレイリスト詳細取得 =====
  const handleOpenPlaylist = async (playlist) => {
    setSelectedPlaylist(playlist);
    setNewPlaylistName(playlist.name);
    setIsPlaylistTracksLoading(true);
    if (musicService === "spotify") {
      const items = await getPlaylistTracksAll(playlist.id, token);
      setPlaylistTracks(
        items
          .filter((i) => i?.track)
          .map((i) => ({
            id: i.track.id,
            uri: `spotify:track:${i.track.id}`,
            title: i.track.name,
            artist: i.track.artists[0]?.name || "Unknown",
            image: i.track.album?.images[2]?.url,
          })),
      );
    } else {
      try {
        const music = MusicKit.getInstance();
        const result = await music.api.music(
          `/v1/me/library/playlists/${playlist.id}/tracks?limit=100`,
        );
        setPlaylistTracks(
          (result.data.data || []).map((t) => ({
            id: t.id,
            uri: t.id,
            title: t.attributes.name,
            artist: t.attributes.artistName,
            image: t.attributes.artwork?.url
              ?.replace("{w}", "64")
              ?.replace("{h}", "64"),
          })),
        );
      } catch {
        setPlaylistTracks([]);
      }
    }
    setIsPlaylistTracksLoading(false);
  };

  // ===== Play画面: 曲削除 =====
  const handleRemoveTrack = async (trackUri, index) => {
    if (musicService === "spotify") {
      console.log("削除リクエスト:", {
        playlistId: selectedPlaylist.id,
        trackUri,
        token: token?.slice(0, 10),
      });
      const ok = await removeTracksFromPlaylist(token, selectedPlaylist.id, [
        trackUri,
      ]);
      console.log("削除結果:", ok);
      if (!ok) {
        alert("削除に失敗しました。ログアウト→再ログインをお試しください。");
        return;
      }
    } else {
      // Apple Musicはライブラリプレイリストの曲削除
      try {
        const music = MusicKit.getInstance();
        await music.api.music(
          `/v1/me/library/playlists/${selectedPlaylist.id}/tracks`,
          {},
          {
            fetchOptions: {
              method: "DELETE",
              body: JSON.stringify({
                data: [{ id: trackUri, type: "library-songs" }],
              }),
            },
          },
        );
      } catch (e) {
        console.error(e);
      }
    }
    setPlaylistTracks((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Play画面: プレイリスト名変更 =====
  const handleRenamePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    if (musicService === "spotify") {
      await renamePlaylist(token, selectedPlaylist.id, newPlaylistName);
    } else {
      try {
        const music = MusicKit.getInstance();
        await music.api.music(
          `/v1/me/library/playlists/${selectedPlaylist.id}`,
          {},
          {
            fetchOptions: {
              method: "PATCH",
              body: JSON.stringify({ attributes: { name: newPlaylistName } }),
            },
          },
        );
      } catch (e) {
        console.error(e);
      }
    }
    setSelectedPlaylist((prev) => ({ ...prev, name: newPlaylistName }));
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === selectedPlaylist.id ? { ...pl, name: newPlaylistName } : pl,
      ),
    );
    setEditingPlaylistName(false);
  };

  // ===== Play画面: シェア =====
  const handleSharePlaylist = () => {
    const url =
      musicService === "spotify"
        ? `https://open.spotify.com/playlist/${selectedPlaylist.id}`
        : `https://music.apple.com/library/playlist/${selectedPlaylist.id}`;
    navigator.clipboard.writeText(url);
    alert("URLをコピーしました！");
  };

  // ===== Play画面: ドラッグ&ドロップ並び替え =====
  const handleDragStart = (index) => setDragIndex(index);
  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...playlistTracks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setPlaylistTracks(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
    if (musicService === "spotify") {
      await reorderPlaylistTracks(
        token,
        selectedPlaylist.id,
        dragIndex,
        dropIndex > dragIndex ? dropIndex + 1 : dropIndex,
      );
    }
  };

  // ===== Play画面: タッチ並び替え（モバイル）=====
  const touchStartY = useRef(null);
  const touchDragIndex = useRef(null);
  const handleTouchStart = (e, index) => {
    touchStartY.current = e.touches[0].clientY;
    touchDragIndex.current = index;
    setDragIndex(index);
  };
  const handleTouchMove = (e) => {
    const y = e.touches[0].clientY;
    const elements = document.querySelectorAll(".playlist-track-item");
    let overIndex = null;
    elements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) overIndex = i;
    });
    if (overIndex !== null) setDragOverIndex(overIndex);
  };
  const handleTouchEnd = async () => {
    if (
      touchDragIndex.current !== null &&
      dragOverIndex !== null &&
      touchDragIndex.current !== dragOverIndex
    ) {
      const reordered = [...playlistTracks];
      const [moved] = reordered.splice(touchDragIndex.current, 1);
      reordered.splice(dragOverIndex, 0, moved);
      setPlaylistTracks(reordered);
      if (musicService === "spotify") {
        await reorderPlaylistTracks(
          token,
          selectedPlaylist.id,
          touchDragIndex.current,
          dragOverIndex > touchDragIndex.current
            ? dragOverIndex + 1
            : dragOverIndex,
        );
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
    touchDragIndex.current = null;
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
        {renderPlaylistCreatedMessage()}

        <div className="bottom-nav">
          <button className="nav-item">
            <span className="nav-icon">◎</span>
            BPM
          </button>
          <button className="nav-item active">
            <span className="nav-icon">≡</span>
            Tracks
          </button>
          <button className="nav-item" onClick={() => setNavTab("play")}>
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

  // ===== Play画面 =====
  if (navTab === "play" && token) {
    // プレイリスト詳細画面
    if (selectedPlaylist) {
      return (
        <div className="app">
          <div className="app-header">
            <button
              onClick={() => {
                setSelectedPlaylist(null);
                setPlaylistTracks([]);
                setEditingPlaylistName(false);
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
            <h1>TEMPO</h1>
          </div>

          <div className="glass-card">
            {editingPlaylistName ? (
              <div className="search-box">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenamePlaylist()}
                  style={{ fontSize: "15px", fontWeight: 600 }}
                  autoFocus
                />
                <button className="search-btn" onClick={handleRenamePlaylist}>
                  保存
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p className="section-label">PLAYLIST</p>
                  <p
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#1a1a2e",
                    }}
                  >
                    {selectedPlaylist.name}
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#888",
                      marginTop: "2px",
                    }}
                  >
                    {playlistTracks.length} TRACKS
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setEditingPlaylistName(true)}
                    style={{
                      background: "none",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      color: "#666",
                    }}
                  >
                    ✏️ 名前変更
                  </button>
                  <button
                    onClick={handleSharePlaylist}
                    style={{
                      background: "none",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      color: "#666",
                    }}
                  >
                    🔗 シェア
                  </button>
                </div>
              </div>
            )}
          </div>

          {playingTrackId && musicService === "spotify" && (
            <div style={{ marginBottom: "8px" }}>
              <iframe
                src={`https://open.spotify.com/embed/track/${playingTrackId}?theme=0`}
                width="100%"
                height="80"
                style={{ border: "none", borderRadius: "12px" }}
                allow="autoplay; clipboard-write; encrypted-media"
                loading="lazy"
              />
            </div>
          )}

          {isPlaylistTracksLoading ? (
            <div style={{ textAlign: "center", padding: "32px" }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <ul
              className="song-list"
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {playlistTracks.map((track, index) => (
                <li
                  key={`${track.id}-${index}`}
                  className="song-item playlist-track-item"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  style={{
                    opacity: dragIndex === index ? 0.4 : 1,
                    border:
                      dragOverIndex === index && dragIndex !== index
                        ? "2px solid #00d672"
                        : "1px solid rgba(255,255,255,0.8)",
                    cursor: "grab",
                    transition: "opacity 0.15s",
                  }}
                >
                  <span
                    style={{
                      color: "#ccc",
                      fontSize: "16px",
                      flexShrink: 0,
                      padding: "0 4px",
                      cursor: "grab",
                    }}
                  >
                    ⠿
                  </span>
                  {track.image && (
                    <img
                      src={track.image}
                      alt=""
                      style={{
                        borderRadius: 8,
                        flexShrink: 0,
                        width: 44,
                        height: 44,
                      }}
                    />
                  )}
                  <div className="song-info">
                    <div className="song-title">{track.title}</div>
                    <div className="song-artist">{track.artist}</div>
                  </div>
                  {musicService === "spotify" && (
                    <button
                      onClick={() =>
                        setPlayingTrackId(
                          playingTrackId === track.id ? null : track.id,
                        )
                      }
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "18px",
                        cursor: "pointer",
                        color: playingTrackId === track.id ? "#00d672" : "#aaa",
                        flexShrink: 0,
                        padding: "4px",
                      }}
                    >
                      {playingTrackId === track.id ? "⏸" : "▶"}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveTrack(track.uri, index)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "18px",
                      cursor: "pointer",
                      color: "#ff5252",
                      flexShrink: 0,
                      padding: "4px 8px",
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="bottom-nav">
            <button className="nav-item" onClick={() => setNavTab("tracks")}>
              <span className="nav-icon">◎</span>BPM
            </button>
            <button className="nav-item" onClick={() => setNavTab("tracks")}>
              <span className="nav-icon">≡</span>Tracks
            </button>
            <button className="nav-item active">
              <span className="nav-icon">▶</span>Playing
            </button>
            <button className="nav-item">
              <span className="nav-icon">⚙</span>Settings
            </button>
          </div>
        </div>
      );
    }

    // プレイリスト一覧画面
    return (
      <div className="app">
        <div className="app-header">
          <h1>TEMPO</h1>
          <button
            onClick={() => {
              localStorage.removeItem(
                musicService === "apple"
                  ? "apple_library_cache"
                  : "library_cache",
              );
              window.location.reload();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ● 接続済み
          </button>
        </div>

        <p className="section-label" style={{ marginBottom: "12px" }}>
          MY PLAYLISTS
        </p>

        {isPlaylistsLoading ? (
          <div style={{ textAlign: "center", padding: "32px" }}>
            <div className="loading-spinner" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="empty-state">プレイリストがありません</p>
        ) : (
          <ul className="song-list">
            {playlists.map((pl) => (
              <li
                key={pl.id}
                className="song-item"
                style={{ cursor: "pointer" }}
                onClick={() => handleOpenPlaylist(pl)}
              >
                {pl.images?.[0]?.url || pl.image ? (
                  <img
                    src={pl.images?.[0]?.url || pl.image}
                    alt=""
                    style={{
                      borderRadius: 8,
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: "#e0e0e0",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    ♪
                  </div>
                )}
                <div className="song-info">
                  <div className="song-title">{pl.name}</div>
                  <div className="song-artist">
                    {pl.tracks?.total ?? pl.trackCount ?? ""} tracks
                  </div>
                </div>
                <span style={{ color: "#ccc", fontSize: "18px" }}>›</span>
              </li>
            ))}
          </ul>
        )}

        <div className="bottom-nav">
          <button className="nav-item" onClick={() => setNavTab("tracks")}>
            <span className="nav-icon">◎</span>BPM
          </button>
          <button className="nav-item" onClick={() => setNavTab("tracks")}>
            <span className="nav-icon">≡</span>Tracks
          </button>
          <button className="nav-item active">
            <span className="nav-icon">▶</span>Playing
          </button>
          <button className="nav-item">
            <span className="nav-icon">⚙</span>Settings
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
        {token && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img
              src={
                musicService === "spotify"
                  ? "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png"
                  : "https://www.apple.com/v/apple-music/r/images/overview/hero__dh2e2crxtbmu_small.jpg"
              }
              alt={musicService}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                objectFit: "cover",
              }}
            />
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                color: "#aaa",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>

      {!token && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "24px",
            padding: "32px 16px",
          }}
        >
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 700,
              letterSpacing: "8px",
              color: "#1a1a2e",
            }}
          >
            TEMPO
          </h1>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              width: "100%",
              maxWidth: "280px",
            }}
          >
            <button
              className="genre-btn active"
              style={{
                padding: "14px",
                fontSize: "15px",
                borderRadius: "12px",
              }}
              onClick={() => {
                localStorage.setItem("music_service", "spotify");
                setMusicService("spotify");
                loginWithSpotify();
              }}
            >
              Login with Spotify
            </button>
            <button
              className="genre-btn active"
              style={{
                padding: "14px",
                fontSize: "15px",
                borderRadius: "12px",
                background: "#fc3c44",
              }}
              onClick={async () => {
                try {
                  const music = await loginWithAppleMusic();
                  setAppleMusicInstance(music);
                  setMusicService("apple");
                  setToken("apple-music-authorized");
                  localStorage.setItem("music_service", "apple");
                } catch (err) {
                  console.error("Apple Music login failed:", err);
                }
              }}
            >
              Login with Apple Music
            </button>
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "#aaa",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            ※ Access request in the app is required.
            <br />※ アプリでのアクセスリクエストが必要です。
          </p>
        </div>
      )}

      {token && (
        <>
          <div className="glass-card">
            <div className="genre-filter">
              <button
                className={`genre-btn ${mode === "library" ? "active" : ""}`}
                onClick={() => setMode("library")}
              >
                My Library
              </button>
              <button
                className={`genre-btn ${mode === "search" ? "active" : ""}`}
                onClick={() => setMode("search")}
              >
                Search
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
                  placeholder="Search by title or artist"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button onClick={handleSearch} className="search-btn">
                  Search
                </button>
              </div>
            </div>
          )}

          {mode === "library" && (
            <div className="glass-card">
              <p className="section-label">MY LIBRARY</p>
              {isLibraryLoading ? (
                <div style={{ textAlign: "center", padding: "16px" }}>
                  <div className="loading-spinner" />
                  <p
                    style={{
                      color: "#888",
                      marginTop: "8px",
                      fontSize: "12px",
                      lineHeight: 1.6,
                    }}
                  >
                    ※ First load may take a while.
                    <br />
                    ※ Please use in a good network environment.
                    <br />
                    <span style={{ color: "#bbb" }}>
                      初回読み込みには時間がかかります。通信が良いところでお試しください。
                    </span>
                  </p>
                </div>
              ) : (
                <div className="search-box">
                  <input
                    type="text"
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="Search in library"
                  />
                </div>
              )}
            </div>
          )}

          {mode === "library" && libraryError && libraryTracks.length === 0 && (
            <div className="glass-card" style={{ textAlign: "center" }}>
              <p style={{ color: "#888", fontSize: "14px" }}>{libraryError}</p>
              <button
                onClick={() => {
                  setLibraryError("");
                  localStorage.removeItem("library_cache");
                  window.location.reload();
                }}
                className="genre-btn active"
                style={{ marginTop: "12px" }}
              >
                再読み込み
              </button>
            </div>
          )}
        </>
      )}

      {isSearching && (
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <div className="loading-spinner" />
          <p className="section-label" style={{ marginTop: "12px" }}>
            検索中...
          </p>
        </div>
      )}

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

          {/* k/n曲取得中 表示（BPMフィルターの下） */}
          {mode === "library" && bgTotal > 0 && (
            <p
              style={{
                fontSize: "12px",
                color: bgLoaded >= bgTotal ? "#00d672" : "#aaa",
                marginBottom: "4px",
                textAlign: "right",
              }}
            >
              {bgLoaded >= bgTotal
                ? `${bgLoaded}/${bgTotal} tracks loaded ✓`
                : `${bgLoaded}/${bgTotal} tracks loading...`}
            </p>
          )}

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
          {renderFloatingControls()}

          {/* MORE ボタン：表示済み曲の追加 */}
          {mode === "library" &&
            displayCount < filteredLibraryTracks.length && (
              <div style={{ textAlign: "center", margin: "16px 0" }}>
                <button
                  className="genre-btn"
                  style={{ padding: "12px 32px", fontSize: "14px" }}
                  onClick={() => setDisplayCount((prev) => prev + 50)}
                >
                  MORE (+50)
                </button>
              </div>
            )}

          {/* バックグラウンド取得済みの追加 */}
          {mode === "library" && backgroundTracks.length > 0 && (
            <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
              <button
                className="genre-btn"
                style={{ padding: "12px 32px", fontSize: "14px" }}
                onClick={() => {
                  const toAdd = [...backgroundTracks];
                  setBackgroundTracks([]);
                  setLibraryTracks((prev) => {
                    const existingKeys = new Set(
                      prev.map((t) => `${t.title}|||${t.artist}`),
                    );
                    const newTracks = toAdd.filter(
                      (t) => !existingKeys.has(`${t.title}|||${t.artist}`),
                    );
                    return [...prev, ...newTracks];
                  });
                }}
              >
                Load more ({backgroundTracks.length} tracks ready)
              </button>
            </div>
          )}
          {mode === "library" &&
            backgroundTracks.length === 0 &&
            bgTotal > bgLoaded && (
              <div
                style={{
                  textAlign: "center",
                  margin: "8px 0 16px",
                  color: "#aaa",
                  fontSize: "13px",
                }}
              >
                Loading in background... {bgLoaded}/{bgTotal}
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
        <button className="nav-item" onClick={() => setNavTab("play")}>
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
