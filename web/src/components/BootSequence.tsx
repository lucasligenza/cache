import { useEffect, useState } from 'react';
import './BootSequence.css';

const LINES = [
  { text: 'initializing cache...', duration: 0.7, steps: 22 },
  { text: 'mounting storage...', duration: 0.6, steps: 19 },
  { text: 'ready.', duration: 0.3, steps: 6 },
];

const DELAYS = [100, 900, 1600];
const DONE_AT = 2200;

interface Props {
  onDone: () => void;
}

export function BootSequence({ onDone }: Props) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = DELAYS.map((delay, i) =>
      setTimeout(() => setVisible(i + 1), delay)
    );
    const doneTimer = setTimeout(onDone, DONE_AT);
    return () => { timers.forEach(clearTimeout); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div className="boot" onClick={onDone}>
      {LINES.slice(0, visible).map((line, i) => (
        <span
          key={i}
          className={`boot__line${line.text === 'ready.' ? ' boot__line--ready' : ''}`}
          style={{
            '--duration': `${line.duration}s`,
            '--steps': line.steps,
          } as React.CSSProperties}
        >
          {line.text}
        </span>
      ))}
      {visible < LINES.length && <span className="boot__cursor" />}
    </div>
  );
}
