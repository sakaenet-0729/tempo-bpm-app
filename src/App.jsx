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
  const [ratingFilter, setRatingFilter] = useState("all");

  const handleRating = (id, rating) => {
    setSongs((prev) =>
      prev.map((song) => (song.id === id ? { ...song, rating } : song)),
    );
  };

  const filteredSongs = songs
    .filter((song) => song.bpm >= minBpm && song.bpm <= maxBpm)
    .filter((song) => selectedGenre === "All" || song.genre === selectedGenre)
    .filter((song) => {
      if (ratingFilter === "all") return true;
      if (ratingFilter === "good") return song.rating === "good";
      if (ratingFilter === "bad") return song.rating === "bad";
      if (ratingFilter === "unrated") return song.rating === null;
      return true;
    })
    .slice()
    .sort((a, b) => a.bpm - b.bpm);

  const targetBpm = Math.round((minBpm + maxBpm) / 2);

  return (
    <div className="app">
      <div className="app-header">
        <h1>MATCHED TRACKS</h1>
      </div>

      <div className="bpm-display">
        <span className="bpm-value">{targetBpm}</span>
        <span className="bpm-label">BPM</span>
      </div>

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

      <div className="glass-card">
        <p className="section-label">FILTER BY RATING</p>
        <div className="genre-filter">
          {["all", "good", "bad", "unrated"].map((filter) => (
            <button
              key={filter}
              onClick={() => setRatingFilter(filter)}
              className={`genre-btn ${ratingFilter === filter ? "active" : ""}`}
            >
              {filter === "all" && "全て"}
              {filter === "good" && "👍 いい"}
              {filter === "bad" && "👎 微妙"}
              {filter === "unrated" && "未評価"}
            </button>
          ))}
        </div>
      </div>

      <p className="section-label">{filteredSongs.length} TRACKS</p>
      <SongList
        songs={filteredSongs}
        onRating={handleRating}
        targetBpm={targetBpm}
      />

      <div className="bottom-nav">
        <button className="nav-item">
          <span className="nav-icon">◎</span>
          BPM
        </button>
        <button className="nav-item active">
          <span className="nav-icon">≡</span>
          Tracks
        </button>
        <button className="nav-item">
          <span className="nav-icon">▶</span>
          Playing
        </button>
        <button className="nav-item">
          <span className="nav-icon">⚙</span>
          Settings
        </button>
      </div>
    </div>
  );
}

export default App;
