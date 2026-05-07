import jwt from "jsonwebtoken";

export default function handler(req, res) {
  try {
    const privateKeyRaw = process.env.APPLE_PRIVATE_KEY;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;

    if (!privateKeyRaw || !teamId || !keyId) {
      return res.status(500).json({
        error: "Missing env vars",
        hasKey: !!privateKeyRaw,
        hasTeam: !!teamId,
        hasKeyId: !!keyId,
      });
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    const token = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      expiresIn: "180d",
      issuer: teamId,
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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
