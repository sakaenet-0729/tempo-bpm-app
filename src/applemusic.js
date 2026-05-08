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
  const result = await music.api.music("/v1/me/library/songs", { limit: 100 });

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
}
