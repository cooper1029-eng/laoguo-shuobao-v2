/* ============================================================
   obsidian-kb.js — Obsidian 知识库集成模块
   功能：让用户选取 Obsidian 文件夹，扫描 .md 文章，
   动态生成「已写方向」和「Few-shot 示例」，替代硬编码的 covered
   ============================================================ */

const ObsidianKB = {
  // 已连接的文件夹列表
  // 每个元素: { name, handle: FileSystemDirectoryHandle, articles: [], error: '' }
  folders: [],

  // IndexedDB 配置
  DB_NAME: 'LaoguoObsidianKB',
  DB_VERSION: 1,
  STORE_NAME: 'folderHandles',

  /** 应用启动时调用：恢复已存储的文件夹句柄并重新扫描 */
  async init() {
    try {
      const handles = await this._loadHandlesFromDB();
      if (handles.length === 0) return;

      for (const handle of handles) {
        try {
          // 请求读取权限（用户可能需要重新授权）
          const opts = { mode: 'read' };
          const perm = await handle.queryPermission(opts);
          if (perm !== 'granted') {
            const result = await handle.requestPermission(opts);
            if (result !== 'granted') {
              this.folders.push({ name: handle.name, handle, articles: [], error: '⚠️ 未授予读取权限' });
              continue;
            }
          }
          const articles = await this._scanFolder(handle, handle.name);
          this.folders.push({ name: handle.name, handle, articles, error: '' });
        } catch (e) {
          this.folders.push({ name: handle.name, handle, articles: [], error: `❌ ${e.message}` });
        }
      }
      console.log(`[ObsidianKB] 已恢复 ${this.folders.length} 个文件夹，共 ${this.getTotalArticles()} 篇文章`);
    } catch (e) {
      console.warn('[ObsidianKB] 初始化失败（首次使用或浏览器不支持）：', e.message);
    }
  },

  /** 添加一个新文件夹 */
  async addFolder() {
    // 检查浏览器是否支持
    if (!window.showDirectoryPicker) {
      throw new Error('当前浏览器不支持文件夹选择。请使用 Chrome / Edge / Opera。');
    }

    const handle = await window.showDirectoryPicker();
    // 检查是否已添加
    if (this.folders.some(f => f.name === handle.name)) {
      throw new Error(`「${handle.name}」已在知识库中`);
    }

    const articles = await this._scanFolder(handle, handle.name);
    this.folders.push({ name: handle.name, handle, articles, error: '' });

    // 保存句柄到 IndexedDB
    await this._saveHandlesToDB();

    console.log(`[ObsidianKB] 已添加文件夹「${handle.name}」，${articles.length} 篇文章`);
    return { name: handle.name, count: articles.length };
  },

  /** 移除一个文件夹（按索引） */
  async removeFolder(index) {
    if (index < 0 || index >= this.folders.length) return;
    this.folders.splice(index, 1);
    await this._saveHandlesToDB();
  },

  /** 重新扫描所有文件夹（获取最新文件列表） */
  async rescanAll() {
    for (const folder of this.folders) {
      try {
        if (folder.handle) {
          folder.articles = await this._scanFolder(folder.handle, folder.name);
          folder.error = '';
        }
      } catch (e) {
        folder.error = `❌ ${e.message}`;
      }
    }
    await this._saveHandlesToDB();
  },

  /** 获取所有文章总数 */
  getTotalArticles() {
    return this.folders.reduce((sum, f) => sum + f.articles.length, 0);
  },

  /** 获取状态文本 */
  getStatus() {
    const total = this.getTotalArticles();
    const folderCount = this.folders.length;
    if (total === 0) return '';
    return `📖 ${folderCount} 个文件夹 · ${total} 篇文章`;
  },

  /** 获取每个文件夹的详细状态 */
  getFolderStatuses() {
    return this.folders.map(f => ({
      name: f.name,
      count: f.articles.length,
      error: f.error
    }));
  },

  /** 生成「已写方向」文本 — 替代 Config.KNOWLEDGE_BASE.covered */
  buildCoveredList() {
    const all = this._getAllArticles();
    if (all.length === 0) return null;

    // 按分类归类
    const byCategory = {};
    for (const art of all) {
      const cat = art.category || '未分类';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(art.title || '未命名');
    }

    const lines = [];
    for (const [cat, titles] of Object.entries(byCategory)) {
      lines.push(`## ${cat}（${titles.length} 篇）`);
      // 每行最多列 5 个标题，避免 prompt 过长
      const chunks = [];
      for (let i = 0; i < titles.length; i += 5) {
        chunks.push(titles.slice(i, i + 5).join('、'));
      }
      for (const chunk of chunks) {
        lines.push(chunk);
      }
    }
    return lines.join('\n');
  },

  /** 获取 few-shot 示例文章（用于注入 prompt） */
  getFewShotArticles(count = 4) {
    const all = this._getAllArticles();
    if (all.length === 0) return null;

    // 尽量选不同分类的最新文章，覆盖风格多样性
    const categories = [...new Set(all.map(a => a.category || '未分类'))];
    const samples = [];
    const usedCats = new Set();

    // 先每个分类取一篇
    for (const cat of categories) {
      if (samples.length >= count) break;
      const match = all.find(a => (a.category || '未分类') === cat && !usedCats.has(a.title));
      if (match) {
        usedCats.add(match.title);
        samples.push(match);
      }
    }
    // 如果还不够，从最新文章补
    if (samples.length < count) {
      for (const a of all) {
        if (samples.length >= count) break;
        if (!usedCats.has(a.title)) {
          usedCats.add(a.title);
          samples.push(a);
        }
      }
    }

    return samples.map((art, i) => {
      const content = art.content || '';
      return `【归档示例${i + 1}】${art.title ? `标题：${art.title}` : ''}\n正文：\n${content.substring(0, 2000)}`;
    }).join('\n\n');
  },

  /** 检查是否有可用文章 */
  hasArticles() {
    return this.getTotalArticles() > 0;
  },

  /** 外部添加一篇文章到匹配的知识库文件夹（用于保存后自动加入） */
  addExternalArticle(folderName, article) {
    // 按文件夹名匹配：找到名字包含 folderName 的，或 folderName 包含其名字的
    for (const f of this.folders) {
      if (f.name === folderName || folderName.includes(f.name) || f.name.includes(folderName)) {
        f.articles.unshift({
          title: article.title || '未命名',
          category: article.category || '未分类',
          content: article.content || '',
          path: f.name + '/' + (article.title || '未命名') + '.md',
          sortKey: new Date().toISOString().split('T')[0] + '_' + (article.title || '')
        });
        return true;
      }
    }
    return false;
  },

  // ==================== 内部方法 ====================

  /** 获取所有文件夹的文章平铺列表 */
  _getAllArticles() {
    const all = [];
    for (const f of this.folders) {
      for (const a of f.articles) {
        all.push(a);
      }
    }
    // 按文件名（时间）倒序 — Obsidian 文件名常含日期
    all.sort((a, b) => (b.sortKey || '') < (a.sortKey || '') ? 1 : -1);
    return all;
  },

  /** 递归扫描一个文件夹下的所有 .md 文件 */
  async _scanFolder(handle, rootName) {
    const articles = [];

    async function walk(dir, pathPrefix) {
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') {
          if (!entry.name.endsWith('.md')) continue;
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const parsed = ObsidianKB._parseMarkdown(text, entry.name);
            parsed.path = pathPrefix + '/' + entry.name;
            // 用文件名（含日期）作为排序依据
            parsed.sortKey = entry.name;
            articles.push(parsed);
          } catch (e) {
            console.warn(`[ObsidianKB] 读取失败: ${entry.name}`, e.message);
          }
        } else if (entry.kind === 'directory') {
          // 跳过 .obsidian 等隐藏目录
          if (entry.name.startsWith('.')) continue;
          await walk(entry, pathPrefix + '/' + entry.name);
        }
      }
    }

    await walk(handle, rootName);
    return articles;
  },

  /** 解析 .md 文件：提取 frontmatter + 正文 */
  _parseMarkdown(text, fileName) {
    const result = {
      title: fileName.replace(/\.md$/, ''),
      category: '未分类',
      content: text,
      tags: []
    };

    // 解析 YAML frontmatter（--- 包围）
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (fmMatch) {
      const yamlBlock = fmMatch[1];
      // 简单解析常用字段（不用完整 YAML 解析器）
      const titleMatch = yamlBlock.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) result.title = titleMatch[1].trim();

      const categoryMatch = yamlBlock.match(/^category:\s*["']?(.+?)["']?\s*$/m);
      if (categoryMatch) result.category = categoryMatch[1].trim();

      // tags: 支持 - tag1\n- tag2 或 [tag1, tag2] 格式
      const tagLines = yamlBlock.match(/^\s*-\s*(.+?)\s*$/gm);
      if (tagLines) {
        result.tags = tagLines.map(l => l.replace(/^\s*-\s*/, '').trim());
      }

      // 去掉 frontmatter 后的正文
      result.content = text.slice(fmMatch[0].length).trim();
    }

    return result;
  },

  // ==================== IndexedDB 存储句柄 ====================

  /** 把文件夹句柄列表存到 IndexedDB */
  async _saveHandlesToDB() {
    try {
      const db = await this._openDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.clear(); // 先清空
      for (const f of this.folders) {
        if (f.handle) {
          store.put(f.handle, f.name);
        }
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn('[ObsidianKB] 保存句柄失败:', e.message);
    }
  },

  /** 从 IndexedDB 加载已存储的文件夹句柄 */
  async _loadHandlesFromDB() {
    try {
      const db = await this._openDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const handles = [];
      return new Promise((resolve, reject) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            handles.push(cursor.value);
            cursor.continue();
          } else {
            resolve(handles);
          }
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch (e) {
      return [];
    }
  },

  /** 打开 IndexedDB */
  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};
