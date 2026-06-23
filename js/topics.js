/* ============================================================
   topics.js — AI 选题推荐引擎
   ============================================================ */

const Topics = {

  /** 缓存当前推荐结果，避免重复生成 */
  _cache: null,

  /** 推荐系统 prompt */
  buildSystemPrompt() {
    // 优先使用 Obsidian 知识库的已写方向，回退到硬编码
    const coveredList = (typeof ObsidianKB !== 'undefined' && ObsidianKB.hasArticles())
      ? ObsidianKB.buildCoveredList()
      : Config.KNOWLEDGE_BASE.covered;

    return `你是建水紫陶内容策划专家「老郭说宝」的选题助手。

老郭的知识体系：
${Config.KNOWLEDGE_BASE.zitao}

老郭的写作风格：
${Config.KNOWLEDGE_BASE.style}

老郭已经写过的方向（避免重复）：
${coveredList}

你的任务：每次推荐 10 个选题。

要求：
1. 覆盖三类：知识科普（knowledge）、器物赏析（appreciation）、市场观察（market）
2. 避免与已写过的方向重复
3. 每个选题必须有新角度，不要老生常谈
4. 优先推荐当下的热点方向（柴烧、白泥、新作者、市场变化）
5. 结合老郭知识体系中的具体知识点来策划

请严格按以下 JSON 格式返回，不要加 markdown 包裹，只返回 JSON 数组：
[
  {
    "title": "选题标题",
    "reason": "一句话推荐理由",
    "category": "knowledge|appreciation|market",
    "priority": "高|中|低",
    "angle": "建议的切入角度"
  }
]`;
  },

  /** 生成推荐选题 */
  async recommend(onChunk) {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) throw new Error('未配置 LLM API，请先在设置中添加');

    if (onChunk) onChunk('🧠 AI 正在策划选题...');

    let fullText = '';
    await LLM.chatStream(
      llmConfig,
      LLM.msgs(this.buildSystemPrompt(), '请推荐 10 个选题，尽量多样化，覆盖三个分类。'),
      chunk => { fullText += chunk; if (onChunk) onChunk(chunk); },
      { temperature: 0.9, max_tokens: 4096 }
    );

    const topics = LLM.parseJSON(fullText);
    this._cache = topics;
    return topics;
  },

  /** 基于灵感/关键词的定向推荐 */
  async recommendByInspiration(inspiration, onChunk) {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) throw new Error('未配置 LLM API');

    let fullText = '';
    await LLM.chatStream(
      llmConfig,
      LLM.msgs(
        this.buildSystemPrompt(),
        `用户输入了以下灵感/关键词：\n"${inspiration}"\n\n请基于这个方向推荐 6 个具体的选题。`
      ),
      chunk => { fullText += chunk; if (onChunk) onChunk(chunk); },
      { temperature: 0.8, max_tokens: 4096 }
    );

    const topics = LLM.parseJSON(fullText);
    return topics;
  },

  /** 获取缓存的推荐 */
  getCached() {
    return this._cache;
  },

  /** 清除缓存 */
  clearCache() {
    this._cache = null;
  },

  /** 分类中文名 */
  categoryLabel(cat) {
    const map = { knowledge: '知识科普', appreciation: '器物赏析', market: '市场观察' };
    return map[cat] || cat;
  },

  /** 优先级颜色 */
  priorityColor(p) {
    const map = { '高': '#C44536', '中': '#C9A227', '低': '#5A8F3C' };
    return map[p] || '#666';
  }
};
