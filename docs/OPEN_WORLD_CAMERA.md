# Open World Camera

The game uses a perspective third-person chase camera inspired by the camera grammar used by World of Claudecraft. The map editor intentionally keeps `IsometricCamera`; the two experiences no longer share a forced camera model.

## Game defaults

- Perspective FOV: 60 degrees
- Yaw: PI
- Pitch: 0.32 rad
- Distance: 12 world units
- Zoom range: 3..22
- Pitch range: -0.4..1.35 rad
- Eye pivot: 1.8 units above the player root

## Follow

`OpenWorldCamera` follows a critically damped pivot rather than copying the player position every frame. Horizontal follow is tighter than vertical follow. Teleports snap instead of dragging the view across the map. A small velocity look-ahead shifts the pivot toward travel direction.

The requested orbit distance is preserved when the mathematical camera point falls below terrain; the camera is lifted above the sampled terrain instead of shortening the boom.

## Controls

- Mouse wheel: zoom
- Middle-mouse drag: orbit
- Alt + left-mouse drag: orbit alternative
- WASD: camera-relative movement

Existing combat bindings remain available: left click/J attacks and right click/K blocks. Alt + left click is reserved for camera orbit and does not queue an attack.

## Architecture

`Engine` accepts an injected camera controller but defaults to `IsometricCamera`. Therefore existing editor code remains unchanged while the game supplies `OpenWorldCamera`.

The camera math is separated into `openWorldCameraMath.ts` so spring behavior, orbit projection, and clamps can be unit tested without DOM/WebGL.
