# PhotoForYou 🎀

> AI 智能选片工具 —— 500 张照片扔进去，30 秒挑出最值得修的那几张。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-31.x-9feaf9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📸 它能做什么

把文件夹拖进去，AI 自动分析每一张照片 —— 找出模糊的、闭眼的、光线烂的、连拍重复的 —— 用 **Tinder 式滑动手势**呈现最好的那批。左滑不要，右滑留下，上滑再看看。

**把一小时选片变成一分钟。**

| 功能 | 原理 |
|------|------|
| 🚫 **模糊检测** | 拉普拉斯方差分析，批次内相对排名 |
| 👀 **人脸质量** | 人脸检测 + 68 特征点 + EAR（眼睛）+ MAR（嘴巴）+ 头姿 + 微笑识别 |
| 🌗 **曝光检测** | HSV 亮度分析，批次内相对排名（不设死阈值） |
| 🔄 **连拍去重** | pHash 感知哈希聚类 + SSIM 结构相似度验证 |
| 📊 **综合评分** | 0-100 分，五维度加权 |
| 👆 **滑动手势** | 左滑筛除 / 右滑精选 / 上滑待定，也支持键盘 Q/W/E |
| 📤 **智能导出** | 一键导出，自动按日期序号命名 |

---

## 🚀 快速开始

### 环境要求
- **macOS 11+** 或 **Windows 10+**
- **Node.js 20+**

```bash
git clone https://github.com/yourusername/PhotoForYou.git
cd PhotoForYou
npm install
npm run electron:dev
```

> 💡 如果 Electron 下载慢，项目已配置 `.npmrc` 使用 npmmirror 镜像加速。

### 命令

| 命令 | 说明 |
|------|------|
| `npm run electron:dev` | 启动开发模式（Vite 热更新 + Electron） |
| `npm run lint` | TypeScript 类型检查 |
| `npm run build` | 生产构建 |
| `npm run electron:build` | 构建 + 打包 .dmg / .exe |

---

## 🎮 怎么用

1. **打开** App → 看到拖入区域
2. **拖入** 照片文件夹（或点击选择）
3. **等待** 约 60 秒，AI 分析每一张（进度条实时更新）
4. **滑动** 浏览精选结果：
   - `← 左滑` 或 `W 键` → 不要这张
   - `→ 右滑` 或 `Q 键` → 要这张
   - `↑ 上滑` 或 `E 键` → 再看看
   - 方向键 → 前后翻页
5. **导出** 精选照片，一键搞定

---

## 🏗️ 架构

```
PhotoForYou/
├── Electron 主进程
│   ├── 文件 I/O（原生 dialog）
│   ├── sharp（缩略图生成，比 Canvas 快 10 倍）
│   └── imghash（pHash 连拍聚类）
│
├── React 渲染进程
│   ├── DropZone → 拖入照片
│   ├── PhotoViewer → 滑动浏览（60fps CSS transform）
│   ├── ScorePanel → 五维度评分条
│   ├── ProgressBar → 实时分析进度
│   └── ExportPanel → 导出统计 & 操作
│
├── Web Workers（4 线程池，Comlink 通信）
│   ├── 拉普拉斯方差（模糊检测）
│   ├── HSV 亮度（曝光检测）
│   ├── 人脸质量：EAR / MAR / 头姿 / 微笑（face-api.js 68 特征点）
│   └── 批次内相对排名引擎
│
└── local-file:// 协议 → 本地图片无 CORS 问题
```

### 核心设计决策

| 决策 | 原因 |
|------|------|
| **不上云** | 隐私第一、离线可用、零成本 |
| **4 Worker 线程** | 分析不阻塞 UI，保持 60fps |
| **批次内排名** | 「模糊」在晴天和夜晚含义不同，跟同一批比而非和全宇宙比 |
| **Comlink** | Worker 通信类型安全，不用手写 postMessage |
| **pHash + SSIM** | 快速感知哈希做初筛，结构相似度做精确验证 |
| **face-api.js** | 最适合 Electron 的人脸方案（详见下文） |

---

## 📊 评分算法

```
综合分（0-100）= 模糊排名 × 0.30 + 曝光得分 × 0.20 + 人像质量 × 0.25 + 表情得分 × 0.15 + 美学分 × 0.10
```

### 一票否决规则（纯几何量，不受光线场景影响）

| 条件 | 阈值 | 方法 |
|------|------|------|
| 👁 闭眼 | EAR < 0.18 | 眼部特征点纵横比 |
| 👄 张嘴过大 | MAR > 0.7 | 嘴部特征点纵横比 |
| 🔄 严重歪斜 | 头部 roll > 20° | 68 点空间几何 |
| ✂ 人脸裁切 | 距画面边缘 < 5% | 检测框位置比例 |
| 🔍 人脸过小 | 占画面 < 1% | 检测框面积比例 |

---

## 🛠️ 技术栈

