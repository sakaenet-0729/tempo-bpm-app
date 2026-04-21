// さっき.envに保存したClient IDを読み込む
// import.meta.envはViteが.envファイルから値を取る仕組み
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
// ログイン後にSpotifyが「ここに戻ってね」って送り返すURL
// Dashboardに登録したのと同じじゃないとエラーになる（さっき体験した）
const REDIRECT_URI = "http://127.0.0.1:5173/callback";
// 「このアプリがアクセスしたい範囲」を指定
// 今はユーザーの基本情報だけ。曲検索は指定なしでもできる
const SCOPES = "user-read-private user-read-email";

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
  // Spotifyに「この曲検索して」とリクエストを送る
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = await response.json();
  return data.tracks.items;
}

export async function getTrackBpm(trackName, artistName) {
  const API_KEY = import.meta.env.VITE_GETSONGBPM_API_KEY;

  const response = await fetch(
    `https://api.getsong.co/search/?api_key=${API_KEY}&type=both&lookup=song:${encodeURIComponent(trackName)} artist:${encodeURIComponent(artistName)}`,
  );

  const data = await response.json();
  console.log("BPM search:", trackName, artistName, data);

  if (data.search && data.search.length > 0) {
    return Number(data.search[0].tempo);
  }

  return null;
}
