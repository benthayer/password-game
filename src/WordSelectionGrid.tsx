import './InteractionPage.css';
import './PracticePage.css';

interface WordSelectionGridProps {
  words: string[];
  onWordClick: (word: string) => void;
  loading?: boolean;
  correctWordIndex?: number | undefined;
  errorWordIndex?: number | null;
  gridCols?: number;
  gridRows?: number;
  highlightCorrect?: boolean;
  showPlaceholder?: boolean | undefined;
  placeholderText?: string | undefined;
}

export default function WordSelectionGrid({
  words,
  onWordClick,
  loading = false,
  correctWordIndex,
  errorWordIndex = null,
  gridCols = 4,
  gridRows = 3,
  highlightCorrect = true,
  showPlaceholder = false,
  placeholderText = '-',
}: WordSelectionGridProps) {
  // If showing placeholders, create an array of placeholder buttons
  // Use the same size as the normal grid (gridRows * gridCols)
  const placeholderCount = showPlaceholder ? gridRows * gridCols : 0;
  const displayWords = showPlaceholder ? Array(placeholderCount).fill(placeholderText) : words;

  return (
    <>
      <div 
        className="word-grid" 
        style={{ 
          opacity: loading ? 0.6 : 1, 
          transition: 'opacity 0.2s',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`
        }}
      >
        {displayWords.map((word, index) => {
          const isCorrect = !showPlaceholder && index === correctWordIndex;
          const isError = !showPlaceholder && errorWordIndex === index;
          const shouldHighlight = !showPlaceholder && highlightCorrect && isCorrect && !isError;
          let buttonClasses = 'word-button';
          if (shouldHighlight) {
            buttonClasses += ' correct';
          }
          if (isError) {
            buttonClasses += ' error';
            if (isCorrect) {
              buttonClasses += ' correct-word';
            }
          }
          return (
            <button
              key={showPlaceholder ? `placeholder-${index}` : `${word}-${index}`}
              onClick={() => !loading && !showPlaceholder && onWordClick(word)}
              disabled={loading || showPlaceholder}
              className={buttonClasses}
              style={{
                background: shouldHighlight ? '#10b981' : showPlaceholder ? '#e5e7eb' : undefined,
                border: shouldHighlight ? '3px solid #059669' : '3px solid transparent',
                boxShadow: shouldHighlight ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
                fontWeight: shouldHighlight ? 'bold' : 'normal',
                cursor: showPlaceholder ? 'default' : loading ? 'wait' : 'pointer',
                boxSizing: 'border-box',
                color: showPlaceholder ? '#9ca3af' : undefined,
              }}
            >
              {word}
            </button>
          );
        })}
      </div>
      {loading && words.length === 0 && !showPlaceholder && (
        <div className="loading">Loading options...</div>
      )}
    </>
  );
}
