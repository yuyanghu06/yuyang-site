# Explicit fullscreen caption gate

CSS delay alone left the caption at its previous docked opacity while the modal expanded. The shell now clears caption visibility and `expandedSettled` when opening, waits for the complete 460 ms geometry transition, then enables the fullscreen chat class and its 220 ms opacity fade.

Expansion and dock-caption timers are cleared on opposing transitions and component cleanup.
