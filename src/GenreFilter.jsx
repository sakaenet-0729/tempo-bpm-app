function GenreFilter({ genres, selectedGenre, onGenreChange }) {
  return (
    <div className="glass-card">
      <p className="section-label">GENRE</p>
      <div className="genre-filter">
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => onGenreChange(genre)}
            className={`genre-btn ${selectedGenre === genre ? "active" : ""}`}
          >
            {genre}
          </button>
        ))}
      </div>
    </div>
  );
}

export default GenreFilter;
