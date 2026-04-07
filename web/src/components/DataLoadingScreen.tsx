import './DataLoadingScreen.css';

export function DataLoadingScreen() {
  return (
    <div className="data-loading">
      <div className="data-loading__line">connecting to supabase...</div>
      <div className="data-loading__line" style={{ animationDelay: '0.3s' }}>loading notes_</div>
    </div>
  );
}
