export default function MapLoadingScreen({
  ready = false,
  progress = 0.04,
}: {
  ready?: boolean;
  progress?: number;
}) {
  const percentage = Math.round(Math.min(1, Math.max(0, ready ? 1 : progress)) * 100);
  return (
    <div className={`map-prelude${ready ? " is-ready" : ""}`} aria-hidden="true">
      <div className="map-prelude__bar">
        <span className="map-prelude__fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
