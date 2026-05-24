let cachedToken = null;
let previewAudio = null;

export async function getAppleMusicToken() {
  if (cachedToken) return cachedToken;

  const baseUrl =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
      ? "https://tempobpm.app"
      : "";

  const response = await fetch(`${baseUrl}/api/apple-token`);
  const data = await response.json();
  cachedToken = data.token;
  return data.token;
}

export async function initAppleMusic() {
  const token = await getAppleMusicToken();
  await MusicKit.configure({
    developerToken: token,
    app: {
      name: "TEMPO",
      build: "1.0.0",
    },
  });
  return MusicKit.getInstance();
}

export async function loginWithAppleMusic() {
  const music = await initAppleMusic();
  await music.authorize();
  return music;
}

export async function searchAppleMusic(query, offset = 0) {
  const token = await getAppleMusicToken();
  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(query)}&types=songs&limit=25&offset=${offset}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await response.json();
  if (data.results?.songs?.data) {
    return data.results.songs.data.map((song) => ({
      id: song.id,
      title: song.attributes.name,
      artist: song.attributes.artistName,
      bpm: null,
      genre: song.attributes.genreNames?.[0] || null,
      previewUrl: song.attributes.previews?.[0]?.url || null,
      image: song.attributes.artwork?.url
        ?.replace("{w}", "64")
        ?.replace("{h}", "64"),
    }));
  }
  return [];
}

export async function getAppleMusicLibrary(offset = 0, limit = 20) {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music(
      `/v1/me/library/songs?limit=${limit}&offset=${offset}&sort=-dateAdded`,
    );
    if (result.data.data && result.data.data.length > 0) {
      return {
        tracks: result.data.data.map((song) => ({
          id: song.id,
          title: song.attributes.name,
          artist: song.attributes.artistName,
          bpm: null,
          image: song.attributes.artwork?.url
            ?.replace("{w}", "64")
            ?.replace("{h}", "64"),
        })),
        hasMore: result.data.data.length === limit,
      };
    }
  } catch (err) {
    if (err.toString().includes("403")) {
      try {
        await music.authorize();
        const result = await music.api.music(
          `/v1/me/library/songs?limit=${limit}&offset=${offset}&sort=-dateAdded`,
        );
        if (result.data.data && result.data.data.length > 0) {
          return {
            tracks: result.data.data.map((song) => ({
              id: song.id,
              title: song.attributes.name,
              artist: song.attributes.artistName,
              bpm: null,
              image: song.attributes.artwork?.url
                ?.replace("{w}", "64")
                ?.replace("{h}", "64"),
            })),
            hasMore: result.data.data.length === limit,
          };
        }
      } catch {}
    }
    console.warn("Apple Music library error:", err);
  }
  return { tracks: [], hasMore: false };
}

export async function getAppleMusicRecentlyPlayed() {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music(
      "/v1/me/recent/played/tracks?limit=20",
    );
    if (result.data.data) {
      return result.data.data.map((song) => ({
        id: song.id,
        title: song.attributes.name,
        artist: song.attributes.artistName,
        bpm: null,
        image: song.attributes.artwork?.url
          ?.replace("{w}", "64")
          ?.replace("{h}", "64"),
      }));
    }
    return [];
  } catch (err) {
    if (err.toString().includes("403")) {
      try {
        await music.authorize();
        const result = await music.api.music(
          "/v1/me/recent/played/tracks?limit=20",
        );
        if (result.data.data) {
          return result.data.data.map((song) => ({
            id: song.id,
            title: song.attributes.name,
            artist: song.attributes.artistName,
            bpm: null,
            image: song.attributes.artwork?.url
              ?.replace("{w}", "64")
              ?.replace("{h}", "64"),
          }));
        }
      } catch {}
    }
    return [];
  }
}

export async function playAppleMusicTrack(songId, title, artist, isLoggedIn) {
  // ログイン済み → MusicKit再生
  if (isLoggedIn) {
    const music = MusicKit.getInstance();
    // 曲名+アーティスト名でJPカタログを検索して再生
    if (title && artist) {
      try {
        const token = await getAppleMusicToken();
        const response = await fetch(
          `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(title + " " + artist)}&types=songs&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();
        const jpId = data.results?.songs?.data?.[0]?.id;
        if (jpId) {
          await music.setQueue({ song: jpId, startPlaying: true });
          return;
        }
      } catch {}
    }
    // フォールバック
    try {
      await music.setQueue({ song: songId, startPlaying: true });
    } catch (err) {
      console.error("Play failed:", songId, err);
    }
    return;
  }

  // ログインなし → プレビューURL再生（30秒）
  stopPreview();
  try {
    const token = await getAppleMusicToken();
    const response = await fetch(
      `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(title + " " + artist)}&types=songs&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();
    const previewUrl =
      data.results?.songs?.data?.[0]?.attributes?.previews?.[0]?.url;
    if (previewUrl) {
      previewAudio = new Audio(previewUrl);
      previewAudio.play();
      return;
    }
  } catch {}
  console.error("Preview not available for:", title);
}

export function pauseAppleMusic() {
  // MusicKit停止
  try {
    const music = MusicKit.getInstance();
    music.pause();
  } catch {}
  // プレビュー停止
  stopPreview();
}

function stopPreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
}

export async function createAppleMusicPlaylist(name, trackIds) {
  const music = MusicKit.getInstance();
  const response = await music.api.music(
    "/v1/me/library/playlists",
    {},
    {
      fetchOptions: {
        method: "POST",
        body: JSON.stringify({
          attributes: {
            name: name,
            description: "Created by TEMPO",
          },
          relationships: {
            tracks: {
              data: trackIds.map((id) => ({
                id: id,
                type: "songs",
              })),
            },
          },
        }),
      },
    },
  );
  return response;
}

export async function getMyAppleMusicPlaylists() {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music("/v1/me/library/playlists?limit=50");
    if (result.data.data) {
      return result.data.data
        .filter((pl) => {
          const desc = pl.attributes.description;
          if (!desc) return false;
          if (typeof desc === "string")
            return desc.includes("Created by TEMPO");
          if (typeof desc === "object" && desc.standard)
            return desc.standard.includes("Created by TEMPO");
          return false;
        })
        .map((pl) => ({
          id: pl.id,
          name: pl.attributes.name,
        }));
    }
    return [];
  } catch (err) {
    console.error("Get playlists error:", err);
    return [];
  }
}

export async function getAppleMusicPlaylistTracks(playlistId) {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music(
      `/v1/me/library/playlists/${playlistId}`,
      { include: "tracks" },
    );
    const tracks = result.data.data?.[0]?.relationships?.tracks?.data;
    if (tracks) {
      return tracks.map((song) => ({
        id: song.id,
        title: song.attributes.name,
        artist: song.attributes.artistName,
        image: song.attributes.artwork?.url
          ?.replace("{w}", "64")
          ?.replace("{h}", "64"),
      }));
    }
    return [];
  } catch (err) {
    console.error("Get playlist tracks error:", err);
    return [];
  }
}
