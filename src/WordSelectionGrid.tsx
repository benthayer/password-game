import './GamePage.css';
import './PracticePage.css';

interface WordSelectionGridProps {
  words: string[];
  onWordClick: (word: string) => void;
  loading?: boolean;
  correctWordIndex?: number;
  errorWordIndex?: number | null;
  gridCols?: number;
  highlightCorrect?: boolean;
}

export default function WordSelectionGrid({
  words,
  onWordClick,
  loading = false,
  correctWordIndex,
  errorWordIndex = null,
  gridCols = 4,
  highlightCorrect = true,
}: WordSelectionGridProps) {
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
        {words.map((word, index) => {
          const isCorrect = index === correctWordIndex;
          const isError = errorWordIndex === index;
          const shouldHighlight = highlightCorrect && isCorrect && !isError;
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
              key={`${word}-${index}`}
              onClick={() => !loading && onWordClick(word)}
              disabled={loading}
              className={buttonClasses}
              style={{
                background: shouldHighlight ? '#10b981' : undefined,
                border: shouldHighlight ? '3px solid #059669' : '3px solid transparent',
                boxShadow: shouldHighlight ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
                fontWeight: shouldHighlight ? 'bold' : 'normal',
                cursor: loading ? 'wait' : 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {word}
            </button>
          );
        })}
      </div>
      {loading && words.length === 0 && (
        <div className="loading">Loading options...</div>
      )}
    </>
  );
}
