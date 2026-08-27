# Skylya Dating 官网

这是一个 React + Vite 静态官网项目，面向 Skylya 特别版：关系情境测试、三轴预览、八种人格与 Dating 入口。

## 本地运行

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 4174
```

## 生产构建

```bash
npm ci
npm run build
```

构建产物位于 `dist/`。服务器只需要部署 `dist/` 目录内的内容；不要把 `node_modules/` 上传到服务器。

这是单页应用。若服务器使用 Nginx，请为未知前端路径回退到 `index.html`，例如：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 打包内容

交付源码包包含：`src/`、`public/`、`package.json`、`package-lock.json`、`vite.config.js`、`index.html`、`.oxlintrc.json` 与已构建的 `dist/`。

不包含：`node_modules/`、本地开发状态、浏览器测试脚本、`.git/` 或任何环境密钥文件。
