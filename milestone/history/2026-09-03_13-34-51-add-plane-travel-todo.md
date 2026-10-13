# Add plane travel to the project to-do list

- Acting role: primary implementation agent.
- Requested scope: add planes traveling between places to the project to-do list.
- Starting state: passenger planes existed as ambient globe objects, but plane-based travel was not recorded as planned work.
- Work performed: added a deferred plane travel interaction to `TODO.md` and the current milestone's next implementation list, specifying destination controls and camera transitions between geographic locations.
- Changed files: `TODO.md`, `INFO.md`, `milestone/current.md`, `milestone/history/INFO.md`, and this history entry.
- Decision: treat planes as a future visitor-facing navigation mechanism, not merely additional ambient movement.
- Checks/evidence: inspected the resulting Markdown diff; no application code changed, so no build or code validation was needed.
- Resulting state: plane-based travel between places is now explicitly tracked in the authoritative active project documentation.
- Remaining work: design and implement the boarding, destination-selection, and travel-transition experience in a future pass.
- Handoff: preserve the existing ambient globe planes until the interactive travel design establishes whether they should be reused or remain decorative.
