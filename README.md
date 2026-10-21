# dsh-boot-sequence

[中文](README.md) | [English](README.en.md)

给 DeepSeek Harness（DSH）的**可配置启动序列**：在应用 UI 之前铺一层全屏画面，按你配置的顺序播放视频/图片，最后黑场收尾、让界面缓缓亮起。

![默认抽象底](screenshots/backdrop.jpg)

- 只有宿主半边，不注册客户端条目
- 首帧早于应用 UI（查询期注入 `<head>`）
- 只动 `opacity` / `transform`，不触发布局
- 随时可跳过；支持 `prefers-reduced-motion`；跑完把节点和样式拆干净
- **不附带任何第三方美术资源**：默认底是 CSS 生成的抽象画面，视频/图片由你自己放进 `media/`

## 安装

```bash
dsh plugin --profile <name> add file:<本仓库绝对路径>
```

或在桌面端「设置 → 插件」里输入包名/本地路径。

## 配置

插件根目录的 `boot.config.json`，改完刷新页面即可（宿主按配置签名自动重新合成，无需重启）。

```json
{
  "mediaBase": "/dsh-boot-sequence/media",
  "fadeMs": 600,
  "minShowMs": 1200,
  "oncePerSession": false,
  "skip": { "click": true, "keys": ["Escape", " ", "Enter"] },
  "ending": { "blackoutMs": 450, "holdMs": 250, "revealMs": 900 },
  "phases": [
    { "type": "video", "src": "intro.mp4", "fit": "cover", "duration": 12000 },
    { "type": "image", "src": "keyart.jpg", "duration": 1500 },
    { "type": "blank", "duration": 600 }
  ],
  "brand": { "show": false, "text": "DEEPSEEK HARNESS" },
  "hint": "点击或按 Esc 跳过"
}
```

### 字段

| 字段 | 默认 | 说明 |
|---|---|---|
| `phases` | `[{type:"blank",duration:1400}]` | 播放顺序；`type` 为 `video` / `image` / `blank` |
| `phases[].src` | — | 相对 `media/` 的文件名；也接受 `/` 或 `http(s)` 开头的绝对地址 |
| `phases[].fit` | `cover` | `cover` 铺满 / `contain` 完整显示 |
| `phases[].duration` | 视频 30s 上限，图片 2400ms | 单段时长；视频默认播到 `ended`，`duration` 是硬上限 |
| `fadeMs` | 600 | 段间交叉淡化 |
| `minShowMs` | 1200 | 最短展示时间，避免一闪而过 |
| `oncePerSession` | false | 同一标签页只播一次（`sessionStorage`） |
| `skip.click` / `skip.keys` | true / `Esc` `Space` `Enter` | 跳过方式；`click:false` 可关闭点击跳过 |
| `ending.blackoutMs` | 450 | 结束前淡到纯黑的时长 |
| `ending.holdMs` | 250 | 黑场停留 |
| `ending.revealMs` | 900 | 整层淡出、界面亮起的时长 |
| `brand` | 关闭 | 左下角可选文字行 |
| `hint` | 空 | 右下角跳过提示文案 |

## 媒体

```
media/
  intro.mp4      # 你自己的视频
  keyart.jpg     # 你自己的图片
```

- 支持 `mp4/webm/mov`、`jpg/png/webp/avif/gif`
- 由 `/dsh-boot-sequence/media/<name>` 提供，**支持 HTTP Range**（视频可拖动、可流式播放）
- 查找顺序：插件的 `media/` → `~/.dsh/boot-sequence-media/`（推荐放这里，重装插件不会丢）
- 路径做了目录逃逸校验，只能读这两个目录下的文件
- 视频建议 `-movflags +faststart`，让 moov 在文件头，首帧更快

## 诊断

```
GET /dsh-boot-sequence/health
→ {"ok":true,"plugin":"dsh-boot-sequence","version":"0.1.0","phases":["video","image"],"screenBytes":...}
```

## 自检 / 预览

```bash
node tools/selftest.mjs   # mock ctx：注入、健康检查、媒体路由（200/206/越权 404）
node tools/preview.mjs    # 生成 dist/preview.html，浏览器直接看
```

## 设计取舍

- **不做生成物**：`screen.css` + `runtime.js` + 配置在每次渲染时合成，改样式即时生效。
- **不做内联图片**：媒体走路由，脚本体积恒定在几 KB。
- **不做复杂时间轴**：段与段之间只有淡入淡出，够用、好维护。
- **失败即静默**：合成失败就返回空注入，绝不挡住应用启动。

## 截图

![默认抽象底](screenshots/backdrop.jpg)

![品牌行与跳过提示](screenshots/brand-hint.jpg)

## 许可

MIT。本仓库不含任何游戏/第三方美术资源，`media/` 由使用者自行提供，相关素材版权归各自权利人。
