# Wave underarm topology workaround

- Investigated the unrealistic triangular shirt stretch under the waving arm. Inner underarm vertices carried approximately 70–90% `RightArm` influence with little shoulder support, while the low-poly shirt topology had no cloth fold loops to absorb a near-horizontal arm raise.
- Tested a reversible 148-vertex localized blend across `RightArm`, `RightShoulder`, and `Spine`. It replaced the long stretch with an unacceptable pointed pinch, so the original mesh data was restored and the rejected mesh datablock was removed.
- Did not add a helper skeleton or separate the sleeve: either would break compatibility with the approved idle skin or introduce a visible seam.
- Authored `wave_hello_review_v6` with an outward-facing palm and the elbow below the shoulder. The bent forearm carries the visible wave while the upper arm stays outside the shirt topology's failure range.
- Re-exported the existing review GLB with the original 52-joint skin, connected body mesh, one finite four-second `wave_hello` animation, and exact `0.0` complete-skeleton bookend drift.
