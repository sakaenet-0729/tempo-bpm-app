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

export async function loginWithAppleMusic() {
  const token = await getAppleMusicToken();

  await MusicKit.configure({
    developerToken: token,
    app: {
      name: "TEMPO",
      build: "1.0.0",
    },
  });

  const music = MusicKit.getInstance();
  await music.authorize();
  return music;
}

export async function searchAppleMusic(query) {
  const music = MusicKit.getInstance();
  const result = await music.api.music(`/v1/catalog/jp/search`, {
    term: query,
    types: "songs",
    limit: 10,
  });

  if (result.data.results?.songs?.data) {
    return result.data.results.songs.data.map((song) => ({
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

export async function getAppleMusicLibrary() {
  const music = MusicKit.getInstance();
  let allTracks = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await music.api.music(
      `/v1/me/library/songs?limit=${limit}&offset=${offset}`,
    );

    if (result.data.data && result.data.data.length > 0) {
      const tracks = result.data.data.map((song) => ({
        id: song.id,
        title: song.attributes.name,
        artist: song.attributes.artistName,
        bpm: null,
        image: song.attributes.artwork?.url
          ?.replace("{w}", "64")
          ?.replace("{h}", "64"),
      }));
      allTracks = [...allTracks, ...tracks];
      offset += limit;

      if (result.data.data.length < limit) break;
    } else {
      break;
    }
  }

  return allTracks;
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
    },
  );
  return response;
}
