# PhotoForYou

> AI 智能选片工具 —— 500 张照片扔进去，几十秒挑出最值得修的那几张。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 它能做什么

把照片拖进去，AI 自动分析每一张 —— 找出模糊的、闭眼的、光线烂的、连拍重复的 —— 用 **Tinder 式滑动手势**呈现最好的那批。左滑不要，右滑留下，上滑再看看。

**把一小时选片变成一分钟。**

| 功能 | 原理 |
|------|------|
| **模糊检测** | 拉普拉斯方差分析，批次内相对排名 |
| **人脸质量** | 人脸检测 + 68 特征点 + EAR（眼睛）+ MAR（嘴巴）+ 头姿 + 微笑识别 |
| **曝光检测** | HSV 亮度分析，批次内相对排名（不设死阈值） |
| **连拍去重** | pHash 感知哈希聚类 |
| **综合评分** | 0-100 分，五维度加权 |
| **滑动手势** | 左滑筛除 / 右滑精选 / 上滑待定，也支持键盘 Q/W/E |
| **智能导出** | 一键导出 zip，自动按序号命名 |

---

## 架构

```
浏览器 (Vite + React)
  ├── DropZone → 选择/拖入照片，HTTP 上传
  ├── PhotoViewer → 滑动浏览
  ├── ScorePanel → 五维度评分条
  ├── ProgressBar → 实时分析进度
  └── ExportPanel → 导出统计 & 操作

Express 后端 (端口 3001)
  ├── multer → 文件接收，存本地 uploads/
  ├── sharp → 缩略图生成（400px WebP）
  ├── face-api.js → 人脸检测（68 特征点 + 表情）
  ├── imghash → pHash 连拍去重
  └── archiver → zip 导出

Web Workers（4 线程池，Comlink 通信，浏览器端运行）
  ├── 拉普拉斯方差（模糊检测）
  ├── HSV 亮度（曝光检测）
  └── 批次内相对排名引擎
```

---

## 快速开始

### 环境要求
- **Node.js 20+**

```bash
git clone https://github.com/yourusername/PhotoForYou.git
cd PhotoForYou
npm install

# 终端 1 - 启动后端
npm run dev:server

# 终端 2 - 启动前端
npm run dev:frontend
```

浏览器打开 `http://localhost:5173` 即可使用。

> 或者一条命令同时启动：`npm run dev`

### 命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前端 + 后端 |
| `npm run dev:frontend` | 仅启动 Vite 前端 |
| `npm run dev:server` | 仅启动 Express 后端 |
| `npm run build` | 生产构建（前后端） |
| `npm run start` | 生产模式启动后端 |
| `npm run lint` | TypeScript 类型检查 |

---

## 怎么用

1. 打开 `http://localhost:5173` → 看到拖入区域
2. **选择照片**（点击或拖入）
3. 等待分析完成（进度条实时更新）
4. **滑动** 浏览结果：
   - `← 左滑` 或 `W 键` → 不要这张
   - `→ 右滑` 或 `Q 键` → 要这张
   - `↑ 上滑` 或 `E 键` → 再看看
   - 方向键 → 前后翻页
5. **导出** 选中照片，浏览器自动下载 zip

---

## 评分算法

```
综合分（0-100）= 模糊排名 × 0.30 + 曝光得分 × 0.20 + 人像质量 × 0.25 + 表情得分 × 0.15
```

### 一票否决规则

| 条件 | 阈值 | 方法 |
|------|------|------|
| 闭眼 | EAR < 0.2 | 眼部特征点纵横比 |
| 张嘴过大 | MAR > 0.6 | 嘴部特征点纵横比 |
| 严重歪斜 | 头部 roll > 15° | 68 点空间几何 |
| 人脸裁切 | bbox 越界 | 检测框位置 |
| 人脸过小 | 占画面 < 5% | 检测框面积比例 |
| 过暗 | 亮度 < 40 | HSV V 通道 |
| 过曝 | 亮度 > 240 | HSV V 通道 |
| 模糊 | 拉普拉斯方差 < 30 | 拉普拉斯核 |

---

## 技术栈

| 层 | 选型 | 用途 |
|----|------|------|
| 前端 | React 18 + TypeScript 5.5 | 组件化 UI |
| 构建 | Vite 5 | HMR 热更新 + 代理转发 |
| 后端 | Express 4 | REST API + 文件上传 |
| 图片处理 | sharp 0.33 | 缩略图生成、中等尺寸裁切 |
| 人脸检测 | face-api.js (`@vladmandic/face-api`) | 68 特征点 + 7 类表情 |
| 连拍去重 | imghash 1.1 | 感知哈希指纹 |
| Worker 通信 | Comlink 4.4 | 类型安全的 Worker RPC |

---

## 为什么选 face-api.js

对比了 4 种主流离线人脸方案：

| 维度 | `@vladmandic/face-api` | MediaPipe Face Mesh | BlazeFace | OpenCV.js |
|------|--------------------------|------------------------|-------------|-------------|
| **特征点数** | 68 点（眼 6 + 嘴 20 + 轮廓） | 468/478 点（3D） | 仅 6 点 | 无特征点 |
| **闭眼检测** | EAR < 0.2 | 眼 + 虹膜跟踪 | 无眼睑点 | - |
| **张嘴检测** | MAR > 0.6 | 3D 口部 | 无嘴唇点 | - |
| **微笑检测** | 内置表情模型（7 类） | 52 blendshape | - | - |
| **头姿角度** | 68 点 PnP 求解 | 3D 变换矩阵 | - | - |
| **模型体积** | **~580 KB** | 6-8 MB | 很小 | 6-10 MB |
| **推理速度** | 30-50ms/张 (CPU) | 15-30ms/张 (CPU) | 快 | 慢 |
| **维护状态** | 活跃（2024-2025） | Google 维护 | - | - |

**选择理由**：580KB 搞定全部（检测 + 特征点 + 表情），68 点完全够用，微笑检测内置。MediaPipe 的 468 点对选片场景属于过度设计。

> 原版 `face-api.js`（`justadudewhohacks`）已 6 年未维护，必须使用活跃 fork **`@vladmandic/face-api`**（v1.7+）。

---

## 性能指标

| 操作 | 目标 | 手段 |
|------|------|------|
| 500 张缩略图生成 | < 15s | sharp 批处理 |
| 500 张人脸检测 | < 120s | 服务端批量 + GPU |
| 单张质量分析 | < 100ms | 4 Worker 线程池 |
| 浏览滑动切换 | < 16ms（60fps） | CSS transform GPU 合成 |

---

## 许可

MIT

---

<p align="center">为那个每次拍 500 张照片的人而做，把时间留给修图，而不是找图</p>
