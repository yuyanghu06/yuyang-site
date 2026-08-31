# Smooth mobile dialogue reveal

Replaced per-character timeout rendering with an animation-frame-aligned, elapsed-time-corrected caption scheduler that batches overdue characters into one React update per frame. Short-landscape spacing now measures only on observed geometry changes, active dialogue audio avoids redundant play promises, and transcript live announcements resume after each caption completes while existing timing and presentation semantics remain intact.
