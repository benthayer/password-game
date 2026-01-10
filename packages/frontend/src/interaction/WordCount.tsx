/**
 * Word count display for recovery and practice modes.
 */

interface RecoveryWordCountProps {
  count: number;
}

export function RecoveryWordCount({ count }: RecoveryWordCountProps) {
  return (
    <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
      {count} {count === 1 ? 'word' : 'words'} selected
    </p>
  );
}

interface PracticeWordCountProps {
  current: number;
  total: number;
  isCompleted: boolean;
}

export function PracticeWordCount({ current, total, isCompleted }: PracticeWordCountProps) {
  return (
    <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
      {isCompleted ? (
        <>All {total} words completed</>
      ) : (
        <>Word {current + 1} of {total}</>
      )}
    </p>
  );
}

