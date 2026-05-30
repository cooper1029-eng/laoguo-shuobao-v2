/* ============================================================
   config.js — API 配置管理 + 知识库内嵌数据
   ============================================================ */

const Config = {

  // ======================== 知识库内嵌 ========================

  KNOWLEDGE_BASE: {
    /** 建水紫陶知识体系（完整） */
    zitao: `# 建水紫陶知识体系

## 泥料
- **来源**：云南建水五彩山，五种颜色泥土（红、黄、青、紫、白）
- **含铁量**：20%~50%（远高于紫砂，决定最终呈色）
- **目数**：200~325目（比紫砂细密，紫砂通常40~80目）
- **收缩比**：17%~30%（成品率低，大件更甚）
- **白陶泥**：五彩山白泥，常用于装饰镶边，收缩比与紫泥不同，工艺要求高

## 工艺特色
- **阴刻阳填**：在泥坯上刻出图案→填入不同颜色色泥→刮平→烧制。烧成后颜色与胎体融为一体
- **无釉磨光**：建水陶不上釉，烧成后用磨具由粗到细逐级抛光，最终呈现镜面光泽。不是釉，是磨出来的
- **火皮**：烧制时柴灰落在坯体表面形成的焦黑粗糙层，磨光时磨掉
- **刻填工序**：设计→描绘→刻镂→填泥→精修→干燥→烧制→打磨

## 烧制
- **温度**：1150℃~1300℃
- **还原焰**：缺氧环境烧制，呈沉稳黑色（含铁高+还原气氛=黑）
- **氧化焰**：富氧环境烧制，呈红色/紫红色
- **烧制方式**：传统龙窑、现代气窑/电窑，烧制方式影响最终颜色和质感

## 科学依据（数据支撑）
- 上海交大研究、A类论文
- 电子显微镜下的单气孔结构：透气不透水
- 单气孔对普洱茶陈化的湿度调节作用

## 知名作者
赵航、何永鑫、范程柏、徐长文、杜俊楠、不二陶·王霁、田波、蒋雨田、邹科、谭知凡、马成林、陈绍康、普忠华、孔凡庚、陈七铭、三金、余丽芬、向炳成

## 与其他陶器的区别
- **建水紫陶 vs 紫砂**：原料不同（泥料vs矿料）、工艺不同（阴刻阳填vs拍打成型）、表面处理不同（无釉磨光vs烧制本色）
- **四大名陶**：江苏宜兴紫砂、云南建水紫陶、广西钦州坭兴陶、四川荣昌陶

## 市场
- 直播带货为主流销售渠道
- 价格体系宽泛：几百元到数万元不等
- 匠人品牌效应明显`,

    /** 写作风格指南（完整） */
    style: `## 人物定位
- **身份**：建水紫陶行业从业者、直播带货主播、文化传播者
- **口吻**：懂行但不装、接地气的行家，从一线经验出发，专业自信但不傲慢
- **对读者的称呼**："您"为主，偶尔用"你"，保持尊重且亲切

## 开篇钩子（4选1）
- **提问式**（40%）："建水陶价格虚高，名家大师的名头都是自封的！"
- **悬念式**（30%）："今天偶然被三把建水陶的白泥壶给折服了"
- **引用式**（20%）："碧叶喜翻风，红英宜照日"
- **故事式**（10%）："时间来到1955年3月..."

## 正文推进方式
- 层层递进、正反对比、故事牵引、分点论述、问题串讲

## 论证手法
- 权威背书（上海交大研究）、具体数据（目数/含铁量/收缩比/温度）、类比打比方（菜刀vs水果刀）、真实人名（每篇必有具体匠人）、亲身经验

## 文化深度植入
每篇植入一个文化概念或历史典故：侘寂、锦灰堆、仁者乐山智者乐水、宋徽宗、苏轼、曹操等

## 固定收尾
"我是老郭，讲述有宝物的故事，和有故事的宝物。下期见！"

## 语言特征
- 短段落、短句子，口播感强
- 大量设问："为什么？因为……"
- 口语化插入语："我跟你说""您想想""说得直白一点"
- 高频过渡词："说白了""说白了就是"
- 禁止使用破折号（——），用逗号、冒号或直接分层叙述替代

## 价值观
- 反对玄学，用科学和数据说话
- 不拉踩紫砂，承认各有优势
- 尊重匠人，认真分析每位作者
- 理性消费观，不鼓励冲动消费
- 文化传承，强调建水陶的文化价值`,

    /** 已写过的文章方向（浓缩版，基于老郭合集） */
    covered: `## 作品赏析类（已写约40篇）
赵航作品（八方杯、般若梵净组壶、麻雀、侧把山水、白泥提梁荷花、方壶王维、一鹤清影、重工花鸟）
普忠华（宋画、花鸟人生、多道柴烧）
杜俊楠（小宇宙、进化之路）
徐长文（叛逆跨界、书法刻填、设计哲学）
向炳成（哈尼壶、民族风）
孔凡庚（荔枝提梁壶）
范程柏（古法柴烧、提梁心经）
陈七铭（春秋生肖、青铜图腾）
三金（拙朴美学）
余丽芬（爱莲说、花鸟性价比）
王霁/不二陶（柴烧侘寂）

## 工艺科普类（约15篇）
无釉磨光、柴烧本源、气窑电窑、乐烧、窑变、烧制方式、颜色与泥料、灵魂、白泥提梁、残帖vs锦灰堆、金石元素

## 科普辟谣（约10篇）
含铁量辟谣、重金属安全、单气孔普洱茶、压手感、三个问题、科学依据、牛角尖、开壶、手工vs机制、无痕修复

## 紫陶vs紫砂（5篇）
跨界对比（两版）、区别、抛开现象看本质、新手选择

## 文化历史（约10篇）
600年云南青花、3500年进化史、四大名陶、一品千年、建水八家斗、宋绢画再现、青花重生

## 行业评论（约10篇）
直播带货出路、三年心得、陈七铭生存之道、价格体系、价值构成、消费观、踩坑经验、套路解密

## 实用指南（约8篇）
选壶形状、盖碗vs壶、绿茶冲泡、茶叶罐、茶壶起源、清供、残荷、从壶学诗词

## 常用文化典故
赤壁赋、宋徽宗工笔花鸟、贾岛推敲、王维诗、李清照如梦令、苏轼（食荔枝/水调歌头/治平帖/渡海帖）、赵孟頫、董其昌、石涛、侘寂（宋禅宗）`
  },

  // ======================== API 配置管理 ========================

  STORAGE_KEY: 'laoguo_v2_configs',

  /** 默认预设 */
  DEFAULTS: [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'llm',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      key: '',
      isDefault: true
    },
    {
      id: 'local-vision',
      name: '本地视觉',
      type: 'vision',
      baseUrl: 'http://127.0.0.1:8000',
      model: 'Qwen3.5-4B-MLX-4bit',
      key: '123456',    // oMLX 默认 API Key，可在设置中修改
      isDefault: true
    }
  ],

  /** 加载所有配置 */
  loadAll() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    }
    // 首次：写入默认
    const defaults = JSON.parse(JSON.stringify(this.DEFAULTS));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  },

  /** 保存所有配置 */
  saveAll(configs) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
  },

  /** 获取指定类型的默认配置 */
  getDefault(type) {
    const all = this.loadAll();
    return all.find(c => c.type === type && c.isDefault) || all.find(c => c.type === type) || null;
  },

  /** 获取指定 ID 的配置 */
  get(id) {
    const all = this.loadAll();
    return all.find(c => c.id === id) || null;
  },

  /** 添加/更新配置 */
  upsert(config) {
    const all = this.loadAll();
    const idx = all.findIndex(c => c.id === config.id);
    if (idx >= 0) {
      all[idx] = config;
    } else {
      all.push(config);
    }
    this.saveAll(all);
    return config;
  },

  /** 删除配置 */
  remove(id) {
    let all = this.loadAll();
    all = all.filter(c => c.id !== id);
    this.saveAll(all);
  },

  /** 设为默认 */
  setDefault(id) {
    const all = this.loadAll();
    const target = all.find(c => c.id === id);
    if (!target) return;
    all.forEach(c => { if (c.type === target.type) c.isDefault = false; });
    target.isDefault = true;
    this.saveAll(all);
  },

  /** 构建 LLM 请求头 */
  buildHeaders(config) {
    const headers = { 'Content-Type': 'application/json' };
    if (config.key) headers['Authorization'] = `Bearer ${config.key}`;
    return headers;
  },

  /** 构建 LLM 请求体（OpenAI 兼容格式） */
  buildChatBody(config, messages, options = {}) {
    return {
      model: config.model,
      messages,
      stream: options.stream ?? true,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.max_tokens ?? 4096
    };
  }
};
