# Seamless world-loader reversal

Changed the production entry globe's continent animation to alternate direction on every iteration. The land layer now reverses at its translated endpoint and again at its starting position, removing the visible reset jump while preserving the existing two-second linear timing and the separate continuous satellite orbit.

Updated the owning style/component documentation and the authoritative milestone state. Targeted CSS inspection and `git diff --check` pass; no production build was needed for this isolated animation-direction change.
