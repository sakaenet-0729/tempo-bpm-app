let cachedToken = null;

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

export async function searchAppleMusic(query) {
  const token = await getAppleMusicToken();
  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(query)}&types=songs&limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  if (data.results?.songs?.data) {
    return data.results.songs.data.map((song) => ({
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
}

export async function getAppleMusicLibrary(offset = 0, limit = 20) {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music(
      `/v1/me/library/songs?limit=${limit}&offset=${offset}`
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
    console.warn("Apple Music library error:", err);
  }
  return { tracks: [], hasMore: false };
}

export async function getAppleMusicRecentlyPlayed() {
  try {
    const music = MusicKit.getInstance();
    const result = await music.api.music(
      "/v1/me/recent/played/tracks?limit=20"
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
  } catch {
    return [];
  }
}

export async function playAppleMusicTrack(songId) {
  const music = MusicKit.getInstance();
  await music.setQueue({ song: songId });
  await music.play();
}

export function pauseAppleMusic() {
  const music = MusicKit.getInstance();
  music.pause();
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
    }
  );
  return response;
}

export async function removeFromAppleMusicPlaylist(playlistId, trackIds) {
  const music = MusicKit.getInstance();
  try {
    const result = await music.api.music(
      `/v1/me/library/playlists/${playlistId}/tracks`
    );
    const currentTracks = result.data.data || [];
    const remainingTracks = currentTracks.filter(
      (t) => !trackIds.includes(t.id)
    );

    await music.api.music(
      `/v1/me/library/playlists/${playlistId}/tracks`,
      {},
      {
        fetchOptions: {
          method: "PUT",
          body: JSON.stringify({
            data: remainingTracks.map((t) => ({
              id: t.id,
              type: "songs",
            })),
          }),
        },
      }
    );
    return true;
  } catch (err) {
    console.error("Remove from playlist error:", err);
    return false;
  }
}

export async function reorderAppleMusicPlaylist(playlistId, trackIds) {
  const music = MusicKit.getInstance();
  try {
    await music.api.music(
      `/v1/me/library/playlists/${playlistId}/tracks`,
      {},
      {
        fetchOptions: {
          method: "PUT",
          body: JSON.stringify({
            data: trackIds.map((id) => ({
              id: id,
              type: "songs",
            })),
          }),
        },
      }
    );
    return true;
  } catch (err) {
    console.error("Reorder playlist error:", err);
    return false;
  }
}
