export default function StarRating({ value, onChange, idPrefix }) {
  const current = Number(value) || 0

  return (
    <div className="star-rating" role="group" aria-label="Rating out of 5">
      {[1, 2, 3, 4, 5].map(function(star) {
        return (
          <button
            key={`${idPrefix || 'star'}-${star}`}
            className={star <= current ? 'star-button is-on' : 'star-button'}
            type="button"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={star <= current}
            onClick={function() { onChange(star) }}
          >
            ★
          </button>
        )
      })}
      <span className="star-rating-caption">{current ? `${current} / 5` : 'Tap to rate'}</span>
    </div>
  )
}
