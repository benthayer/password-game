import './PracticePage.css';

interface PasswordProgressDisplayProps {
  words: string[];
  completedCount: number;
  showFuture?: boolean;
}

export default function PasswordProgressDisplay({
  words,
  completedCount,
  showFuture = true,
}: PasswordProgressDisplayProps) {
  if (words.length === 0) {
    return (
      <div className="password-progress-display" style={{ textAlign: 'center' }}>
        <span className="password-word future">Select a word to add it to your password</span>
      </div>
    );
  }

  return (
    <div className="password-progress-display">
      {words.map((word, index) => {
        let wordClass = 'password-word';
        if (index < completedCount) {
          wordClass += ' completed';
        } else if (index === completedCount) {
          wordClass += ' current';
        } else {
          if (showFuture) {
            wordClass += ' future';
          } else {
            // In game mode, don't render future words
            return null;
          }
        }
        return (
          <span key={index} className={wordClass}>
            {word}
          </span>
        );
      })}
    </div>
  );
}
