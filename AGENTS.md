# AGENTS.md — WhereTheCSS / e-wherethecss

面向 Cursor Cloud Agent 与协作者的仓库说明（中文）。实现细节以本文件与 `README.md` 为准；3D 渲染约定另见 `CLAUDE.md`。

## 仓库目标

继续完善中国空间站内容与可视化站点：默认体验对齐「实时追踪器」（地图/星下点、时钟、位置、过境），轨道必须来自 CMSE 官方 OEM，可见性走 ASTROX access 技能。

## 技术栈

- React 19 + React Router 7（`ssr: false` SPA）+ TypeScript + Tailwind 4 + Vite
- 三维：R3F + WebGPU + `3d-tiles-renderer` + `@takram/three-*`（`/tiangong`、`/leo`）
- 部署：Vercel（`@vercel/react-router`）
- 数据刷新：GitHub Actions 每日 cron（非 Vercel Cron）

## 改动原则

1. **扩展现有栈**，不要无故换成 Cesium 整站重写。
2. **最小必要改动**；导航与文案中文化，去掉 ISS 模板英文残留。
3. **禁止编造** CMSE 轨道数或新闻正文；引用官方 URL。
4. 旋转/坐标变换须注明参考系（EME2000 / ECEF / ENU / 物体局部）。

## CMSE OEM 抓取要点

- 列表：`https://www.cmse.gov.cn/gfgg/zgkjzgdcs/`
- 解析 ZIP 链接 +「发布日期」→ 下载 → 解压 `.dat` → `scripts/fetch-cmse-oem.mjs`
- 样本：`fixtures/cmse/orbit-list.sample.html`、`fixtures/cmse/CSS_OEM_*.dat`
- **风险**：官网 HTML / WAS 查询若改版，解析可能失败；脚本会回退 fixture 并应在 PR 中说明。
- 有效期以文件内 `START_TIME`/`STOP_TIME` 为准（约 7 天）。窗口外 UI 钳制到最新官方集并提示。

## ASTROX Access

- 先读：https://github.com/blitheli/astrox-skills/blob/main/skills/access/SKILL.md
- `POST {BASE}/access/AccessComputeV2`，默认 `http://astrox.cn:8765`
- 本站：`app/lib/astrox/buildAccessRequest.ts` 使用 **SitePosition + CzmlPosition(OEM)**，避免默认 Celestrak TLE
- API 宕机：优雅降级文案；不要让首页崩溃


## 暗色主题 / 地图 / 时钟

- 强制深色：`MainLayout` + `html.dark`，勿再引入浅色默认页。
- 2D 地图：`maplibre-gl` + CARTO `dark_all` 瓦片；轨迹 GeoJSON line + Marker。
- 时钟状态：`playbackModeAtom` / `simTimeMsAtom` / `orbitDataAtom`；`OemTimeline` 挂在布局底部。
- 天宫 3D：`useOemPosition()` 驱动 ReorientationPlugin 经纬高，太阳方向用 `simTimeMs`（UTC）。

## 常用命令

```bash
npm install
npm run fetch:cmse
npm run dev
npm run typecheck
npm run build
```

## 验证清单

- [ ] 首页中文；实时位置随秒刷新
- [ ] `public/data/css-oem-latest.json` 的 `sourcePage` 指向 CMSE
- [ ] Access 在服务可用时返回 Passes
- [ ] Action workflow 文件存在且脚本可本地跑通
- [ ] README / AGENTS 与实现一致

## 安全

- 不读取/提交 `.env` 真实密钥；只用 `.env.example` 占位。
