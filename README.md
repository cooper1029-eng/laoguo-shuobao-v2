# 老郭说宝 — 创作工作台 V2

纯前端网页，专注建水紫陶，7步完成一篇文章。支持电脑和手机使用。

## 快速开始

1. **打开页面**：双击 `index.html`（电脑），或通过下方部署地址访问（手机）
2. **配 API Key**：点右上角 ⚙️，填入 DeepSeek API Key
3. **推荐选题**：点「AI 推荐选题」→ AI 会基于你的知识库策划选题
4. **跟着流程走**：选题 → 识图 → 正文 → 修改 → 标题 → 配图 → 导出

## 手机使用

### 方式一：GitHub Pages（推荐）

部署后可通过公网地址在手机上使用：

1. 推送代码到 GitHub：`git push origin master`
2. 进入仓库 Settings → Pages → 选择 `master` 分支 → 保存
3. 手机浏览器打开 `https://<用户名>.github.io/<仓库名>/`

### 方式二：本地测试

电脑和手机连同一 WiFi：

```bash
cd 老郭网页版V2
python3 -m http.server 8080
```

手机浏览器打开 `http://<电脑IP>:8080`

### 添加到主屏幕（PWA）

手机 Chrome/Edge 浏览器打开后，点击「添加到主屏幕」，可以像 App 一样使用。

## 识图功能

默认使用小米 mimo-v2.5 云端视觉模型识图。首次使用需在 ⚙️ 设置中配置视觉 API Key。

## Obsidian 知识库同步

### 电脑端（Chrome/Edge）

1. ⚙️ 设置 → Obsidian 知识库 → 添加文件夹
2. 选择你的 Obsidian vault 中的 `工作/老郭说宝` 文件夹
3. 之后自动读取归档文章，生成新文章后自动写回

### 手机端（GitHub 同步）

1. ⚙️ 设置 → Obsidian 知识库 → GitHub 同步
2. 填入：GitHub Token（需要 repo 权限）、仓库名（如 `guoxiang/obsidian-vault`）、文件路径（如 `工作/老郭说宝/kb-covered.md`）
3. 点「测试连接」确认成功

原理：手机通过 GitHub API 读写 vault 中的文件，Obsidian 的 Git 插件会自动同步到本地。

## 文件结构

```
老郭网页版V2/
├── index.html              ← 主页面
├── manifest.json           ← PWA 配置
├── sw.js                   ← Service Worker（缓存加速）
├── icon-192.png            ← App 图标
├── icon-512.png            ← App 图标
├── css/style.css           ← 样式（陶土色系 + 响应式）
├── js/
│   ├── config.js           ← API 配置 + 知识库数据
│   ├── llm.js              ← LLM 调用（流式输出）
│   ├── vision.js           ← 图片识别（云端 + 本地）
│   ├── topics.js           ← AI 选题推荐
│   ├── obsidian-kb.js      ← Obsidian 知识库集成
│   └── app.js              ← 7步工作流 + 全部界面
├── proxy/
│   └── vision_proxy.py     ← 本地视觉代理（可选）
└── README.md
```

## 7步流程

```
① 选题 → ② 识图 → ③ 正文 → ④ 修改 → ⑤ 标题 → ⑥ 配图 → ⑦ 导出
```

每步做完才能进下一步，不会乱。
