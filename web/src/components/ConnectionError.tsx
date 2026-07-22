import './ConnectionError.css';

interface Props {
  onRetry: () => void;
}

export function ConnectionError({ onRetry }: Props) {
  return (
    <div className="conn-error">
      <div className="conn-error__box">
        <div className="conn-error__title">~/cache $ connection lost</div>
        <div className="conn-error__msg">could not reach the server — check your network</div>
        <button className="conn-error__retry" onClick={onRetry}>[retry]</button>
      </div>
    </div>
  );
}
