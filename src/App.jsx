import { useState } from "react";
import "./App.css";
import BpmFilter from "./BpmFilter";
import GenreFilter from "./GenreFilter";
import SongList from "./SongList";
import songsData from "./data/songs";

const genres = ["All", ...new Set(songsData.map((song) => song.genre))];

function App() {
  const [minBpm, setMinBpm] = useState(100);
  const [maxBpm, setMaxBpm] = useState(140);
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [songs, setSongs] = useState(songsData);

  const handleRating = (id, rating) => {
    console.log("handleRating called:", id, rating);
    setSongs((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const filteredSongs = songs
    .filter((song) => song.bpm >= minBpm && song.bpm <= maxBpm)
    .filter((song) => selectedGenre === "All" || song.genre === selectedGenre)
    .slice()
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
      <SongList songs={filteredSongs} onRating={handleRating} />
    </div>
  );
}

export default App;
