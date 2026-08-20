# Handle road-load abort

- Attached an AbortError handler immediately to the independently started road GLB promise.
- Normal effect cleanup and route remounts now resolve the staged road timing quietly instead of producing an unhandled rejection at `abortController.abort()`.
- Non-abort road-loading failures still propagate to the scene loader error path.
