# Avatar-frame Spec Profiles

Avatar-frame inspection separates future production targets from historical
catalog compatibility. These are different questions and must not share an
implicit gate.

## production_target

`production_target` is the default and only approved profile for new avatar
frame deliveries. It uses `avatarFrameProductionSpec` with:

- maximum canvas: `300 x 300`
- maximum FPS: `24`
- maximum duration: `3000 ms`
- maximum file size: `512 KiB`
- maximum resource count: `32`
- maximum transparent padding ratio: `0.5` (provisional)

The 21-sample historical calibration does not relax these limits. File size,
resource count, and transparent-padding limits remain marked for product
calibration where the current evidence is limited.

## legacy_compatibility

`legacy_compatibility` is a non-production profile descriptor for future
catalog analysis. It is:

- not approved for new delivery
- not selected by the default inspection flow
- not currently associated with compatibility thresholds
- not a replacement for `production_target`

Thresholds may be added only after the product defines what historical
compatibility means. Until then, this profile is report metadata and an
architecture boundary, not an executable delivery gate.

## Report Contract

Avatar-frame inspection reports include:

- `profileId`
- `profileLabel`
- `profilePurpose`

The Web preview may display this metadata but does not select profiles or
implement policy. Profile selection, parsing, and checks remain outside UI
components so the same contract can be reused by CLI, Web hosts, and future
macOS and Windows clients.
