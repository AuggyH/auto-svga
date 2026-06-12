---
name: auto-svga-spec-check
description: Auto SVGA 资产规范检测规则。涉及画布、素材参数、透明空白、文件体积、纹理内存、序列帧一致性、画质或低端设备风险时使用；同时加载 auto-svga-core-guard。
---

# Auto SVGA Spec Check

## Avatar-frame Baseline

1. Keep production canvas at `300 x 300`.
2. Keep production image layers within `300 x 300` where possible.
3. Treat `600 x 600` as source design size only, not final canvas or texture size.
4. Trim transparent padding from source assets, baked masked sweep frames, and
   baked sweep-light frames.

## Checks

- canvas and asset dimensions
- effective pixel bounds and transparent-padding ratio
- file size and decoded texture memory
- frame count, FPS, and duration
- compression quality
- dirty edges, aliasing, and alpha defects
- low-end device risk

## Sequence Detection

Use explainable evidence from filename continuity, directory grouping, size
consistency, alpha-region characteristics, frame numbers, export order, file
timestamps, layer purpose, visual similarity, item count, missing frames,
duplicate frames, and abnormal dimensions.

## MotionSpecChecker Boundary

Input:

- parsed `MotionAssetInfo`
- versioned delivery specification
- optional measured or statically derived resource facts

Output:

- deterministic pass/fail status
- structured issues with severity, code, evidence, and affected field
- actionable recommendations
- explicit unknown or unmeasured fields

Base checks on real file parameters or explainable static analysis. Do not
replace validation with UI-only warnings.
