// さっき.envに保存したClient IDを読み込む
// import.meta.envはViteが.envファイルから値を取る仕組み
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
// ログイン後にSpotifyが「ここに戻ってね」って送り返すURL
// Dashboardに登録したのと同じじゃないとエラーになる（さっき体験した）
const REDIRECT_URI =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5173/callback"
    : `${window.location.origin}/callback`;
// 「このアプリがアクセスしたい範囲」を指定
// 今はユーザーの基本情報だけ。曲検索は指定なしでもできる
const SCOPES =
  "user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private";

function generateRandomString(length) {
  // ランダムな文字列を作る
  // なぜ必要？→ 通信の途中で誰かになりすまされないようにする鍵
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
  // ランダム文字列を暗号化する
  // PHPのpassword_hashと似た役割
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64encode(input) {
  // 暗号化したデータをURLに載せられる形に変換するだけ
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function loginWithSpotify() {
  // 1. ランダム文字列を作って保存
  // 2. それを暗号化
  // 3. SpotifyのログインURLを組み立てて飛ばす
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  localStorage.setItem("code_verifier", codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function getAccessToken() {
  const savedToken = localStorage.getItem("spotify_token");
  if (savedToken) return savedToken;

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (!code) return null;

  // codeを使ったらURLからすぐ消す（2回使えないから）
  window.history.replaceState({}, document.title, "/");

  const codeVerifier = localStorage.getItem("code_verifier");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    return data.access_token;
  }

  return null;
}

export async function searchTracks(query, token) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (response.status === 401) {
    localStorage.removeItem("spotify_token");
    window.location.reload();
    return [];
  }
  const data = await response.json();
  return data.tracks?.items || [];
}

export async function getMyPlaylists(token) {
  try {
    const response = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.status === 401) {
      localStorage.removeItem("spotify_token");
      window.location.reload();
      return [];
    }
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function getPlaylistTracks(playlistId, token) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.items?.items || data.tracks?.items || [];
  } catch {
    return [];
  }
}

export async function getTrackBpm(trackName, artistName) {
  const API_KEY = import.meta.env.VITE_GETSONGBPM_API_KEY;

  try {
    let response = await fetch(
      `https://api.getsong.co/search/?api_key=${API_KEY}&type=both&lookup=song:${encodeURIComponent(trackName)} artist:${encodeURIComponent(artistName)}`,
    );

    if (response.ok) {
      let data = await response.json();
      if (data.search && Array.isArray(data.search) && data.search.length > 0) {
        const tempos = data.search
          .map((s) => Number(s.tempo))
          .filter((t) => t > 0 && t < 300);
        if (tempos.length > 0) {
          return tempos[0];
        }
      }
    }

    // フォールバック：曲名だけで再検索
    response = await fetch(
      `https://api.getsong.co/search/?api_key=${API_KEY}&type=song&lookup=${encodeURIComponent(trackName)}`,
    );

    if (response.ok) {
      const data = await response.json();
      if (data.search && Array.isArray(data.search) && data.search.length > 0) {
        const tempos = data.search
          .map((s) => Number(s.tempo))
          .filter((t) => t > 0 && t < 300);
        if (tempos.length > 0) {
          return tempos[0];
        }
      }
    }
  } catch {
    // API制限やネットワークエラー
  }

  return null;
}

export async function getMyTracks(token, offset = 0) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status === 401) {
      localStorage.removeItem("spotify_token");
      window.location.reload();
      return { items: [] };
    }
    if (!response.ok) return { items: [] };
    const data = await response.json();
    return data;
  } catch {
    return { items: [] };
  }
}

export async function searchByBpm(bpm) {
  const API_KEY = import.meta.env.VITE_GETSONGBPM_API_KEY;

  const bpmValues = [bpm - 10, bpm, bpm + 10];
  let allResults = [];

  for (const b of bpmValues) {
    const response = await fetch(
      `https://api.getsong.co/tempo/?api_key=${API_KEY}&bpm=${b}`,
    );
    const data = await response.json();
    if (data.tempo && Array.isArray(data.tempo)) {
      allResults = [...allResults, ...data.tempo];
    }
  }

  const unique = allResults.filter(
    (song, index, self) =>
      self.findIndex((s) => s.song_id === song.song_id) === index,
  );

  return unique
    .map((song) => ({
      id: song.song_id,
      title: song.song_title,
      artist: song.artist?.name || "Unknown",
      bpm: Number(song.tempo),
      genre: song.artist?.genres?.[0] || "Other",
      image: null,
      rating: null,
    }))
    .filter((song) => song.bpm >= bpm - 10 && song.bpm <= bpm + 10)
    .sort((a, b) => Math.abs(a.bpm - bpm) - Math.abs(b.bpm - bpm));
}

export async function createPlaylist(token, name) {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name,
      description: "Created by TEMPO",
      public: false,
    }),
  });
  const data = await response.json();
  return data;
}

export async function addTracksToPlaylist(token, playlistId, trackUris) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/items`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: trackUris }),
    },
  );
  return response.json();
}
