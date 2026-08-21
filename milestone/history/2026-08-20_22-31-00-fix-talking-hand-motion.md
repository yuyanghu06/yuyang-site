# Fix talking-loop hand motion and clipping

- User review correctly identified that the first V2 talking loop only transferred upper-arm motion: both hands were effectively rigid, and the right hand crossed in front of the thigh.
- Extended the talking retarget mapping through both shoulders, forearms, hands, and all three joints of every digit.
- Added per-target-bone motion scaling to the shared retargeter. The final talking calibration keeps shoulder motion at 20%, upper arms at 12%, forearms at 30%, hands at 35%, and finger joints at 30% of the library deltas.
- Rebuilt the Blender source, GLB, PNG sequence, and `public/style-references/avatar/yuyang-avatar-talking-loop-v2.mp4` in place.
- Nine full-cycle samples keep both hands outside the pants without the rejected clawing or splitting. Local-pose measurements confirm motion on both hands (`0.126699` left and `0.138645` right), plus animated right index and thumb chains.
- Exact loop closure remains `0.0`; a clean GLB round trip retains all 54 bones and the single `Yuyang_Talking_Loop_v2` Action.
