interface TourDestinationChoicesProps {
  level: "city" | "neighborhood";
  onChooseNewYork: () => void;
  onChooseSanDiego: () => void;
  onChooseNeighborhood: (destination: "union" | "washington") => void;
  onReply: () => void;
}

export function TourDestinationChoices({
  level, onChooseNewYork, onChooseSanDiego, onChooseNeighborhood, onReply,
}: TourDestinationChoicesProps) {
  return (
    <div className="agent-chat__caption-actions">
      <div
        className="agent-chat__choices agent-chat__choices--white"
        aria-label={level === "city" ? "Choose a tour city" : "Choose a New York neighborhood"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {level === "city" ? (
          <>
            <button type="button" onClick={onChooseNewYork}>New York</button>
            <button type="button" onClick={onChooseSanDiego}>San Diego</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onChooseNeighborhood("union")}>Union Square</button>
            <button type="button" onClick={() => onChooseNeighborhood("washington")}>Washington Square</button>
          </>
        )}
      </div>
      <button
        type="button"
        className="agent-chat__inline-reply"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onReply(); }}
      >
        <span className="agent-chat__reply-icon" aria-hidden="true">↩</span> Reply…
      </button>
    </div>
  );
}
