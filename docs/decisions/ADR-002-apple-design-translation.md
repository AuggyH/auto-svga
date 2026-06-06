# DESIGN-apple.md → Auto SVGA DESIGN.md 转译对照

本文档记录从 Apple 官网设计分析（`DESIGN-apple.md`）到 Auto SVGA 工具型设计系统（`DESIGN.md`）的原则级转译。每一条说明：Apple 做了什么、Auto SVGA 是否采用、如何调整、为什么不照搬。

---

## 色彩系统

| Apple token | Apple 值 | Auto SVGA token | Auto SVGA 值 | 调整说明 |
|-------------|---------|-----------------|-------------|---------|
| `primary` | #0066cc | `--color-action` | #0066cc | **完全保留**，单一交互蓝 |
| `primary-focus` | #0071e3 | `--color-action-focus` | #0071e3 | **完全保留**，focus ring |
| `primary-on-dark` | #2997ff | `--color-action-on-dark` | #2997ff | **完全保留**，暗色表面链接 |
| `ink` | #1d1d1f | `--color-text` | #1d1d1f | **完全保留**，主文字色 |
| `ink-muted-80` | #333333 | `--color-text-secondary` | #333333 | **保留**，次级文字 |
| `ink-muted-48` | #7a7a7a | — | — | **不采用**，工具不需要 disabled 灰 |
| `canvas` | #ffffff | `--color-canvas` | #ffffff | **完全保留**，主画布 |
| `canvas-parchment` | #f5f5f7 | `--color-canvas-soft` | #f5f5f7 | **保留**，重命名为 soft |
| `surface-pearl` | #fafafc | `--color-surface` | #fafafc | **保留**，面板背景 |
| `surface-tile-1/2/3` | #272729 等 | `--color-dark-surface` | #272729 | **简化**，3 档合并为 2 档（工具不需要微步差） |
| `surface-black` | #000000 | — | — | **不采用**，工具不需要纯黑 nav |
| `hairline` | #e0e0e0 | `--color-hairline` | rgba(0,0,0,0.08) | **调整**，更轻的 hairline |
| `divider-soft` | #f0f0f0 | `--color-divider` | #f0f0f0 | **保留** |
| `body-muted` | #cccccc | `--color-text-on-dark-muted` | #cccccc | **保留** |

### 不采用的 Apple 色彩模式

- **表面微步差**（tile-1/2/3）：Apple 用 3 个近黑色来区分相邻 dark tile。工具不需要——两档足够。
- **纯黑 global-nav**（#000000）：Apple 顶部 44px 纯黑导航条。工具不采用——用 frosted surface 代替。
- **disabled 灰色**（#7a7a7a）：工具不采用 disabled 状态文字——按钮不可用时隐藏或显示具体原因。

---

## 字体系统

| Apple token | Apple 值 | Auto SVGA token | Auto SVGA 值 | 调整说明 |
|-------------|---------|-----------------|-------------|---------|
| `hero-display` | 56px/600/1.07 | — | — | **不采用**，工具不需要 56px 标题 |
| `display-lg` | 40px/600/1.10 | — | — | **不采用**，营销大标题 |
| `display-md` | 34px/600/1.47 | — | — | **不采用** |
| `lead` | 28px/400/1.14 | — | — | **不采用** |
| `tagline` | 21px/600/1.19 | `--text-title` | 17px/600/1.24 | **降级**，工具最大字号 17px |
| `body` | 17px/400/1.47 | `--text-body` | 14px/400/1.47 | **降级**，工具需要更高密度 |
| `caption` | 14px/400/1.43 | `--text-ui` | 13px/500/1.35 | **调整**，UI 标签 |
| `fine-print` | 12px/400/1.0 | `--text-caption` | 12px/400/1.35 | **保留**，辅助信息 |
| `micro-legal` | 10px/400 | — | — | **不采用**，工具不需要微型法律文字 |
| font stack | SF Pro Display + Text | `--font-system` | system-ui, -apple-system, Inter | **简化**，统一用 system-ui 栈 + Inter 回退 |

### 不采用的 Apple 字体模式

- **负 letter-spacing**（-0.28 到 -0.374px）：Apple 在大字号上收窄字距产生"Apple tight"效果。工具使用 14-17px 字号，负 tracking 会降低可读性——**不采用**。
- **Weight 300**：Apple 在 `button-large`（18px/300）和 `lead-airy`（24px/300）使用。工具的 14px 字号下 300 太细——**不采用**。
- **Weight 500 缺失**：Apple 的 font-weight 阶梯是 300/400/600/700。工具 UI 标签使用 500 作为中间档——**补充**。
- **SF Pro Display vs Text 分离**：Apple 在两套字体间切换（Display ≥19px，Text <20px）。工具所有文本 ≤17px，统一用 Text——**简化**。

---

## 间距系统

