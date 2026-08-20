# Arrow lowering and return tile fix

- Reduced the world arrow horizontal offset and height by about 30%, from Washington local `(320, y=185)` to `(224, y=130)`, with mirrored Union placement.
- Added destination-generation guards to delayed tile cleanup so an old traversal cannot remove the newly active neighborhood.
- Matched the retained neighborhood radius to the 900 m loading radius and remove disposed roots from the arrival queue.
- Confirmed that planimetrics JSON is already a tracked repository asset; runtime delay is local download/parsing/triangulation, not an NYC API request.
