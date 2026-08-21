import type { MapView, SkyTraveler } from "../shared/core";

export function animateTravelers(
  travelers: SkyTraveler[],
  activeView: MapView,
  delta: number,
  elapsed: number,
) {
  for (const traveler of travelers) {
    traveler.group.visible = traveler.view === "manhattan"
      ? activeView === "manhattan"
      : activeView !== "manhattan";
    if (!traveler.group.visible) continue;
    const span = traveler.endX - traveler.startX;
    const axis = traveler.axis ?? "x";
    traveler.group.position[axis] = traveler.startX
      + ((traveler.group.position[axis] - traveler.startX + traveler.speed * delta + span) % span);
    traveler.group.position.y = traveler.baseY
      + Math.sin(elapsed * 0.55 + traveler.phase) * (traveler.bobAmount ?? 3.5);
    traveler.flap?.(elapsed);
  }
}
