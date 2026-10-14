# Mobile city renderer implementation

Role: orchestrator recording renderer coder pass.

Both city views now use DPR1–1.5 and a maximum60FPS active-frame ceiling on touch/coarse devices with viewport short-edge≤1024. Idle stays30FPS. SD shadows use1024 on these devices; desktopSD stays2048 and NYC stays1024. Globe retains previous limits; narrow mouse-only desktop windows preserve desktop settings. Valid positive DPR below1 remains native; invalid/nonpositive DPR falls back1.

New shared quality-profile helper and rendering/adaptive changes have containing guides updated. Adaptive limits immediately clamp/reset samples on view/device changes; adaptive resizing changes buffers without re-triggering camera fit. Root runtime integration releases old shadow targets before resize. Profile harness, targetedlint/scopedwhitespace pass. Independent checks cover portrait/landscape,touch/coarse/mouse,lowcore,DPR.75/0/NaN,min/max,recovery/sample reset. At390×844,DPR2→1.5 gives1,316,640→740,610pixels(-43.75%);2048→1024shadow gives75% fewertexels. These are allocation budgets, not physical-phone FPS.
