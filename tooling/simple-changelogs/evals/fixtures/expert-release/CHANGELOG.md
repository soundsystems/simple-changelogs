# Changelog

## Unreleased

- Link Audio:
  - Desktop users can now stream audio between peers in a shared session.
  - The Link settings show peer names, buffered latency, and incoming audio controls.
- The public `Song.get_current_smpte_song_time()` API now respects tempo automation.
- Added Novation Launchkey MK4 88 control-surface support.
- On macOS, large plug-in libraries no longer cause the scanner to crash.
- The documented `-RepitchWarperNoGroove` option restores the earlier Re-Pitch behavior when needed.
- On Windows, screen readers now announce focused device parameter names and values.
- Long samples now preserve their warp markers when imported into a project.
- Bouncing a sidechained track now works when the sidechain is set to Pre-FX.
- Menu commands now use the selected interface language consistently.
