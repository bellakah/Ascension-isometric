# Editor Game Perspective Camera

The World Editor now evaluates world composition through the same baseline perspective used by gameplay.

## Shared baseline

Both gameplay and editor use:

- `THREE.PerspectiveCamera`
- FOV: 60 degrees
- default yaw: `Math.PI`
- default pitch: `0.32 rad`
- default distance: `12` world units

The editor camera orbits a point of interest instead of following the player's spring arm. This keeps authoring practical while preserving the same perspective, scale and depth perception used in Playtest.

## Navigation

- RMB drag: orbit
- MMB drag: pan
- Shift + RMB drag: pan alternative
- Mouse wheel: zoom
- F: focus selected entity
- Q / E: rotate 90 degrees
- `Game Cam`: focus the map spawn at player eye height and restore gameplay yaw/pitch/distance

The editor can zoom farther than gameplay for large-map authoring. `Game Cam` always returns to the exact gameplay baseline.

## Why

An orthographic isometric editor can make mountains, roads, vegetation spacing and building scale look acceptable in authoring while feeling very different in the perspective game. Using the gameplay projection in the primary viewport makes visual decisions representative before entering Playtest.

`IsometricCamera` remains in the codebase for future technical/overview views; it is no longer the primary World Editor camera.
