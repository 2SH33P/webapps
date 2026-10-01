# webapps

五个纯前端小工具合并托管在一个 GitHub Pages 站点里。全部无需后端、无需构建，子目录各自独立（各自保留原仓库的完整提交历史）。

**站点：** https://2sh33p.github.io/webapps/

| 路径 | 项目 | 说明 |
| --- | --- | --- |
| [`wuzi/`](wuzi/) | 五子棋 · Gomoku | 移动端优先的本地双人五子棋 PWA，可离线安装 |
| [`latex2geogebra/`](latex2geogebra/) | LaTeX → GeoGebra | LaTeX 公式转 GeoGebra 代数输入，KaTeX 实时预览 |
| [`image-canvas-expander/`](image-canvas-expander/) | image_canvas_expander | 扩边裁切以规避 AI 生图角落水印的单文件 HTML |
| [`local-photo-converter/`](local-photo-converter/) | Local Photo Converter | 浏览器内图片压缩/格式转换（静态页在 `docs/`） |

## 结构约定

- **根目录**：`index.html` 为落地页，链接到各子站。
- **子目录**：原仓库原样保留（含各自 README、LICENSE、`.gitignore`）。所有项目的资源引用均为相对路径，因此放在子路径下不会失效；wuzi 的 PWA 用 `scope: "./"`，子路径下同样可以安装。
- **`local-photo-converter/`**：对外站点是 `docs/`，根目录的 `server.js` 仅供本地预览（`node server.js`，默认 http://127.0.0.1:3010）。该目录下的 `index.html` 只是跳转到 `docs/`。
- **`.nojekyll`**：让 Pages 跳过 Jekyll 处理，直接按文件发布。

## 部署

Pages 采用 **分支发布**（`main` 分支根目录），无需 Actions 工作流：推送到 `main` 即发布。

## 许可

各子项目自带许可，见对应目录（`local-photo-converter/` 为 Apache-2.0，其余未声明）。
