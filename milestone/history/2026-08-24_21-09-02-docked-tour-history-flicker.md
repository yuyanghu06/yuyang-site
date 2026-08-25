# Docked tour history flicker

Fixed the guided-tour Next transition so prior assistant messages remain hidden while the minimized dialogue fades out. The history-hiding selectors now depend on the persistent docked state rather than the transient docked-visible state, eliminating the frame in which the full conversation could render before the next caption reset.
