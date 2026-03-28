# 中国空间站3D展示

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## 开始使用

### 安装

安装依赖:

```bash
npm install
```

### 开发(Development)

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## 发布(Production)

Create a production build:

```bash
npm run build
```

## 开发

- 若要增加新的页面,首先在app/routes文件夹里新增对应的tsx页面;
- 然后在layouts/site-nav.tsx里导航栏添加对应的按钮

## Vercel

本项目开发阶段使用Vercel进行发布，便于随时查看网页效果

- 在 package.json 中增加了 @vercel/react-router（当前为 ^1.2.6）。
- 从 @vercel/react-router/vite 引入 vercelPreset，并加入 presets: [vercelPreset()]，让构建产物符合 Vercel 的 SSR / 函数拆分与部署摘要。
- 打开vercel.com，用 GitHub导入本仓库。
- 之后本仓库commit后,vercel.com自动更新
- 查看网址: https://wherethecss.vercel.app/

## 样式

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
