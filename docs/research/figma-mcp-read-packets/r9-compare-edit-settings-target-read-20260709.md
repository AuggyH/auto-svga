# R9 Compare Edit Settings Target Read - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: completed-partial

This packet supports Auto SVGA `0.1.x / SVGA Preview MVP` UI/UX
implementation. It is an implementation input, not product scope authority.
The PRD remains `docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

R8 successfully confirmed the high-impact page-state index and shared module
composition, but its second response was truncated before full Compare loaded,
Edit default, and Settings interiors were returned. Those interiors are now the
remaining blocker for continuing component-system landing without guessing from
old prototype structure.

R9 must therefore read only the missing interior contracts:

- `对比 / 双文件已加载`;
- `编辑 / 默认`;
- `参考 / 设置面板`;
- optionally `对比 / 空态` if it fits in the same compact payload.

R9 must not re-read screenshots, variables, full component-library descendants,
or all page states.

## Budget

- Current local-day conservative usage before this batch: 12/160.
- Planned MCP reads: 1.
- Hard cap: 2.
- Optional second read is allowed only if the first call errors or returns no
  usable target frame payload. If the first call returns partial interiors, stop
  and use the partial contract instead of retrying for visual completeness.

## Read Plan

Use one read-only `_use_figma` script on the `auto-svga` page. The script must:

- switch page exactly once with `await figma.setCurrentPageAsync(page)`;
- skip the `备份` page;
- find only the target frame names listed above;
- return frame geometry, direct children, one nested level for immediate
  modules/instances, component or variant names when available, and compact
  text samples;
- cap children at 10 per node and text samples at 8 per target;
- return compact JSON only;
- not return fills, vectors, image hashes, screenshots, full descendants, full
  text-node trees, or invisible instance interiors.

## Truncation Prevention

- Serialize only compact POJOs.
- Strip geometry to rounded `x/y/w/h`.
- Record `childCount` and `truncatedChildren` instead of returning all
  descendants.
- Do not include color/style dumps.
- Use `figma.skipInvisibleInstanceChildren = true`.
- Prefer frame names and component/variant identities over full node paths.

## Stop Condition

Stop after one successful compact response that includes at least one target
frame with direct child modules and one nested level. If the call fails, inspect
the error before any retry. If a retry is needed, it must narrow to the single
missing state rather than repeat all targets.

## Planned Implementation Use

R9 should feed the next implementation WPs:

- Compare loaded right information and canvas structure alignment;
- Edit reserved layout and left layer-list surface alignment without expanding
  short-term editing scope;
- Settings sheet visual-language alignment and approved appearance controls.

R9 must not be used to add new product copy, hidden future controls, inactive
editor operations, or old Workbench settings behavior.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `auto-svga` page | Compact interiors for Compare loaded, Edit default, Settings, and optional Compare empty | Yes | 4.5433s | Compare loaded, Edit default, and Settings returned usable interiors; response tail truncated before optional Compare empty |

Actual total MCP attempts: 1

Actual quota-counted reads, conservative: 1

Measured MCP tool wall time total: 4.5433s

Current local-day conservative usage after this batch: 13/160.

The optional second read was not used because the first call returned the
blocking target interiors. R9 should use the partial contract rather than spend
another quota unit chasing optional completeness.

## Extracted Contract

### Compare Loaded

- Page-state frame: `对比 / 双文件已加载`, `1280 x 800`.
- Direct composition:
  - titlebar `920 x 48`;
  - `Module/中间面板`, `模式=对比`, `920 x 800`;
  - right content `360 x 800`, `模式=对比, 状态=双文件`, vertical,
    padding `16`, gap `4`.
- Compare center module:
  - two canvas regions, each `460 x 800`;
  - shared playback controls `920 x 68` at `y=732`, horizontal, gap `16`,
    padding `12 / 24`;
  - mode switcher `152 x 42` at top center.
- Compare right surface:
  - header row `312 x 54`;
  - horizontal divider `328 x 1`;
  - comparison metric area `328 x 347`, horizontal, two child columns.
- Visible text samples confirm `对比模式`, `退出对比`, and file metric labels
  such as `文件大小`.

### Edit Default

- Page-state frame: `编辑 / 默认`, `1280 x 800`.
- Direct composition:
  - left sidebar `360 x 800`;
  - center module `560 x 800`;
  - right sidebar `360 x 800`;
  - left titlebar `360 x 48`.
- Center module:
  - canvas region `560 x 800`;
  - playback controls `560 x 68` at `y=732`;
  - mode switcher `152 x 42` at top center.
- Left sidebar:
  - vertical, padding top `48`, side/bottom `16`, gap `4`;
  - file header `328 x 50`;
  - divider `328 x 1`;
  - filter tabs `235 x 34`;
  - layer-list rows `328 x 56`, row gap `4`, row padding `4 / 0`,
    row type `Molecule/图层列表行`, states include default and hidden.
- Right sidebar:
  - vertical, padding `24 / 16`, gap `8`;
  - Figma includes placeholder text, but implementation must still follow the
    PRD/DESIGN boundary: short-term Edit right panel stays reserved and must
    not expose inactive controls or future-function copy.

### Settings

- Page-state frame: `参考 / 设置面板`, `1280 x 800`.
- Overlay structure:
  - two full-frame background rectangles;
  - `Module/设置面板` centered at `x=460, y=253`, size `360 x 298`.
- Settings module:
  - vertical, padding top/bottom `24`, gap `16`, width `360`;
  - title row `358 x 22`, horizontal, padding side `24`;
  - divider `358 x 1`;
  - appearance block `358 x 116`, vertical, gap `10`, padding side `24`;
  - divider `358 x 1`;
  - button area `358 x 44`, horizontal, padding side `24`.
- Visible text samples confirm approved appearance choices: `跟随系统`,
  `浅色`, and dark-mode option text in the same group.

## Retrospective

- Effective: yes. One narrow read replaced the previous R8 uncertainty for
  Compare loaded, Edit default, and Settings without re-reading screenshots,
  variables, or the full component library.
- Cost control: good. The planned one-read path succeeded, and the optional
  second read was skipped because it would only recover optional Compare empty
  detail.
- Design-source alignment: useful for structural/component landing, not a
  license for new product text. In particular, Edit right placeholder text in
  Figma must be reconciled against the stricter PRD/Owner copy boundary before
  implementation.
- Next implementation move: land shared Compare/Edit/Settings module skeletons
  from this contract first, then perform page-specific visual polish.

## WP-O Compare Edit Settings Skeleton Retrospective

- Scope: implementation pass using the already-read R9 contract. The pass
  aligned Compare loaded metrics to two Figma-style columns, added tokenized
  Edit left-sidebar header/list structure, and tightened Settings sheet rhythm
  around the `360 x 298` module contract.
- Effectiveness: medium-high. This moved three page families from loose
  engineering-shell structure toward Figma component contracts without adding
  product copy, new settings, new edit actions, or a new compare entry point.
- Figma usage: no additional MCP read. R9's existing partial output was enough
  for the implementation decision, and the optional Compare empty detail was
  intentionally not chased.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `git diff --check` passed.
- Cost control: one bundled validation set was used for Compare/Edit/Settings
  skeleton work. No package refresh or foreground screenshot was produced
  because this WP is still structural design-system landing, not final
  owner-visible acceptance.
- Boundary: Edit left sidebar shows the file header and layer rows only. The
  Figma filter-tabs and Edit right placeholder text remain excluded because
  they would imply operations or inactive future scope beyond the current
  short-term boundary.

## WP-T Compare Right Surface Hierarchy Retrospective

- Scope: focused Compare right-surface visual hierarchy correction. The visible
  comparison file columns now show the file names, or `未打开文件` in empty
  state, without auxiliary `A 文件` / `B 文件` labels.
- Effectiveness: medium. This is a small but visible alignment with the
  Owner/Figma Compare direction: the two compared files are the column headers,
  while `对比模式` and `退出对比` stay as the mode/action row.
- Figma usage: no additional MCP read. The existing R9 Compare loaded contract
  and Owner reference sketches were sufficient.
- Validation: `npm run desktop:short-term:design-system-check` passed, and
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed.
- Boundary: no Compare entry point, drag decision, playback, file-open, or
  inspection logic changed. Hidden canvas slot headers remain hidden internal
  state affordances.
- Lesson: Compare should use meaningful file identity as visible hierarchy and
  keep technical slot labels out of the user-visible right surface unless the
  design explicitly asks for them.

## WP-U Workbench Titlebar Safe Area Retrospective

- Scope: tokenized a shared workbench top safe area so the canvas mode switch,
  Preview right header actions, and Compare `退出对比` action sit below the
  transparent macOS titlebar hit region. Canvas surfaces still extend underneath
  the titlebar to preserve the low-boundary, immersive direction.
- Effectiveness: high. The previous Compare smoke failure exposed a real UX
  defect: the exit action was visible but its pointer path was blocked by the
  draggable titlebar layer. The repaired smoke proof now confirms the button is
  rendered below the titlebar and exits to Preview through a real pointer hit.
- Figma usage: no additional MCP read. Existing R8/R9 packets already record
  48px titlebar modules and top-centered mode switchers, so this was an
  implementation correction from existing design evidence.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `npm run desktop:smoke` passed.
- Boundary: no product copy, commands, compare entry point, file loading,
  playback, optimization, or save logic changed.
- Lesson: transparent titlebar immersion needs an explicit safe-area token for
  interactive controls; proof selectors must distinguish removed legacy panel
  tabs from valid in-section controls such as asset filters.

## WP-V Compare Empty Slot Drop Target Retrospective

- Scope: page-state visual alignment for General Compare empty / half-empty
  slots. Empty compare previews now use the same `FileDropTarget` language as
  Launch: a low-emphasis upload icon, `拖拽文件到此处`, and the existing
  `打开文件` button grouped as one centered prompt. Loaded slots still hide the
  empty prompt.
- Effectiveness: medium-high. The previous half-empty Compare screenshot showed
  a single blue button floating in the canvas, which broke the Owner-confirmed
  immersive drop-canvas language. The refreshed smoke evidence now shows the
  empty slot as a quiet drop target while the loaded A-side preview remains
  unchanged.
- Figma / reference usage: no new Figma MCP read. The change uses the archived
  Owner compare-empty reference image and the existing R9 Compare structure.
  It does not expand the Compare entry model or add a persistent main-surface
  entry.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `npm run desktop:smoke` passed.
- Boundary: no file-open logic, drag-decision split, compare playback, right
  comparison panel content, save behavior, or product scope changed.

## WP-R Side Surface And Settings Sheet Contract Retrospective

- Scope: shared page-state surface contract pass for Preview, Compare, Edit,
  and Settings. SettingsSheet now has explicit tokenized border, radius,
  background, shadow, and backdrop contracts. Preview right surface, Compare
  information surface, Edit layer panel, and Edit reserved panel now consume a
  shared `SideSurface` background/separator token instead of each relying on
  old right-panel visual naming.
- Effectiveness: medium-high. This is not a new feature and does not try to
  restyle one screenshot in isolation; it reduces future polish cost by
  centralizing the visual material for the major side surfaces and the settings
  panel. The refreshed Settings smoke screenshot shows a lighter modal shell
  with no product copy or settings added.
- Figma usage: no additional MCP read. R9 already captured the Settings module
  geometry and Compare/Edit side-surface structure; R10 already covered the
  settings component and control contracts.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `npm run desktop:smoke` passed.
- Cost control: one bundled validation cycle was used for the whole
  SideSurface/SettingsSheet contract. No package promotion or foreground
  desktop capture was run because this remains source-level visual refinement;
  final visual acceptance still requires real foreground app evidence.
- Boundary: no product behavior, menu command, theme choice set, file-open
  logic, compare entry point, edit operation, or visible copy changed.
- Lesson: page-state polish should first consolidate shared surface tokens.
  Otherwise Preview, Compare, Edit, and Settings drift into similar-looking but
  separately-tuned shells that are expensive to align later.
