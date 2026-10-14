# Manhattan ambient systems

Sky travelers, clouds, birds, pedestrians, and traffic helpers live here. The plane and passenger-boat model builders are shared with the globe ambient layer so both views retain one visual language. Browser code consumes frozen layout data rather than running expensive spatial placement at startup.

## Files

- `sky.ts` builds clouds, birds, planes, and passenger boats for Manhattan and the globe.
- `street-life.ts` adapts frozen NYC layouts to the shared pedestrian/car instance factory. It preserves the existing clothing, geometry, reveal animation, and exact alternating ordinary-car colors with every third car a yellow taxi.
- `info.md` is this local ownership guide.
