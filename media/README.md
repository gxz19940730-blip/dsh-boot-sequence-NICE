# media/

把你自己准备的启动素材放这里，文件名要和 `boot.config.json` 里 `phases[].src` 对得上。

```
media/
  intro.mp4
  keyart.jpg
```

建议：

- 视频用 H.264 + `-movflags +faststart`，分辨率不必超过屏幕（4K 也能放，只是首帧略慢）
- 图片控制在 1–2 MB 以内，1920×1080 足够
- 这个目录不会被 npm 打包（`files` 白名单里没有它），属于使用者自备内容

本仓库不附带任何游戏或第三方美术资源。
