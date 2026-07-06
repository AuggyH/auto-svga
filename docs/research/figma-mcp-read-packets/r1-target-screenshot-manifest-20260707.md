# Figma MCP R1 Target Screenshot Manifest

Owner lane: UI/UX
Date: 2026-07-07
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Round: R1 - Target Screenshot Archive
Status: completed

This manifest records the stable local screenshot archive created from the R1
Figma MCP read. It is an evidence index only. Product authority remains
`docs/product/PRODUCT_ROADMAP.md`, and these screenshots do not claim Owner
acceptance or release readiness.

## Archive Location

Local archive:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/`

Local archive files are intentionally outside Git. Do not commit the PNG files.

Local archive README:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/README.md`

Contact sheet:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/contact-sheet.png`

## Budget And Usage

- Planned R1 screenshot calls: 12-15
- Actual screenshot calls: 15
- Conservative quota-counted reads: 15
- Base64 responses: 0
- Download failures: 0
- Figma retries: 0
- MCP screenshot tool wall time total: 173.6277s
- Slow-call note: `55:535` took 20.7243s, crossing the soft threshold, but the
  response was complete and the downloaded PNG passed validation.

Current running budget after Batch 01 and R1:

- Batch 01 quota-counted reads: 4
- R1 quota-counted reads: 15
- Total quota-counted reads so far: 19
- Practical daily budget baseline: 160
- Remaining practical daily budget: about 141
- Mandatory reserve preserved: 40

## Screenshot Manifest

| # | Node ID | State | File | Dimensions | Bytes | SHA-256 |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `37:154` | 启动 / 默认 | `01-launch-default.png` | 720 x 720 | 48514 | `008d0d456177170e419402d6dca5c5e2bf164566afb076456b31ffdab3c64d94` |
| 2 | `27:2` | 预览 / 默认 | `02-preview-default.png` | 1360 x 880 | 252932 | `0094b1c13bc42ce03edcf92c87fc2858d2a53fbfdf4c9c709b43d8b79106ece4` |
| 3 | `82:1821` | 预览 / imageKey 重命名 Dirty 状态 | `03-preview-dirty-imagekey-rename.png` | 1360 x 880 | 254962 | `8f2484028318dbab5e318d300c7fb4afe27468a2b36c93cb80c354a5ddedc994` |
| 4 | `82:2669` | 预览 / 优化详情 | `04-preview-optimization-detail.png` | 1360 x 880 | 232758 | `e003b9794988f4ac5784e4f18a68fd034610f480732a8cdfbeb33943346ae13c` |
| 5 | `64:2040` | 预览 / 优化结果对比 | `05-preview-optimization-result-compare.png` | 1360 x 880 | 251017 | `18b79c46017bc717d71ae47a2ffa99d93c90a85bc87c82b73bc0be102dd9aedd` |
| 6 | `66:522` | 对比 / 空态 | `06-compare-empty.png` | 1360 x 880 | 56117 | `ca1742eb8de39010020550a6c4eb53eded9e230cef0487841c700af5019d3eb9` |
| 7 | `64:1320` | 对比 / 双文件已加载 | `07-compare-two-files-loaded.png` | 1360 x 880 | 252669 | `152098e88fb051679f80307fb8bd9cdd46d3fefbd993daf8e44540e840971eba` |
| 8 | `55:197` | 拖拽 / 已有文件_拖入对比 | `08-drag-existing-file-compare-decision.png` | 1360 x 880 | 362893 | `9ce1a28e388be8e678accd868fa8362500bd5147d1e83f296a19a2925ac69934` |
| 9 | `64:361` | 拖拽 / 格式不支持_拖拽中 | `09-drag-unsupported-format-hover.png` | 1360 x 880 | 362726 | `6fd7e337fd011db625381ddcf6c0ecd5dd981983f1d91854d1ad3cbe1010bacc` |
| 10 | `86:1271` | 拖拽 / 格式不支持_Drop后 | `10-drag-unsupported-format-drop.png` | 1360 x 880 | 53869 | `19a9442357699c5766ea9678f0ceaf4bcd79ad3db563e8de61fd3c1125e89082` |
| 11 | `55:535` | 编辑 / 默认 | `11-edit-default.png` | 1360 x 880 | 248240 | `a3e2be7bf3834ceb0c67e3aec8eb20b46c50334ec36827f39fa936f3e4b46953` |
| 12 | `83:2069` | 参考 / 设置面板 | `12-settings-panel.png` | 1280 x 800 | 54129 | `02b021135d8ed5ce59633f17f052831d64ed1cbdf9a0610295834d240d1ab1d8` |
| 13 | `80:16365` | 加载 / 加载中 | `13-loading-in-progress.png` | 1360 x 880 | 87831 | `a4d18ed37b5c1af82bb1bb577199e651d2f5b6a5ec178a07e39c4f7e5e5e0f94` |
| 14 | `80:16612` | 加载 / 加载失败 | `14-loading-failed.png` | 1360 x 880 | 93662 | `c330ea13546e7afb8e443e176253407286aef3aec542f4773a7161ee1d7620d6` |
| 15 | `83:1136` | 保存 / 保存失败 | `15-save-failed.png` | 1360 x 880 | 256407 | `fbed2541a731c52ef32b26bf01d16e65a846ead736ab0f67ea8ad1c193f9f2a6` |

## Visual QA

The local contact sheet was generated and visually inspected. It confirms that
all 15 target states rendered as expected:

- Launch
- Preview default
- Preview dirty Save As
- Optimization detail
- Optimization result comparison
- Compare empty
- Compare two-file loaded
- Supported drag decision
- Unsupported drag hover
- Unsupported drop recovery
- Edit reserved
- Settings panel
- Loading
- Load failed
- Save failed

Contact sheet SHA-256:

`a6faaedeec69d591009a2d590ebff45dbd2181f8e6eabe50b7d9dd74c1778e6e`

## Notes For Next Rounds

- Continue to request screenshot URLs, not base64.
- Keep screenshot reads in small batches. Full app frames commonly take
  8-20s, and at least one frame crossed the soft threshold.
- R2 token extraction can proceed without another screenshot read.
- Do not use these screenshots as product acceptance. They are design target
  evidence for later implementation and foreground macOS comparison.
