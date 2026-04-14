import { useState } from "react";
import BpmFilter from "./BpmFilter";
import GenreFilter from "./GenreFilter";
import SongList from "./SongList";
import "./App.css";

const songs = [
  { id: 1, title: "Shape of You", artist: "Ed Sheeran", bpm: 96, genre: "Pop" },
  {
    id: 2,
    title: "Blinding Lights",
    artist: "the Weeknd",
    bpm: 171,
    genre: "Pop",
  },
  { id: 3, title: "Levitating", artist: "Dua Lipa", bpm: 103, genre: "Pop" },
  { id: 4, title: "Bad Guy", artist: "Billie Eilish", bpm: 135, genre: "Pop" },
  {
    id: 5,
    title: "Uptown Funk",
    artist: "Bruno Mars",
    bpm: 115,
    genre: "Funk",
  },
  {
    id: 6,
    title: "Lose Yourself",
    artist: "Eminem",
    bpm: 171,
    genre: "HipHop",
  },
  {
    id: 7,
    title: "HUMBLE",
    artist: "Kendrick Lamer",
    bpm: 150,
    genre: "HipHop",
  },
  {
    id: 8,
    title: "Titanium",
    artist: "Davie Guetta",
    bpm: 126,
    genre: "EDM",
  },
  {
    id: 9,
    title: "Clarity",
    artist: "Zedd",
    bpm: 128,
    genre: "EDM",
  },
  {
    id: 10,
    title: "Wake Me Up",
    artist: "Avicii",
    bpm: 124,
    genre: "EDM",
  },
];

const genres = ["All", ...new Set(songs.map((song) => song.genre))];

function App() {
  const [minBpm, setMinBpm] = useState(100);
  const [maxBpm, setMaxBpm] = useState(140);
  const [selectedGenre, setSelectedGenre] = useState("All");

  const filteredSongs = songs
    .filter((song) => song.bpm >= minBpm && song.bpm <= maxBpm)
    .filter((song) => selectedGenre === "All" || song.genre === selectedGenre)
    .sort((a, b) => a.bpm - b.bpm);

  return (
    <div className="app">
      <h1>BPM Music App</h1>
      <BpmFilter
        minBpm={minBpm}
        maxBpm={maxBpm}
        onMinChange={setMinBpm}
        onMaxChange={setMaxBpm}
      />
      <GenreFilter
        genres={genres}
        selectedGenre={selectedGenre}
        onGenreChange={setSelectedGenre}
      />
      <h2>
        {selectedGenre === "All" ? "全ジャンル" : selectedGenre} / BPM {minBpm}
        〜{maxBpm}
      </h2>
      <SongList songs={filteredSongs} />
      {filteredSongs.length === 0 && <p>該当する曲がありません</p>}
    </div>
  );
}

export default App;
