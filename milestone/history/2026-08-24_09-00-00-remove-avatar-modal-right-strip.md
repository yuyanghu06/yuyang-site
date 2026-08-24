# Remove expanded avatar modal right strip

- Removed the right-inset geometry that still exposed a strip beside the expanded avatar display.
- Made the expanded shell span the full viewport width from `left: 0` to `right: 0` while remaining vertically centered.
- Preserved the approved modal height and internal avatar crop.
