let cachedToken = null;

export async function getAppleMusicToken() {
  if (cachedToken) return cachedToken;
  const response = await fetch("/api/apple-token");
  const data = await response.json();
  cachedToken = data.token;
  return data.token;
}

export async function searchAppleMusic(query) {
  const token = await getAppleMusicToken();
  const response = await fetch(
    `https://api.music.apple.com/v1/catalog/jp/search?term=${encodeURIComponent(query)}&types=songs&limit=10`,
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
      image: song.attributes.artwork?.url
        ?.replace("{w}", "64")
        ?.replace("{h}", "64"),
    }));
  }
  return [];
}