| 层 | 选型 | 用途 |
|----|------|------|
| 桌面框架 | Electron 31 | macOS / Windows 跨平台 |
| UI | React 18 + TypeScript 5.5 | 组件化开发 |
| 构建 | Vite 5 | HMR 热更新 + 优化打包 |
| 图片处理 | sharp 0.33 | 缩略图生成 |
| 图像分析 | OpenCV.js 4.9 (WASM) | 拉普拉斯、直方图、SSIM |
| 人脸检测 | face-api.js (`@vladmandic/face-api`) | 68 特征点 + 7 类表情 |
| Worker 通信 | Comlink 4.4 | 类型安全的 Worker RPC |
| 连拍去重 | imghash 1.1 | 感知哈希指纹 |
| 美学评分 | NIMA ONNX（规划中） | 预训练美学模型 |

---

## 🤖 为什么选 face-api.js —— 人脸方案选型报告

对比了 4 种主流离线人脸方案：

| 维度 | `@vladmandic/face-api` 🥇 | MediaPipe Face Mesh 🥈 | BlazeFace ❌ | OpenCV.js ❌ |
|------|--------------------------|------------------------|-------------|-------------|
| **特征点数** | 68 点（眼 6 + 嘴 20 + 轮廓） | 468/478 点（3D） | 仅 6 点 | 无特征点 |
| **闭眼检测** | ✅ EAR < 0.18 | ✅ 眼 + 虹膜跟踪 | ❌ 无眼睑点 | ❌ |
| **张嘴检测** | ✅ MAR > 0.7 | ✅ 3D 口部 | ❌ 无嘴唇点 | ❌ |
| **微笑检测** | ✅ 内置表情模型（7 类） | ✅ 52 blendshape | ❌ | ❌ |
| **头姿角度** | ✅ 68 点 PnP 求解 | ✅ 3D 变换矩阵 | ❌ | ❌ |
| **模型体积** | **~580 KB** | 6-8 MB | 很小 | 6-10 MB |
| **推理速度** | 30-50ms/张 (CPU) | 15-30ms/张 (CPU) | 快 | 慢 |
| **Web Worker** | ✅ 简单 `loadFromDisk()` | ⚠️ WASM 路径配置复杂 | ✅ | ⚠️ |
| **Electron 打包** | ✅ 直接打包进 ASAR | ⚠️ WASM 路径地狱 | ✅ | ❌ 体积太大 |
| **维护状态** | ✅ 活跃（2024-2025） | ✅ Google 维护 | ✅ | ✅ |
| **npm** | `@vladmandic/face-api` | `@tensorflow-models/face-landmarks-detection` | 不适用 | 不适用 |

### 选择 face-api.js 的四个关键理由

1. **580KB 搞定全部** —— 人脸检测 + 68 特征点 + 7 类情绪识别（微笑）全在一个包，不需要检测模型和特征点模型分开整合
2. **Electron 集成零摩擦** —— `loadFromDisk()` 从 App 打包资源直接读模型权重文件，不涉及 MediaPipe 的 WASM 路径配置问题
3. **68 点完全够用** —— 眼部 6 点算 EAR、嘴部 20 点算 MAR、脸部轮廓算头姿。MediaPipe 的 468 点是给 AR 面具用的，对选片场景属于过度设计
4. **微笑检测内置** —— `faceExpressionNet` 直接输出 happy 概率 > 0.6 即为微笑，无需额外模型

> ⚠️ 原版 `face-api.js`（`justadudewhohacks`）已 6 年未维护，必须使用活跃 fork **`@vladmandic/face-api`**（v1.7+），支持现代 TFJS v4。

---

## ⚡ 性能指标

| 操作 | 目标 | 手段 |
|------|------|------|
| 500 张元数据扫描 | < 1s | 只读文件头 2KB |
| 500 张缩略图生成 | < 15s | sharp 8 线程并行 |
| 单张全部分析 | < 100ms | Worker + OpenCV WASM + face-api |
| 500 张全量分析 | < 90s | 4 Worker 线程池 |
| 浏览滑动切换 | < 16ms（60fps） | CSS transform GPU 合成 |
| 内存占用 | < 400MB | LRU 驱逐 + 缩略图优先 |

---

## 🔒 隐私

- ✅ **100% 离线** —— 不需要网络
- ✅ **零数据收集** —— 无埋点、无遥测、无服务器
- ✅ **全本地处理** —— 照片绝不离开你的电脑
- ✅ **不读 GPS** —— EXIF 位置信息不读取
- ✅ **无账号** —— 不需要登录、不需要云同步

---

## 🗺️ 路线图

| 版本 | 状态 | 内容 |
|------|------|------|
| **V1.0** | ✅ 已完成 | 导入、模糊/曝光检测、连拍去重、滑动复核、导出 |
| **V1.5** | 🚧 进行中 | face-api.js 人脸检测（闭眼/张嘴/头姿/微笑）、可调阈值 |
| **V2.0** | 📋 规划 | NIMA 美学评分、个人偏好学习、批量对比模式 |

---

## 📄 许可

MIT

---

<p align="center">为那个每次拍 500 张照片的人而做，把时间留给修图，而不是找图 💕</p>
