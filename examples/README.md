# examples

几个可直接套用的分镜配置。用法：

```bash
# 看效果（不安装，不起服务）
cp examples/video-then-image.json boot.config.json
node tools/preview.mjs

# 或者直接指定配置预览，不动 boot.config.json
node tools/preview.mjs --config examples/video-then-image.json
```

素材放 `media/` 或 `~/.dsh/boot-sequence-media/`，文件名与 `phases[].src` 对应。

| 文件 | 说明 |
|---|---|
| `minimal.json` | 只有一段抽象底，1.4 秒，适合只想“遮一下白屏” |
| `video-only.json` | 单段视频，最长 12 秒 |
| `image-only.json` | 单张图，2.4 秒 |
| `video-then-image.json` | 视频 → 图片 → 回黑，最常见 |
| `branded.json` | 抽象底 + 左下品牌行 + 右下跳过提示 |
