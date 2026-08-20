# Single pulse per scroll gesture

- Latched empty-map wheel input at the gesture level so only the first scroll-in event starts the rejection animation.
- Consumed subsequent wheel and trackpad momentum events without starting a second zoom pulse.
- Kept the approved one-second motion: one zoom in followed immediately by one return to overview.
