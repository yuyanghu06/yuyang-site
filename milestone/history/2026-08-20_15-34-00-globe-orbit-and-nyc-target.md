# Globe orbit and NYC target correction

- Nudged the imported Earth's NYC longitude calibration three degrees west, from +230 to +227 degrees, to place the dot on the northeast coastline.
- Replaced accumulated local-axis globe rotations with independent world-up longitude yaw and screen-horizontal latitude pitch.
- Clamped only latitude pitch to ±85 degrees, preventing the apparent pole constraint from blocking East Asia longitude navigation.
- Confirmed the recursive NYC callout hit target includes its dot, leader line, and text.
