# 中国空间站实时追踪（WhereTheCSS）

基于 **React Router + TypeScript + Tailwind + Vercel** 的中国空间站（CSS / 天宫）内容与可视化站点。默认首页为**实时追踪**：星下点轨迹、当前经纬高、时钟，以及基于 ASTROX 的过境/可见性预报。三维场景（WebGPU + 3d-tiles-renderer）保留在「天宫 3D」等路由。

线上：https://wherethecss.vercel.app/

## 功能概览

- **实时模式**：使用中国载人航天官网发布的 OEM 星历插值当前位置（有效窗口约 **7 天**）。
- **每日刷新**：GitHub Action 每天拉取最新 OEM 与综合新闻标题，写入 `public/data/`。
- **可见性 Access**：地面站 ↔ 空间站通过 ASTROX `AccessComputeV2`（见 [astrox-skills/access](https://github.com/blitheli/astrox-skills/tree/main/skills/access)）。
- **新闻**：仅展示 CMSE 综合新闻标题与原文链接，不转载正文。


## 界面与时钟

- **全站深色**：任务控制台风格（近黑底），导航/页头/面板统一暗色。
- **2D 底图**：MapLibre GL + **高德中文标注**栅格（`lang=zh_cn`），经 CSS invert 转为深色；星下点轨迹与当前位置叠加其上。
- **星下点**：以当前仿真时刻为中心约 **2 个轨道周期**（≈ ±92.5 min），OEM 插值；过日界线分段。
- **大屏时钟**：2D 地图顶部居中显示**北京时间**（`Asia/Shanghai`）`HH:mm:ss`，日期较小；UTC 另列。
- **共享仿真时钟**（`app/lib/clock/simClock.ts` + jotai）：2D 与「天宫 3D」共用 `simTimeMs`。
- **底部 OEM 时间轴**：跨度 = 官方 `START_TIME`→`STOP_TIME`（约 7 天）。
  - **实时**：跟随墙钟（钳制在 OEM 窗内），scrubber 同步前进。
  - **非实时**：暂停跟随，可在有效窗内拖动；2D/3D 均冻结到所选时刻。

## 3D 地球与天宫

基于 [3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) + [@takram/three-geospatial](https://github.com/takram-design-engineering/three-geospatial)。**不使用 Cesium / Cesium Ion。**

| `Globe` `source` | 数据 | Token |
| --- | --- | --- |
| `auto`（默认） | 有 `VITE_GOOGLE_MAP_API_KEY` → Google Photorealistic **3D Tiles**（影像+地形网格）；否则 ESRI XYZ 椭球影像 | Google key 可选 |
| `google` | Photorealistic 3D Tiles | `VITE_GOOGLE_MAP_API_KEY` |
| `xyz` | ESRI World Imagery → WGS84 椭球（官方 [mapTiles](https://nasa-ammos.github.io/3DTilesRendererJS/three/mapTiles.html)；无 DEM） | 不需要 |

- XYZ 默认 URL：`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`（可用 `VITE_GLOBE_XYZ_URL` 覆盖）
- **朝向**：全球浏览 XYZ 需 `-π/2`；LEO/`ReorientationPlugin` 时传 `reoriented`，禁止再套 `-π/2`
- **飞行**：瓦片原点间歇重定（滑出约 80 km 才 `ReorientationPlugin.update`，避免每帧打爆 LOD）；天宫在局部系按 OEM 插值连续滑动
- **轨迹**：约 ±1 轨珠串（`OBJECT_FRAME` 与重定向一致）
- **光照**：太阳 ECEF→世界 `DirectionalLight` + 环境/点光；`tg_simple.glb` PBR，帆板对日
- 模型：`public/models/tg_simple.glb`；相机百米级

`/tiangong` 与 2D 共用 `simTimeMs`；WebGPU/WebGL 同一套非后处理场景。

## 轨道数据来源（必须）

| 项目 | 说明 |
| --- | --- |
| 官方栏目 | [中国空间站轨道参数](https://www.cmse.gov.cn/gfgg/zgkjzgdcs/) |
| 格式 | CCSDS **OEM 2.0**（`.zip` → `.dat`），**不是** TLE |
| 参考系 | `EME2000`，时间系 `UTC`，单位 km / km/s |
| 有效跨度 | `START_TIME` → `STOP_TIME`，实测约 **7 天**（用户所称「约 8 天」对应此官方窗口） |
| 发布节奏 | 通常每周一、三、五（页面日历禁用二/四/六/日） |
| 按日 API | `/was5/web/search?token=…&channelid=228160&docreltime=YYYY.M.D` |
| 说明文 | [中国空间站OEM来啦](https://www.cmse.gov.cn/xwzx/202309/t20230913_54312.html) |

本站**不编造** OEM 数值。抓取失败时回退到仓库内 `fixtures/cmse/` 样本，并在元数据中标记。

**不使用 Celestrak TLE** 作为默认轨道源。若未来需在 CMSE 不可达时降级，必须在 UI 与 PR 中明确标注「非官方 OEM」。

## 每日更新

- 脚本：`npm run fetch:cmse`（或分别 `fetch:orbit` / `fetch:news`）
- 工作流：`.github/workflows/update-cmse-data.yml`（cron `30 2 * * *` UTC + 手动触发）
- 产物：
  - `public/data/css-oem-latest.json` — 解析后的米制 `cartesianVelocity`（供前端与 ASTROX CzmlPosition）
  - `public/data/css-oem-meta.json` — 元数据摘要
  - `public/data/cmse-news.json` — 新闻标题列表

选择 **GitHub Action** 而非 Vercel Cron：当前 `react-router.config.ts` 为 `ssr: false`（静态 SPA），把数据写进 `public/data` 最稳妥。

## ASTROX Access 调用

- 文档技能：https://github.com/blitheli/astrox-skills/tree/main/skills/access （阅读 `SKILL.md` + fixtures）
- 默认服务：`http://astrox.cn:8765`
- 端点：`POST /access/AccessComputeV2`
- 本站构造：`FromObjectPath.Position = SitePosition`，`ToObjectPath.Position = CzmlPosition`（由 CMSE OEM 转换，`referenceFrame: INERTIAL`）
- 环境变量：`VITE_ASTROX_BASE_URL`（见 `.env.example`）
- 降级：网络/超时/非 200/`IsSuccess=false` 时 UI 提示，不阻塞追踪页主流程

本地探测：

```bash
curl -sS -X POST "http://astrox.cn:8765/access/AccessComputeV2" \
  -H 'Content-Type: application/json' \
  --data-binary @<(node -e "
    // 也可用仓库生成的请求；服务未启动时会失败，属预期
  ")
```

## 坐标系约定

| 环节 | 参考系 |
| --- | --- |
| CMSE OEM | EME2000 位置/速度（文件内 km） |
| 站内 JSON | 同上，已换算为 **米 / 米每秒** |
| 星下点显示 | EME2000 →（GMST）→ ECEF → WGS84 经纬高（可视化精度） |
| 天宫 3D 页 | 既有 ECEF / ENU / 物体局部坐标逻辑，见 `CLAUDE.md` 与 `TG_glb.tsx` 注释 |

## 本地开发

```bash
npm install
npm run fetch:cmse   # 可选：刷新官方数据
npm run dev          # http://localhost:5173
```

验证：

1. 首页显示北京时间/UTC、经纬高、星下点轨迹。
2. 「即将过境」在 ASTROX 可达时列出弧段；不可达时出现降级文案。
3. 「轨道参数」「综合新闻」页链接指向 cmse.gov.cn。
4. 「天宫 3D」应看到带卫星影像的地球 + 天宫模型（非空白椭球）。

```bash
npm run typecheck
npm run build
```

## 项目结构（关键）

```text
app/
  components/tracker/   # 实时追踪 UI
  lib/oem/              # OEM 解析、插值、ECI→大地坐标
  lib/astrox/           # Access 客户端与请求构造
  lib/cmse/             # 加载 public/data
  routes/               # home / access / news / orbit / tiangong …
scripts/                # fetch-cmse-oem.mjs / fetch-cmse-news.mjs
fixtures/cmse/          # HTML + OEM 样本（抓取回归）
public/data/            # 每日更新的 JSON
.github/workflows/      # 每日 Action
```

## Vercel

- 使用 `@vercel/react-router` preset；推送后自动部署。
- 勿提交 `.env` 中的真实密钥。

## 许可与引用

轨道与新闻内容版权归属中国载人航天相关发布方；本站仅做公开信息的非商业可视化引用，并标注官方 URL。