| Apple token | Apple 值 | Auto SVGA token | Auto SVGA 值 | 调整说明 |
|-------------|---------|-----------------|-------------|---------|
| `xxs` | 4px | `--space-xxs` | 4px | **完全保留** |
| `xs` | 8px | `--space-xs` | 8px | **完全保留** |
| `sm` | 12px | `--space-sm` | 12px | **完全保留** |
| `md` | 17px | `--space-md` | 16px | **调整**，17→16 保持 8px 节奏 |
| `lg` | 24px | `--space-lg` | 24px | **完全保留** |
| `xl` | 32px | `--space-xl` | 32px | **完全保留** |
| `xxl` | 48px | — | — | **不采用**，工具不需要 48px 间距 |
| `section` | 80px | — | — | **不采用**，营销页面的大段间距 |

### 不采用的 Apple 间距模式

- **80px section padding**：Apple 每个 product tile 上下 80px。工具面板 padding 16-24px——**不采用**。
- **0px tile gap**：Apple tile 之间无间隙，靠颜色变化分割。工具保留 12-16px gap 以区分不同功能区——**不采用**。

---

## 圆角

| Apple token | Apple 值 | Auto SVGA token | Auto SVGA 值 | 调整说明 |
|-------------|---------|-----------------|-------------|---------|
| `sm` | 8px | `--radius-sm` | 8px | **完全保留** |
| `md` | 11px | `--radius-md` | 11px | **完全保留** |
| `lg` | 18px | `--radius-lg` | 18px | **完全保留** |
| `pill` | 9999px | `--radius-pill` | 9999px | **完全保留** |
| `xs` | 5px | — | — | **不采用**，工具不需要 |
| `none` | 0px | — | — | **不采用**，工具所有卡片需要圆角 |

---

## 阴影与层级

| Apple 模式 | Auto SVGA 处理 | 原因 |
|-----------|---------------|------|
| 单一产品阴影 `rgba(0,0,0,0.22) 3px 5px 30px` | **不采用** | 工具无产品摄影图 |
| hairline 1px border 作为主要分割 | **完全保留** | `--color-hairline` |
| backdrop-blur frosted 效果 | **保留**，可选 | 面板可用，但必须保证可读性 |
| 无 UI chrome 阴影 | **完全保留** | 工具不加重阴影 |
| 颜色交替作为 section divider | **不采用** | 工具不是全屏 tile 布局 |

---

## 组件对照

| Apple 组件 | Auto SVGA 对应 | 采用/调整 |
|-----------|---------------|----------|
| `global-nav`（44px 纯黑） | Toolbar（48px frosted） | **重设计**：工具不需要纯黑 nav |
| `sub-nav-frosted`（52px frosted） | Toolbar 合并 | **合并**，工具只有一层顶部栏 |
| `button-primary`（蓝 pill） | Primary button | **完全保留**：Action Blue + pill + scale(0.97) |
| `button-secondary-pill`（蓝 hollow pill） | Secondary button | **保留** |
| `button-pearl-capsule` | Utility button | **重命名** |
| `store-utility-card`（18px 圆角，24px padding，hairline） | Info panel / Preview card | **适配**：保留 18px + hairline，padding 16px |
| `product-tile-*` 系列 | — | **不采用**，工具无全屏 tile |
| `footer` | — | **不采用**，工具无 footer |

---

## 动效

| Apple 模式 | Auto SVGA 处理 |
|-----------|---------------|
| `transform: scale(0.95)` active state | **完全保留** |
| 极简动效，无装饰性动画 | **完全保留** |
| 无 motion library（原生 CSS transition） | **保留**，CSS token + 可选 JS spring |

---

## 可访问性

| Apple 模式 | Auto SVGA 处理 |
|-----------|---------------|
| 系统 VoiceOver 支持 | **保留**，目标 WCAG AAA |
| 无显式 focus-visible（依赖系统默认） | **加强**：明确 2px `--color-action-focus` outline |
| 无显式 contrast 声明 | **加强**：明确标注 contrast ratio 目标 |

---

## 总结：采用率

| 类别 | 采用 | 调整后采用 | 不采用 |
|------|------|----------|--------|
| 色彩 token | 8 | 3 | 3 |
| 字体 token | 3 | 4 | 7 |
| 间距 token | 5 | 1 | 2 |
| 圆角 token | 4 | 0 | 2 |
| 阴影/层级 | 2 | 1 | 2 |
| 组件 | 3 | 3 | 4 |
| 动效 | 2 | 0 | 0 |
| 可访问性 | 1 | 2 | 0 |
| **合计** | **28** | **14** | **20** |

**核心结论**：Apple 的色彩、间距、圆角 token 体系大部分可直接采用（28 项）。字体和组件体系需要大幅降级适配工具场景（14 项调整）。营销向的大字号、大间距、全屏 tile、产品阴影等 20 项不适用于生产工具。
