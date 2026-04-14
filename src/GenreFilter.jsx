function GenreFilter({ genres, selectedGenre, onGenreChange }) {
  return (
    <div className="genre-filter">
      {genres.map((genre) => (
        <button
          key={genre}
          onClick={() => onGenreChange(genre)}
          style={{
            backgroundColor: selectedGenre === genre ? "#333" : "#eee",
            color: selectedGenre === genre ? "#fff" : "#333",
            margin: "4px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}
export default GenreFilter;
