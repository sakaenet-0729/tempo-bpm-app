import { useState } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import GenreFilter from "./GenreFilter";
import SongList from "./SongList";
import songs from "./data/songs";

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
