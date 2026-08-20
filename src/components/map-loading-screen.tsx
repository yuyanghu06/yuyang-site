export default function MapLoadingScreen({ ready = false }: { ready?: boolean }) {
  return (
    <div className={`map-prelude${ready ? " is-ready" : ""}`} aria-hidden="true">
      <svg className="map-prelude__drawing" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
        <g className="map-prelude__roads map-prelude__roads--quiet">
          <path d="M-8 24 C28 20 48 28 76 25 S128 14 170 18" />
          <path d="M-6 73 C27 67 52 76 82 70 S128 60 168 65" />
          <path d="M24 -8 C29 22 22 47 29 108" />
          <path d="M123 -8 C116 25 126 48 118 108" />
        </g>
        <g className="map-prelude__roads map-prelude__roads--draw">
          <path pathLength="1" d="M-8 49 C24 45 49 54 82 48 S134 37 170 43" />
          <path pathLength="1" d="M58 -8 C54 22 62 45 57 108" />
          <path pathLength="1" d="M94 -8 C89 19 97 46 91 108" />
          <path pathLength="1" d="M-8 86 C29 79 53 91 86 84 S134 75 170 81" />
        </g>
        <rect className="map-prelude__square" x="66" y="37" width="27" height="22" rx="1" />
      </svg>
    </div>
  );
}
