> 本项目由 OpenAI Codex 生成，旨在实现极限的图片压缩以方便图床上传于带宽节省。
>
> 您可以直接访问 https://2sh33p.github.io/Local-Photo-Converter/ 以查看部署效果。
>
> 个人推荐将压缩率调整为 80% 以实现质量和图片大小的最佳均衡。

# 本地图片格式转换器

一个纯本地运行、也可直接托管为静态站点的小网站：

- 用 Node.js 启动本地静态服务
- 图片转换在浏览器内完成，不上传服务端
- 支持拖拽上传、预览和下载
- 支持导出 `PNG`、`JPG`、`WebP`
- `JPG / WebP` 支持质量调节，`PNG` 为无损导出
- 可直接部署到 GitHub Pages

## 本地启动

```bash
npm start
```

默认打开：

```text
http://127.0.0.1:3010
```

修改端口：

```powershell
$env:PORT=8080
npm start
```

## GitHub Pages

静态发布文件已经放在 `docs/` 目录。

在 GitHub 仓库里开启 Pages 时，选择：

- Branch: `main`
- Folder: `/docs`

部署后访问 GitHub Pages 地址即可，不需要 Node.js。

## 说明

- 支持浏览器可解码的常见图片格式
- 导出依赖浏览器 `canvas.toBlob(type, quality)` 能力
- `JPG / WebP` 中 `quality` 越低，文件通常越小，但画质会下降
- `PNG` 在浏览器原生导出里通常不支持通过质量参数压缩
