/* ============================================================
   app.js — 7步工作流引擎 + 全部UI
   ============================================================ */

const App = {
  // ====================== 状态 ======================
  state: {
    step: 1,
    // 步骤1：选题
    topics: [],
    selectedTopic: null,
    inspiration: '',
    // 步骤2：识图
    images: [],
    imageDesc: '',
    // 步骤3：正文
    article: '',
    generatingArticle: false,
    // 步骤4：修改
    articleEdited: '',
    // 步骤5：标题
    titles: [],
    selectedTitle: '',
    // 步骤6：配图
    imagePrompts: [],
    promptChecked: [],        // 每个配图是否被勾选（用于单独重生成）
    promptRefineText: '',     // 用户优化配图的输入文本
    // 步骤7：导出
    finalOutput: ''
  },

  STEPS: [
    { n: 1, icon: '📋', label: '选题' },
    { n: 2, icon: '📷', label: '识图' },
    { n: 3, icon: '✍️', label: '正文' },
    { n: 4, icon: '🔧', label: '修改' },
    { n: 5, icon: '🏷️', label: '标题' },
    { n: 6, icon: '🎨', label: '配图' },
    { n: 7, icon: '📥', label: '导出' }
  ],

  // ====================== 初始化 ======================
  init() {
    this.render();
    this.bindEvents();
    this.renderStep();
    this.loadInspirationDraft();
    this.loadDraft(); // 恢复上一次的工作进度
    // 初始化 Obsidian 知识库（异步，不影响界面渲染）
    ObsidianKB.init().then(() => {
      // 如果有文章，在状态栏显示提示
      if (ObsidianKB.hasArticles()) {
        this.showStatus('📖 知识库已加载：' + ObsidianKB.getStatus(), 'success');
      }
      // 更新设置面板中的知识库状态（如果已打开）
      const panel = document.getElementById('settingsPanel');
      if (panel && !panel.classList.contains('hidden')) {
        this.renderSettings();
      }
    });
  },

  // ====================== UI 骨架 ======================
  render() {
    const root = document.getElementById('app');
    root.innerHTML = `
      <!-- 顶部 Header -->
      <header class="header">
        <div class="header-top">
          <h1>🏺 老郭说宝</h1>
          <span class="header-badge">文章创作工作台</span>
          <button class="btn btn-sm btn-secondary" onclick="App.toggleSettings(event)" style="margin-left:auto;" title="API 设置">⚙️</button>
        </div>
        <p class="subtitle">专注建水紫陶 · 7步出文 · AI驱动选题</p>
      </header>

      <!-- 状态消息 -->
      <div id="statusMessage" class="status hidden"></div>

      <!-- 步骤条 -->
      <nav class="step-bar" id="stepBar"></nav>

      <!-- 主内容区 -->
      <main class="main-content" id="mainContent"></main>

      <!-- 底部栏 -->
      <footer class="step-footer" id="stepFooter">
        <button class="btn btn-secondary" id="btnPrev" onclick="App.prevStep()">← 上一步</button>
        <span class="step-hint" id="stepHint"></span>
        <button class="btn btn-primary" id="btnNext" onclick="App.nextStep()">下一步 →</button>
      </footer>

      <!-- 设置面板（浮层） -->
      <div id="settingsPanel" class="settings-overlay hidden" onclick="App.toggleSettings(event)">
        <div class="settings-drawer" onclick="event.stopPropagation()">
          <div class="settings-header">
            <h2>⚙️ API 设置</h2>
            <button class="btn-close" onclick="App.toggleSettings()">✕</button>
          </div>
          <div class="settings-body" id="settingsBody"></div>
        </div>
      </div>

      <!-- 导出预览模态框 -->
      <div id="exportModal" class="modal hidden">
        <div class="modal-overlay" onclick="App.closeModal('exportModal')"></div>
        <div class="modal-content modal-large">
          <div class="modal-header">
            <h2>📝 文章预览</h2>
            <button class="modal-close" onclick="App.closeModal('exportModal')">✕</button>
          </div>
          <div class="modal-body" id="exportBody"></div>
          <div class="modal-footer">
            <button class="btn btn-success" onclick="App.saveToObsidian()">📝 保存到 Obsidian</button>
            <button class="btn btn-secondary" onclick="App.downloadMarkdown()">📥 下载 .md 文件</button>
            <button class="btn btn-secondary" onclick="App.copyArticle()">📋 复制全文</button>
            <button class="btn btn-secondary" onclick="App.closeModal('exportModal')">关闭</button>
          </div>
        </div>
      </div>
    `;
  },

  // ====================== 步骤条渲染 ======================
  renderStepBar() {
    const bar = document.getElementById('stepBar');
    bar.innerHTML = this.STEPS.map(s => {
      const isActive = s.n === this.state.step;
      const isDone = s.n < this.state.step;
      return `
        <div class="step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
             onclick="${isDone ? `App.goToStep(${s.n})` : ''}"
             title="${isDone ? '点击返回' : ''}">
          <div class="step-circle">${isDone ? '✓' : s.icon}</div>
          <div class="step-label">${s.label}</div>
        </div>
        ${s.n < 7 ? '<div class="step-connector ' + (isDone ? 'done' : '') + '"></div>' : ''}
      `;
    }).join('');
  },

  // ====================== 步骤导航 ======================
  goToStep(n) {
    if (n < 1 || n > 7) return;
    // 回退允许，前进需要验证
    if (n > this.state.step && !this.canProceed()) return;
    this.state.step = n;
    this.renderStepBar();
    this.renderStep();
    this.updateFooter();
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  nextStep() {
    if (!this.canProceed()) return;
    if (this.state.step < 7) {
      this.goToStep(this.state.step + 1);
    } else {
      // 第7步"完成"：保存历史 + 回到首页
      this.saveToHistory();
      this.state.step = 1;
      // 保留已选的选题和灵感，方便继续写下一篇
      // 但清空文章正文、标题、配图等
      this.state.article = '';
      this.state.articleEdited = '';
      this.state.imageDesc = '';
      this.state.titles = [];
      this.state.selectedTitle = '';
      this.state.imagePrompts = [];
      this.state.finalOutput = '';
      this.renderStepBar();
      this.renderStep();
      this.updateFooter();
      this.showStatus('✅ 文章已保存到历史记录', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  prevStep() {
    if (this.state.step > 1) {
      this.goToStep(this.state.step - 1);
    }
  },

  canProceed() {
    // 各步骤的完成验证
    switch (this.state.step) {
      case 1: return !!this.state.selectedTopic || !!this.state.inspiration.trim();
      case 2: return true; // 识图可选
      case 3: return !!this.state.article && !this.state.generatingArticle;
      case 4: return !!this.state.articleEdited.trim();
      case 5: return !!this.state.selectedTitle;
      case 6: return this.state.imagePrompts.length > 0;
      case 7: return true;
      default: return false;
    }
  },

  updateFooter() {
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    const hint = document.getElementById('stepHint');

    btnPrev.style.visibility = this.state.step === 1 ? 'hidden' : 'visible';

    if (this.state.step === 7) {
      btnNext.textContent = '🎉 完成';
      btnNext.className = 'btn btn-success';
    } else {
      btnNext.textContent = '下一步 →';
      btnNext.className = 'btn btn-primary';
    }

    btnNext.disabled = !this.canProceed();

    // 状态提示
    const hints = {
      1: '选择一个选题或输入灵感',
      2: '可跳过，直接下一步',
      3: '点击"生成正文"让 AI 写稿',
      4: '编辑修改正文，满意后下一步',
      5: '生成标题方案，选定一个',
      6: '生成配图提示词',
      7: '预览完整文章，下载 .md'
    };
    hint.textContent = hints[this.state.step] || '';
  },

  // ====================== 步骤渲染 ======================
  renderStep() {
    const map = {
      1: () => this.renderStep1(),
      2: () => this.renderStep2(),
      3: () => this.renderStep3(),
      4: () => this.renderStep4(),
      5: () => this.renderStep5(),
      6: () => this.renderStep6(),
      7: () => this.renderStep7()
    };
    (map[this.state.step] || (() => {}))();
    this.updateFooter();
  },

  // ---------- 步骤1：选题 ----------
  renderStep1() {
    const el = document.getElementById('mainContent');
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>📋 第一步：选题</h2>
          <p class="step-desc">点选题直接选，或自己输入灵感。不满意就「换一批」，AI 重新给你策划。</p>
        </div>

        <div class="topic-actions">
          <button class="btn btn-primary" onclick="App.recommendTopics()" id="btnRecommend">
            🤖 AI 推荐选题
          </button>
          <button class="btn btn-secondary" onclick="App.refreshTopics()" id="btnRefresh" style="display:none;">
            🔄 换一批
          </button>
          <div class="topic-filter" id="topicFilter">
            <button class="filter-btn active" data-cat="all" onclick="App.filterTopics('all')">全部</button>
            <button class="filter-btn" data-cat="knowledge" onclick="App.filterTopics('knowledge')">📚 知识</button>
            <button class="filter-btn" data-cat="appreciation" onclick="App.filterTopics('appreciation')">🎨 赏析</button>
            <button class="filter-btn" data-cat="market" onclick="App.filterTopics('market')">📈 市场</button>
          </div>
        </div>

        <div id="topicLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p id="topicLoadingText">🧠 AI 正在策划选题...</p>
        </div>

        <div id="topicGrid" class="topic-grid"></div>

        <div class="divider"><span>或者自己写灵感</span></div>

        <textarea id="inspirationInput"
          class="inspiration-input"
          placeholder="比如：最近收到一把普忠华的柴烧壶，工笔花鸟特别精细，想写写柴烧的不确定性之美..."
          oninput="App.state.inspiration=this.value;App.saveInspirationDraft();App.updateFooter()"
        >${this.state.inspiration}</textarea>

        <div class="selected-badge" id="selectedBadge" style="display:${this.state.selectedTopic ? 'flex' : 'none'}">
          📌 已选：<span id="selectedTopicText">${this.state.selectedTopic || ''}</span>
          <button class="btn-sm-text" onclick="App.clearSelectedTopic()">取消</button>
        </div>

        <!-- 历史记录 -->
        <div class="divider"><span>📜 历史文章</span></div>
        <div id="historyList" class="history-list"></div>
      </div>
    `;
    // 从 localStorage 恢复之前的选题
    if (this.state.topics.length === 0) {
      this.loadTopicsFromStorage();
    }
    if (this.state.topics.length > 0) {
      this.renderTopics(this.state.topics);
      document.getElementById('btnRefresh').style.display = 'inline-flex';
    } else {
      // 首次进入：显示引导，不自动调 API（等用户点击"AI推荐"）
      document.getElementById('topicGrid').innerHTML = `
        <div class="topic-welcome">
          <p>👋 首次使用？先点「AI 推荐选题」让 AI 给你策划，</p>
          <p>或者直接在下方的输入框里写你的灵感。</p>
          <p style="font-size:0.85em;color:var(--text-light);margin-top:8px;">
            ⚙️ 首次使用记得去右上角设置 API Key
          </p>
        </div>
      `;
    }
    this.renderHistory();
  },

  async recommendTopics() {
    this.showTopicLoading('🧠 AI 正在策划选题...');
    try {
      const topics = await Topics.recommend((chunk) => {
        if (chunk.includes('策划')) return;
        this.setTopicLoadingText(chunk);
      });
      this.state.topics = topics;
      this.renderTopics(topics);
      this.saveTopicsToStorage(); // 存到本地，下次打开还在
      document.getElementById('btnRefresh').style.display = 'inline-flex';
      this.hideTopicLoading();
    } catch (err) {
      this.hideTopicLoading();
      const msg = err.message;
      if (msg.includes('未配置')) {
        this.showStatus('❌ ' + msg + ' → 点右上角 ⚙️ 填入 API Key', 'error');
      } else if (msg.includes('401') || msg.includes('Incorrect API key')) {
        this.showStatus('❌ API Key 无效，请去 ⚙️ 设置中检查', 'error');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        this.showStatus('❌ 网络不通，检查 API 地址或网络连接', 'error');
      } else {
        this.showStatus('❌ 选题推荐失败：' + msg, 'error');
      }
    }
  },

  async refreshTopics() {
    this.showTopicLoading('🔄 AI 正在想新的角度...');
    try {
      // 带上已选的作为"不要重复"的 hint
      const topics = await Topics.recommend();
      this.state.topics = topics;
      this.renderTopics(topics);
      this.saveTopicsToStorage();
      this.hideTopicLoading();
      this.showStatus('✅ 新一批选题已就绪', 'success');
    } catch (err) {
      this.hideTopicLoading();
      const msg = err.message;
      if (msg.includes('未配置')) {
        this.showStatus('❌ ' + msg + ' → 点右上角 ⚙️ 设置', 'error');
      } else {
        this.showStatus('❌ 换一批失败：' + msg, 'error');
      }
    }
  },

  renderTopics(topics) {
    if (!topics || topics.length === 0) {
      document.getElementById('topicGrid').innerHTML = '<p class="text-light">暂无推荐，点"AI 推荐选题"试试</p>';
      return;
    }
    const currentFilter = document.querySelector('.filter-btn.active')?.dataset.cat || 'all';
    const container = document.getElementById('topicGrid');
    container.innerHTML = topics.map((t, i) => `
      <div class="topic-card ${this.state.selectedTopic === t.title ? 'selected' : ''}"
           data-cat="${t.category}"
           onclick="App.selectTopic(${i})"
           style="${currentFilter !== 'all' && t.category !== currentFilter ? 'display:none' : ''}">
        <div class="topic-card-top">
          <span class="topic-title">${t.title}</span>
          <span class="topic-priority" style="color:${Topics.priorityColor(t.priority)}">${t.priority || ''}</span>
        </div>
        <p class="topic-reason">${t.reason || ''}</p>
        <div class="topic-card-tags">
          <span class="tag category-${t.category}">${Topics.categoryLabel(t.category)}</span>
          ${t.angle ? `<span class="tag">🎯 ${t.angle}</span>` : ''}
        </div>
      </div>
    `).join('');
  },

  filterTopics(cat) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    document.querySelectorAll('.topic-card').forEach(card => {
      card.style.display = (cat === 'all' || card.dataset.cat === cat) ? 'block' : 'none';
    });
  },

  selectTopic(index) {
    const topic = this.state.topics[index];
    this.state.selectedTopic = topic.title;
    this.state.inspiration = ''; // 清空灵感
    document.getElementById('inspirationInput').value = '';
    // 更新 UI
    document.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.topic-card')[index]?.classList.add('selected');
    document.getElementById('selectedBadge').style.display = 'flex';
    document.getElementById('selectedTopicText').textContent = topic.title;
    // 从保存的选题列表中移除已选的（下次打开不再出现）
    this.state.topics.splice(index, 1);
    this.saveTopicsToStorage();
    this.renderTopics(this.state.topics);
    this.saveInspirationDraft();
    this.updateFooter();
  },

  clearSelectedTopic() {
    this.state.selectedTopic = null;
    document.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('selectedBadge').style.display = 'none';
    this.updateFooter();
  },

  showTopicLoading(text) {
    document.getElementById('topicLoading').classList.remove('hidden');
    document.getElementById('topicLoadingText').textContent = text || '🧠 AI 正在策划选题...';
    document.getElementById('btnRecommend').disabled = true;
  },

  setTopicLoadingText(text) {
    const el = document.getElementById('topicLoadingText');
    if (el && text) el.textContent = text;
  },

  hideTopicLoading() {
    document.getElementById('topicLoading').classList.add('hidden');
    document.getElementById('btnRecommend').disabled = false;
  },

  // ---------- 步骤2：识图 ----------
  renderStep2() {
    const el = document.getElementById('mainContent');
    const hasImages = this.state.images.length > 0;
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>📷 第二步：识图（可选）</h2>
          <p class="step-desc">有器物照片可以上传描述，也可以直接下一步跳过。</p>
        </div>

        <div id="visionDropZone" class="vision-dropzone"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="App.handleImageDrop(event)">
          <div class="vision-dropzone-inner">
            <span class="vision-icon">📷</span>
            <p>拖拽图片到这里，或</p>
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('visionInput').click()">
              选择图片
            </button>
            <p class="text-light" style="font-size:0.82em;margin-top:4px">支持 JPG/PNG，最多3张</p>
          </div>
          <input type="file" id="visionInput" accept="image/*" multiple style="display:none"
                 onchange="App.handleImageFiles(this.files)">
        </div>

        <div id="visionPreview" class="vision-preview-list"></div>

        <div id="visionActions" style="display:${hasImages ? 'flex' : 'none'};gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn btn-primary" onclick="App.doVision()" id="btnVision">
            🔍 开始识图
          </button>
          <button class="btn btn-secondary" onclick="App.clearImages()">
            🗑️ 清空图片
          </button>
        </div>

        <div id="visionResult" class="vision-result ${this.state.imageDesc ? '' : 'hidden'}">
          <h3>📝 识别结果</h3>
          <div class="vision-result-content">${this.markdownToHtml(Vision.cleanResponse(this.state.imageDesc))}</div>
          <button class="btn btn-sm btn-secondary" onclick="App.editVisionResult()">✏️ 编辑</button>
        </div>

        <div id="visionLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p id="visionLoadingText">正在识别图片...</p>
        </div>
      </div>
    `;
    this.renderVisionPreviews();
  },

  handleImageFiles(files) {
    const remaining = 3 - this.state.images.length;
    if (remaining <= 0) {
      this.showStatus('最多3张图片', 'warning');
      return;
    }
    const toAdd = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (toAdd.length === 0) return;

    Promise.all(toAdd.map(f => Vision.processFiles([f]))).then(results => {
      results.flat().forEach(url => {
        if (this.state.images.length < 3) this.state.images.push(url);
      });
      this.renderStep2(); // 重渲染
    });
  },

  handleImageDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    this.handleImageFiles(e.dataTransfer.files);
  },

  renderVisionPreviews() {
    const container = document.getElementById('visionPreview');
    if (!container) return;
    container.innerHTML = this.state.images.map((src, i) => `
      <div class="vision-preview-item">
        <img src="${src}" alt="图片${i + 1}">
        <button class="remove-btn" onclick="App.removeImage(${i})">×</button>
      </div>
    `).join('');
  },

  removeImage(index) {
    this.state.images.splice(index, 1);
    this.renderStep2();
  },

  clearImages() {
    this.state.images = [];
    this.state.imageDesc = '';
    this.renderStep2();
  },

  async doVision() {
    if (this.state.images.length === 0) {
      this.showStatus('请先上传图片', 'error');
      return;
    }
    document.getElementById('visionLoading').classList.remove('hidden');
    document.getElementById('btnVision').disabled = true;
    try {
      const desc = await Vision.recognize(this.state.images, (msg) => {
        document.getElementById('visionLoadingText').textContent = msg || '正在识别图片...';
      });
      // 不管 vision.js 里洗没洗干净，这里再杀一轮
      this.state.imageDesc = Vision.cleanResponse(desc);
      this.renderStep2();
    } catch (err) {
      // 识图失败→显示手动输入
      document.getElementById('visionLoading').classList.add('hidden');
      document.getElementById('btnVision').disabled = false;
      const desc = document.querySelector('.vision-result');
      if (desc) {
        desc.classList.remove('hidden');
        desc.innerHTML = `
          <h3>✏️ 手动描述器物</h3>
          <p style="color:var(--text-secondary);font-size:0.85em;margin-bottom:8px">
            ⚠️ 识图暂时不可用（${err.message}），简单写下你看到什么就行：
          </p>
          <textarea class="feedback-input" id="manualVisionDesc"
            placeholder="例如：这是一把柴烧侧把壶，壶身有火皮痕迹，刻了山水"
            style="min-height:100px"></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary btn-sm"
              onclick="App.state.imageDesc=document.getElementById('manualVisionDesc').value;App.renderStep2();App.showStatus('✅ 描述已保存','success');App.updateFooter()">
              确认
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.renderStep2()">
              取消，重传图片
            </button>
          </div>
        `;
      }
      if (err.message.includes('代理') || err.message.includes('Failed to fetch')) {
        this.showStatus('⚠️ 本地视觉代理未启动 → 终端运行: python3 proxy/vision_proxy.py', 'warning');
      } else if (err.message.includes('未配置') || err.message.includes('no_config')) {
        this.showStatus('❌ ' + err.message + ' → 点右上角 ⚙️ 设置', 'error');
      } else {
        this.showStatus('⚠️ 识图失败：' + err.message, 'error');
      }
    } finally {
      document.getElementById('visionLoading').classList.add('hidden');
      document.getElementById('btnVision').disabled = false;
    }
  },

  editVisionResult() {
    const el = document.querySelector('.vision-result-content');
    if (!el) return;
    const textarea = document.createElement('textarea');
    textarea.className = 'vision-edit-area';
    textarea.value = this.state.imageDesc;
    textarea.onblur = () => {
      this.state.imageDesc = textarea.value;
      this.renderStep2();
    };
    el.parentNode.replaceChild(textarea, el);
    // 展开父容器，避免被 max-height 裁剪
    const resultBox = document.querySelector('.vision-result');
    if (resultBox) resultBox.style.maxHeight = 'none';
    textarea.focus();
  },

  // ---------- 步骤3：生成正文 ----------
  renderStep3() {
    const el = document.getElementById('mainContent');
    const hasArticle = !!this.state.article;
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>✍️ 第三步：生成正文</h2>
          <p class="step-desc">AI 根据选题 + 识图结果 + 风格指南，直接给你写一篇。</p>
        </div>

        <div id="genConfig" class="gen-config">
          <div class="gen-config-item">
            <label>文章分类</label>
            <select id="articleCategory" onchange="App.saveCategory()">
              <option value="knowledge">📚 知识科普</option>
              <option value="appreciation">🎨 器物赏析</option>
              <option value="market">📈 市场观察</option>
            </select>
          </div>
          <div class="gen-config-item">
            <label>字数</label>
            <select id="articleLength">
              <option value="short">精简（500字）</option>
              <option value="medium" selected>标准（800-1000字）</option>
              <option value="long">详细（1200-1500字）</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" onclick="App.generateArticle()" id="btnGenerate" ${hasArticle ? '' : ''}>
          ✨ 生成正文
        </button>

        <div id="genLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p>✍️ AI 正在写文章...</p>
        </div>

        <div id="articleDisplay" class="article-display ${hasArticle ? '' : 'hidden'}">
          ${hasArticle ? this.markdownToHtml(this.state.article) : ''}
        </div>
      </div>
    `;
  },

  saveCategory() {
    // 在生成时使用即可
  },

  /** 从历史记录中获取 1-2 篇示例文章用于 few-shot */
  getFewShotArticles() {
    try {
      const raw = localStorage.getItem('laoguo_v2_history');
      if (!raw) return '';
      const history = JSON.parse(raw);
      if (history.length === 0) return '';
      // 取最新 2 篇不同分类的文章作为示例
      const categories = new Set();
      const samples = [];
      for (const item of history) {
        if (samples.length >= 2) break;
        const cat = item.category || 'knowledge';
        if (!categories.has(cat)) {
          categories.add(cat);
          samples.push(item);
        }
      }
      if (samples.length === 0) samples.push(history[0]);
      return samples.map((item, i) =>
        `【示例文章${i + 1}】\n标题：${item.title}\n正文：\n${item.article.substring(0, 800)}`
      ).join('\n\n');
    } catch (e) {
      return '';
    }
  },

  /** 获取历史修改反馈，用于指导本次生成 */
  getEditFeedback() {
    try {
      const raw = localStorage.getItem('laoguo_v2_edit_feedback');
      if (!raw) return '';
      const feedbacks = JSON.parse(raw);
      if (feedbacks.length === 0) return '';
      // 取最近 5 条修改意见
      const recent = feedbacks.slice(-5);
      return recent.map((fb, i) =>
        `【历史修改${i + 1}】主题：${fb.topic || '未分类'} | 修改意见：${fb.feedback}`
      ).join('\n');
    } catch (e) {
      return '';
    }
  },

  buildArticlePrompt() {
    const topic = this.state.selectedTopic || (inspiration ? '' : '建水紫陶');
    const inspiration = this.state.inspiration || '';
    const imageDesc = this.state.imageDesc || '';
    const category = document.getElementById('articleCategory')?.value || 'knowledge';
    const length = document.getElementById('articleLength')?.value || 'medium';

    const hasImage = !!imageDesc;

    const wordCount = { short: '500字左右', medium: '800-1000字', long: '1200-1500字' };
    const categoryDesc = {
      knowledge: '知识科普',
      appreciation: '器物赏析',
      market: '市场观察'
    };

    const editFeedback = this.getEditFeedback();

    return `你是一位建水紫陶内容创作者「老郭说宝」。请根据以下信息写一篇口播文稿。
${hasImage && inspiration ? `
===== 核心素材（必须综合以下两部分信息来写） =====

【器物识图结果】
${imageDesc}

【用户的灵感和背景信息】
${inspiration}

强制要求：
1. 文章必须同时运用以上两部分信息，不要只用其中一部分
2. 识图结果提供器物的视觉细节，灵感提供创作背景和角度，两者结合才能写出有深度的文章
3. 开篇引入器物，全文围绕器物特征展开，同时融入灵感中提到的背景信息（如作者、工艺组合、创作理念等）
===== 以下是风格和知识参考 =====
` : hasImage ? `
===== 核心素材（本次写作的主角，文章必须围绕此器物展开） =====
${imageDesc}

强制要求：文章必须以这件器物为主体，开篇就要引入它，全文围绕其特征、工艺、美感展开分析。禁止忽略此素材写成泛泛的科普文。
===== 以下是风格和知识参考 =====
` : (inspiration ? `
===== 核心素材（用户提供的灵感，文章必须围绕此展开） =====
${inspiration}

强制要求：文章必须以以上灵感为核心展开，不要偏离到其他话题。
===== 以下是风格和知识参考 =====
` : '')}
${topic ? `【选题】${topic}` : ''}
${(!topic && inspiration && !hasImage) ? '' : (inspiration ? `【灵感素材】\n${inspiration}\n` : '')}
【文章分类】${categoryDesc[category] || category}
【字数要求】${wordCount[length] || wordCount.medium}

【知识体系（必须基于此写作）】
${Config.KNOWLEDGE_BASE.zitao}

【风格指南（必须严格遵守）】
${Config.KNOWLEDGE_BASE.style}

${this._buildCoveredSection()}

${editFeedback ? `【历史修改经验（本次写作要特别注意）】\n${editFeedback}\n` : ''}
${this._buildExamplesSection()}

## 严禁事项（必须遵守）
1. 禁止编造不存在的匠人姓名（如"李师傅""王老师"等），只提已知的真实作者
2. 禁止给器物编造不存在的名称或款式名
3. 禁止编造不存在的历史人物或典故
4. 所有数据、人名、作品名必须有出处，不确定的不要提
5. 如果不知道具体作者或作品名，直接说不确定，不要瞎编
6. 禁止使用破折号（——），用逗号、冒号或直接分层叙述替代
7. 不要输出标题，不要输出配图提示词，不要输出其他说明——直接输出正文

请直接输出正文。`;
  },

  /** 构建「已写方向」段落：优先用 Obsidian 知识库，回退到硬编码 */
  _buildCoveredSection() {
    if (ObsidianKB.hasArticles()) {
      const covered = ObsidianKB.buildCoveredList();
      return `【已写过的方向（基于 Obsidian 归档，避免重复）】\n${covered}`;
    }
    return `【已写过的方向（避免重复）】\n${Config.KNOWLEDGE_BASE.covered}`;
  },

  /** 构建 few-shot 示例段落：优先用 Obsidian 归档文章，回退到 localStorage 历史 */
  _buildExamplesSection() {
    if (ObsidianKB.hasArticles()) {
      const examples = ObsidianKB.getFewShotArticles(4);
      if (examples) {
        return `【风格参考 — 仔细阅读以下归档文章，严格模仿其风格】
以下是你之前写的文章（已从 Obsidian 归档中读取）。请仔细学习它们的：
- 行文节奏：短段落、短句子、口播感
- 语气口吻：懂行不装、亲切自然的行家腔调
- 句式偏好：设问、口语化插入语、过渡词的使用方式
- 论证方式：如何引入数据、如何讲匠人故事、如何做类比
- 整体气质：科学依据 + 文化底蕴 + 理性消费观

${examples}

⚠️ 强制要求：新文章的风格、口吻、节奏必须与以上示例保持一致。如果你觉得自己的输出和示例风格不匹配，请重写。`;
      }
    }
    // 回退：用 localStorage 中的历史文章
    const fallback = this.getFewShotArticles();
    return fallback ? `【参考示例（模仿其文风和结构）】\n${fallback}\n` : '';
  },

  /** 渲染知识库管理界面（在设置面板中使用） */
  renderObsidianKB() {
    const statuses = ObsidianKB.getFolderStatuses();
    const total = ObsidianKB.getTotalArticles();

    let html = '<div class="obsidian-kb-section">';

    // 已连接的文件夹列表
    if (statuses.length > 0) {
      html += '<div class="kb-folder-list">';
      statuses.forEach((f, i) => {
        html += `
          <div class="kb-folder-item ${f.error ? 'kb-error' : ''}">
            <span class="kb-folder-icon">📁</span>
            <span class="kb-folder-name">${f.name}</span>
            <span class="kb-folder-count">${f.count} 篇文章</span>
            ${f.error ? `<span class="kb-folder-error">${f.error}</span>` : ''}
            <button class="btn btn-sm btn-danger" onclick="App._removeKBFolder(${i})" title="移除">✕</button>
          </div>
        `;
      });
      html += '</div>';
      html += `<p class="kb-summary">📊 共 ${statuses.length} 个文件夹 · ${total} 篇文章</p>`;
    } else {
      html += '<p class="text-light">尚未连接知识库文件夹</p>';
    }

    // 按钮
    html += `
      <div class="kb-actions">
        <button class="btn btn-secondary btn-sm" onclick="App._addKBFolder()">📂 添加文件夹</button>
        ${statuses.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="App._rescanKB()">🔄 重新扫描</button>` : ''}
      </div>
      <p class="text-light" style="margin-top:8px;font-size:12px;">
        💡 支持添加多个文件夹。需要 Chrome/Edge 浏览器。选一次后会记住权限。
      </p>
    `;

    html += '</div>';
    return html;
  },

  /** 添加知识库文件夹 */
  async _addKBFolder() {
    try {
      const result = await ObsidianKB.addFolder();
      this.showStatus(`✅ 已添加「${result.name}」，${result.count} 篇文章`, 'success');
      this.renderSettings();
    } catch (e) {
      if (e.name !== 'AbortError') {
        this.showStatus('❌ ' + e.message, 'error');
      }
    }
  },

  /** 移除知识库文件夹 */
  async _removeKBFolder(index) {
    await ObsidianKB.removeFolder(index);
    this.renderSettings();
  },

  /** 重新扫描所有知识库文件夹 */
  async _rescanKB() {
    this.showStatus('🔄 正在扫描知识库...', 'info');
    await ObsidianKB.rescanAll();
    const total = ObsidianKB.getTotalArticles();
    this.showStatus(`✅ 扫描完成，共 ${total} 篇文章`, 'success');
    this.renderSettings();
  },

  async generateArticle() {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API，请先去设置中添加', 'error');
      return;
    }

    this.state.generatingArticle = true;
    document.getElementById('genLoading').classList.remove('hidden');
    document.getElementById('btnGenerate').disabled = true;
    document.getElementById('articleDisplay').classList.add('hidden');

    const prompt = this.buildArticlePrompt();
    let fullText = '';

    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(
          `你是「老郭说宝」—— 建水紫陶行业从业者、直播带货主播、文化传播者。
你的口吻：懂行但不装、接地气的行家，从一线经验出发，专业自信但不傲慢。
你对读者称"您"为主，偶尔用"你"，保持尊重且亲切。

写作铁律（刻在骨子里的）：
1. 口播感强：短段落、短句子，读起来像在说话
2. 多用设问："为什么？因为……"
3. 口语化插入语："我跟你说""您想想""说得直白一点"
4. 高频过渡词："说白了""说白了就是"
5. 每篇必有具体匠人名字，从知识体系中选
6. 每篇植入一个文化概念或历史典故（侘寂、锦灰堆、宋徽宗等）
7. 论证手法：权威背书（上海交大研究）+ 具体数据 + 类比打比方 + 亲身经验
8. 永远不要破折号（——）
9. 结尾固定句："我是老郭，讲述有宝物的故事，和有故事的宝物。下期见！"
10. 反对玄学，用科学和数据说话；不拉踩紫砂；理性消费观`,
          prompt),
        chunk => {
          fullText += chunk;
          this.state.article = fullText;
          // 实时更新显示
          const display = document.getElementById('articleDisplay');
          if (display) {
            display.classList.remove('hidden');
            display.innerHTML = this.markdownToHtml(fullText);
            display.scrollTop = display.scrollHeight;
          }
        },
        { temperature: 0.8 }
      );

      this.state.generatingArticle = false;
      this.state.articleEdited = fullText; // 默认修改版=原文
      document.getElementById('genLoading').classList.add('hidden');
      document.getElementById('btnGenerate').disabled = false;
      this.saveDraft();
      this.showStatus('✅ 正文生成完成！可以修改或下一步', 'success');
      this.updateFooter();

    } catch (err) {
      this.state.generatingArticle = false;
      document.getElementById('genLoading').classList.add('hidden');
      document.getElementById('btnGenerate').disabled = false;
      this.showStatus('❌ 生成失败：' + err.message, 'error');
    }
  },

  // ---------- 步骤4：修改正文 ----------
  renderStep4() {
    const el = document.getElementById('mainContent');
    const text = this.state.articleEdited || this.state.article;
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>🔧 第四步：修改正文</h2>
          <p class="step-desc">看完整篇文章，在下方写下你的修改意见。</p>
        </div>

        <!-- 文章预览（只读） -->
        <div class="article-preview-box">
          ${this.markdownToHtml(text)}
        </div>

        <!-- 修改方式选择 -->
        <div class="rewrite-mode-selector">
          <label class="rewrite-mode-item active" id="modeFineTune" onclick="App.setRewriteMode('fine')">
            <input type="radio" name="rewriteMode" value="fine" checked hidden>
            <span class="rewrite-mode-radio">●</span>
            <div class="rewrite-mode-content">
              <strong>微调</strong>
              <span>根据你的意见针对性小改，保留原框架</span>
            </div>
          </label>
          <label class="rewrite-mode-item" id="modeRewrite" onclick="App.setRewriteMode('full')">
            <input type="radio" name="rewriteMode" value="full" hidden>
            <span class="rewrite-mode-radio">○</span>
            <div class="rewrite-mode-content">
              <strong>重写</strong>
              <span>根据你的意见整体重写，换角度/换结构</span>
            </div>
          </label>
        </div>

        <!-- 反馈输入 -->
        <textarea id="feedbackInput" class="feedback-input"
          placeholder="写下你的修改意见，比如：&#10;- 开头不够吸引人，换个悬念式开头&#10;- 第二段柴烧的部分太技术了，写得更通俗点&#10;- 中间加一个具体作品的例子"
        ></textarea>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn-primary" onclick="App.submitFeedback()">
            ✨ 提交修改意见
          </button>
          <button class="btn btn-secondary btn-sm" onclick="App.saveEditFeedback()" title="将修改意见保存到知识库，下次写类似文章时AI会自动参考">
            💾 保存修改经验
          </button>
          <button class="btn btn-secondary btn-sm" onclick="App.toggleRawEdit()">
            📝 直接编辑原文
          </button>
        </div>

        <!-- 直接编辑区（默认隐藏） -->
        <div id="rawEditWrap" class="hidden" style="margin-top:16px">
          <textarea id="rawEditArea" class="edit-area"
            oninput="App.state.articleEdited=this.value">${text}</textarea>
        </div>

        <div id="rewriteLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p>✍️ AI 正在处理你的意见...</p>
        </div>
      </div>
    `;
    this._rewriteMode = 'fine';
  },

  _rewriteMode: 'fine',

  setRewriteMode(mode) {
    this._rewriteMode = mode;
    document.getElementById('modeFineTune').classList.toggle('active', mode === 'fine');
    document.getElementById('modeRewrite').classList.toggle('active', mode === 'full');
  },

  toggleRawEdit() {
    const wrap = document.getElementById('rawEditWrap');
    wrap.classList.toggle('hidden');
    if (!wrap.classList.contains('hidden')) {
      document.getElementById('rawEditArea').focus();
    }
  },

  async submitFeedback() {
    const feedback = document.getElementById('feedbackInput').value.trim();
    if (!feedback) {
      this.showStatus('请先写下修改意见', 'warning');
      return;
    }

    // 自动保存修改意见到知识库，下次生成时参考
    this._autoSaveFeedback(feedback);

    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const current = this.state.articleEdited || this.state.article;
    const mode = this._rewriteMode === 'full' ? '整体重写' : '针对性微调';

    document.getElementById('rewriteLoading').classList.remove('hidden');
    let fullText = '';

    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(
          `你是老郭说宝的专属文章编辑。你的唯一任务：根据用户的修改意见，对文章进行修改，然后输出修改后的完整全文。

编辑铁律（违反任何一条都是失败）：
1. 用户说了改哪里就必须改哪里，绝对不能原封不动输出
2. 输出必须是一篇完整的修改后文章，不是片段，不是"我改了第X段"
3. 改完之后，用户提到的问题在文章里必须已经消失
4. 保留老郭说宝的口播风格和整体框架，除非用户要求重写
5. 用户的事实纠正以用户为准（如"泥料就是红泥，没有掺其他色泥"，就按这个改）
6. 直接输出修改后的全文，不要加任何说明、注释或"修改如下"之类的前缀`,
          `请对以下文章进行${mode}。

用户修改意见：
${feedback}

原文：
${current}

要求：
1. ${mode === '整体重写' ? '根据意见重新组织文章结构和角度' : '逐条落实每一条修改意见，不要遗漏任何一条'}
2. 用户指出的事实错误必须纠正，用户给出的正确信息必须替换进去
3. 修改后直接输出完整全文`
        ),
        chunk => {
          fullText += chunk;
          this.state.articleEdited = fullText;
          // 实时更新预览
          const preview = document.querySelector('.article-preview-box');
          if (preview) preview.innerHTML = this.markdownToHtml(fullText);
          // 同步更新原始编辑区
          const rawArea = document.getElementById('rawEditArea');
          if (rawArea) rawArea.value = fullText;
        },
        { temperature: 0.7 }
      );
      document.getElementById('rewriteLoading').classList.add('hidden');
      this.showStatus('✅ 修改完成，看看满不满意', 'success');
      this.updateFooter();
    } catch (err) {
      document.getElementById('rewriteLoading').classList.add('hidden');
      this.showStatus('❌ 修改失败：' + err.message, 'error');
    }
  },

  /** 自动保存修改意见（供 submitFeedback 内部调用，不弹提示） */
  _autoSaveFeedback(feedback) {
    const topic = this.state.selectedTopic || this.state.inspiration || '未分类';
    try {
      let history = [];
      const raw = localStorage.getItem('laoguo_v2_edit_feedback');
      if (raw) history = JSON.parse(raw);
      history.push({
        topic: topic.substring(0, 50),
        feedback,
        createdAt: new Date().toISOString()
      });
      if (history.length > 50) history = history.slice(-50);
      localStorage.setItem('laoguo_v2_edit_feedback', JSON.stringify(history));
    } catch (e) { /* 静默失败，不影响主流程 */ }
  },

  /** 保存修改意见到知识库，下次生成时自动参考 */
  saveEditFeedback() {
    const feedback = document.getElementById('feedbackInput')?.value.trim();
    if (!feedback) {
      this.showStatus('请先在输入框中写下修改意见再保存', 'warning');
      return;
    }
    const topic = this.state.selectedTopic || this.state.inspiration || '未分类';
    try {
      let history = [];
      const raw = localStorage.getItem('laoguo_v2_edit_feedback');
      if (raw) history = JSON.parse(raw);
      history.push({
        topic: topic.substring(0, 50),
        feedback,
        createdAt: new Date().toISOString()
      });
      // 最多保留 50 条
      if (history.length > 50) history = history.slice(-50);
      localStorage.setItem('laoguo_v2_edit_feedback', JSON.stringify(history));
      this.showStatus('✅ 修改经验已保存！下次生成相似选题时会自动参考', 'success');
    } catch (e) {
      this.showStatus('保存失败', 'error');
    }
  },

  // ---------- 步骤5：标题 ----------
  renderStep5() {
    const el = document.getElementById('mainContent');
    const hasTitles = this.state.titles.length > 0;
    const hasSelected = !!this.state.selectedTitle;
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>🏷️ 第五步：生成标题</h2>
          <p class="step-desc">AI 根据正文生成 5 个备选标题，点击标题选定。点「重新生成」可换掉不满意的。</p>
        </div>

        <div class="title-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-primary" onclick="App.generateTitles()" id="btnGenTitles">
            🎯 生成标题方案
          </button>
          <button class="btn btn-${hasSelected ? 'warning' : 'secondary'}" onclick="App.regenerateTitles()" id="btnRegenTitles"
                  style="display:${hasTitles ? 'inline-flex' : 'none'}">
            ${hasSelected ? `📌 保留已选的 #${this.state.titles.findIndex(t => t.title === this.state.selectedTitle) + 1}，重选其余4个` : '🔄 全部重新生成'}
          </button>
        </div>

        <div id="titleLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p>🏷️ AI 正在构思标题...</p>
        </div>

        <div id="titleList" class="title-list ${hasTitles ? '' : 'hidden'}">
          ${hasTitles ? this.state.titles.map((t, i) => {
            const isSelected = this.state.selectedTitle === t.title;
            return `
            <div class="title-card ${isSelected ? 'selected' : ''}"
                 onclick="App.selectTitle(${i})">
              <div class="title-index">#${i + 1}</div>
              <div class="title-content">
                <div class="title-text">${t.title}</div>
                <div class="title-meta">
                  <span class="title-score">⭐ ${'★'.repeat(Math.round(t.score || 3))}${'☆'.repeat(5 - Math.round(t.score || 3))} (${t.score})</span>
                  ${t.note ? `<span class="title-note">${t.note}</span>` : ''}
                  ${t.title.length <= 20 ? '<span class="tag tag-short">📱 小红书适用</span>' : ''}
                </div>
              </div>
              <div class="title-check">${isSelected ? '✓' : ''}</div>
            </div>`;
          }).join('') : ''}
        </div>

        ${hasSelected ? '<p class="text-light" style="font-size:0.82em;margin-top:4px">📌 点击「保留已选的」按钮，选中的标题不动，其余4个重新生成</p>' : ''}
      </div>
    `;
  },

  async generateTitles() {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const article = this.state.articleEdited || this.state.article;
    const first500 = article.substring(0, 500);

    document.getElementById('titleLoading').classList.remove('hidden');
    document.getElementById('btnGenTitles').disabled = true;

    let fullText = '';
    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(`你是老郭说宝的标题策划专家。熟知建水紫陶行业和「老郭说宝」的风格。

老郭的写作风格：
${Config.KNOWLEDGE_BASE.style}

要求：
1. 标题要吸引人、有传播力，体现老郭的幽默大气风格
2. 至少1个不超过20字（小红书适用）
3. 标题要基于文章真实内容，不夸大不虚构
4. 每个标题给出5分制评分和一句话评价
5. 标题要多样化：一个偏文化典故、一个偏实用价值、一个偏情感共鸣、一个偏悬念反问
6. 如果文章提到具体匠人，标题一定要体现匠人名字

返回 JSON 数组，格式：
[{"title":"标题","score":4.5,"note":"评价"}]

只返回 JSON，不要其他文字。`,
`以下是文章开头：

${first500}

请生成 5 个标题方案。`),
        chunk => { fullText += chunk; },
        { temperature: 0.9, max_tokens: 2048 }
      );

      const titles = LLM.parseJSON(fullText);
      this.state.titles = titles;
      this.state.selectedTitle = '';
      this.renderStep5();
      this.updateFooter();
      // 显示「全部重新生成」按钮
      const regenBtn = document.getElementById('btnRegenTitles');
      if (regenBtn) regenBtn.style.display = 'inline-flex';
    } catch (err) {
      this.showStatus('❌ 标题生成失败：' + err.message, 'error');
    } finally {
      document.getElementById('titleLoading').classList.add('hidden');
      document.getElementById('btnGenTitles').disabled = false;
    }
  },

  selectTitle(index) {
    const title = this.state.titles[index].title;
    // 点击已选的 = 取消选择
    if (this.state.selectedTitle === title) {
      this.state.selectedTitle = '';
    } else {
      this.state.selectedTitle = title;
    }
    // 重新渲染步骤5 更新按钮状态
    this.renderStep5();
    this.updateFooter();
  },

  /** 重新生成标题：有已选则保留它，无已选则全部重来 */
  async regenerateTitles() {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const article = this.state.articleEdited || this.state.article;
    const first500 = article.substring(0, 500);
    const keptTitle = this.state.selectedTitle;
    const keptIndex = keptTitle ? this.state.titles.findIndex(t => t.title === keptTitle) : -1;

    document.getElementById('titleLoading').classList.remove('hidden');
    document.getElementById('btnGenTitles').disabled = true;
    document.getElementById('btnRegenTitles').disabled = true;

    let fullText = '';
    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(`你是老郭说宝的标题策划专家。熟知建水紫陶行业和「老郭说宝」的风格。

老郭的写作风格：
${Config.KNOWLEDGE_BASE.style}

要求：
1. 标题要吸引人、有传播力，体现老郭的幽默大气风格
2. 至少1个不超过20字（小红书适用）
3. 标题要基于文章真实内容，不夸大不虚构
4. 每个标题给出5分制评分和一句话评价
5. 标题要多样化：一个偏文化典故、一个偏实用价值、一个偏情感共鸣、一个偏悬念反问
6. 如果文章提到具体匠人，标题一定要体现匠人名字
${keptTitle ? `7. 以下已有一个备选标题，请保留它，另外生成4个新标题：\n已保留的备选标题：${keptTitle}` : ''}
${keptTitle ? '\n返回 JSON 数组（保持5项，把已保留的放在第一位）' : ''}

返回 JSON 数组，格式：
[{"title":"标题","score":4.5,"note":"评价"}]

只返回 JSON，不要其他文字。`,
`以下是文章开头：

${first500}

${keptTitle ? `请生成 4 个新的标题方案，加上已保留的「${keptTitle}」共5个。` : '请生成 5 个标题方案。'}`),
        chunk => { fullText += chunk; },
        { temperature: 0.9, max_tokens: 2048 }
      );

      const titles = LLM.parseJSON(fullText);
      if (keptTitle && titles.length > 0 && titles[0].title !== keptTitle) {
        titles.unshift({ title: keptTitle, score: 5, note: '已保留的备选' });
      }
      this.state.titles = titles.slice(0, 5);
      this.state.selectedTitle = keptTitle || '';  // 保留已选状态
      this.renderStep5();
      this.updateFooter();
      this.showStatus(keptTitle ? '✅ 标题已更新，保留了已选的' : '✅ 新一批标题已就绪', 'success');
    } catch (err) {
      this.showStatus('❌ 标题生成失败：' + err.message, 'error');
    } finally {
      document.getElementById('titleLoading').classList.add('hidden');
      document.getElementById('btnGenTitles').disabled = false;
      document.getElementById('btnRegenTitles').disabled = false;
    }
  },

  // ---------- 步骤6：配图提示词 ----------
  renderStep6() {
    const el = document.getElementById('mainContent');
    const hasPrompts = this.state.imagePrompts.length > 0;
    const hasChecked = this.state.promptChecked.some(c => c);
    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>🎨 第六步：配图提示词</h2>
          <p class="step-desc">AI 根据文章内容生成 7 张场景配图 + 1 张封面提示词（从标题提炼≤15字渲染在封面之上）。</p>
        </div>

        <div class="prompt-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-primary" onclick="App.generateImagePrompts()" id="btnGenPrompts">
            🖼️ 生成配图提示词
          </button>
          <button class="btn btn-secondary" onclick="App.regenerateSelectedPrompts()" id="btnRegenPrompts"
                  style="display:${hasChecked ? 'inline-flex' : 'none'}">
            🔄 重新生成勾选的
          </button>
          <button class="btn btn-secondary" onclick="App.showPromptRefineDialog()" id="btnPromptRefine"
                  style="display:${hasPrompts ? 'inline-flex' : 'none'}">
            💬 与 AI 沟通优化
          </button>
        </div>

        <div id="promptLoading" class="topic-loading hidden">
          <div class="spinner"></div>
          <p>🎨 AI 正在构思配图方案...</p>
        </div>

        <div id="promptTable" class="${hasPrompts ? '' : 'hidden'}">
          ${hasPrompts ? this.renderPromptTable() : ''}
        </div>
      </div>

      <!-- AI 对话优化对话框 -->
      <div id="promptRefineModal" class="modal hidden">
        <div class="modal-overlay" onclick="App.closeModal('promptRefineModal')"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2>💬 与 AI 沟通配图优化</h2>
            <button class="modal-close" onclick="App.closeModal('promptRefineModal')">✕</button>
          </div>
          <div class="modal-body" style="padding:20px">
            <p class="text-light" style="margin-bottom:12px;font-size:0.85em">
              告诉 AI 你希望配图提示词怎么改进。例如：风格统一为水墨画、加入更多茶文化元素、画面更简洁等。
            </p>
            <textarea id="promptRefineInput" class="feedback-input"
              placeholder="例如：&#10;- 风格统一为中国水墨画风&#10;- 每张都加入茶具或茶叶元素&#10;- 画面更简洁留白多一点&#10;- 去掉过于抽象的意象">${this.state.promptRefineText}</textarea>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-primary" onclick="App.submitPromptRefine()">✨ 应用优化并重新生成</button>
              <button class="btn btn-secondary" onclick="App.closeModal('promptRefineModal')">取消</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async generateImagePrompts() {
    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const title = this.state.selectedTitle || '建水紫陶';
    const article = this.state.articleEdited || this.state.article;

    document.getElementById('promptLoading').classList.remove('hidden');
    document.getElementById('btnGenPrompts').disabled = true;

    let fullText = '';
    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(`你是老郭说宝的配图策划师。根据文章内容生成 8 张配图提示词。

要求：
1. 第1张是封面提示词：① 从标题提炼不超过15字的封面文字（title_text）；② scene 要描述与文章核心内容紧密相关的画面作为封面视觉主体，标题文字以书法/艺术字体叠印或镶嵌在这个画面之上（文字是点睛，画面根植于文章）
2. 第2-8张是场景配图提示词，按文章叙事顺序排列
3. 每张提示词包含：画面内容、风格参考、画幅标注
4. 画幅统一标注 "9:16竖版"
5. 每张末尾加 "9:16竖版" 字样
6. 产品本身不需要配图（已有实物照片），配图用于辅助场景意境
7. 画面要有审美、有意境，适合文生图模型
8. 所有 8 张提示词（含封面）的灵感都必须来源于文章内容，封面不能脱离文章凭空创作

返回 JSON 数组，格式：
[{"scene":"画面内容描述","style":"风格参考，如中国风、水墨、工笔","ref":"参考艺术家或风格","title_text":"封面提炼文字"}, ...]

注意：
- 第1项的 title_text 为从标题提炼出的封面文字（不超过15字）
- 第1项的 scene 要描绘一个与文章核心内容相关的画面作为封面视觉主体（例如文章讲火皮对比，封面就做一半火皮一半素面的陶器为主体），标题文字叠印其上；不能脱离文章只做纯书法渲染
- 第2-8项的 title_text 可省略或留空

只返回 JSON，不要其他文字。`,
`文章标题：${title}

文章内容：
${article.substring(0, 1500)}

请生成 8 张配图提示词。第1张为封面提示词：scene 要描绘与文章相关的画面作为视觉主体（不可脱离文章凭空创作），标题文字叠印其上，提炼≤15字的封面文字放在 title_text 字段。第2-8张是场景配图。`),
        chunk => { fullText += chunk; },
        { temperature: 0.85, max_tokens: 4096 }
      );

      const prompts = LLM.parseJSON(fullText);
      this.state.imagePrompts = prompts;
      this.state.promptChecked = prompts.map(() => false); // 所有未勾选
      this.state.promptRefineText = ''; // 清空优化文本
      this.renderStep6();
      this.updateFooter();
    } catch (err) {
      this.showStatus('❌ 配图提示词生成失败：' + err.message, 'error');
    } finally {
      document.getElementById('promptLoading').classList.add('hidden');
      document.getElementById('btnGenPrompts').disabled = false;
    }
  },

  renderPromptTable() {
    const prompts = this.state.imagePrompts;
    if (!prompts || prompts.length === 0) return '';
    // 确保 promptChecked 长度一致
    while (this.state.promptChecked.length < prompts.length) {
      this.state.promptChecked.push(false);
    }
    let html = `<div class="prompt-list">`;
    prompts.forEach((p, i) => {
      const isChecked = this.state.promptChecked[i] || false;
      const isCover = i === 0 && p.title_text;
      const parts = [p.scene || ''];
      if (p.style) parts.push(`风格参考：${p.style}`);
      if (p.ref) parts.push(`参考：${p.ref}`);
      parts.push('9:16竖版');
      const badge = isCover
        ? `<span style="background:var(--primary);color:#fff;font-size:0.75em;padding:1px 8px;border-radius:8px;margin-right:6px;font-weight:600;">封面</span>`
        : '';
      const titleLine = isCover
        ? `<div style="margin-top:4px;font-size:0.95em;color:var(--primary);font-weight:600;">📌 ${p.title_text}</div>`
        : '';
      html += `<div class="prompt-item ${isChecked ? 'checked' : ''} ${isCover ? 'cover-item' : ''}" style="padding:10px 14px;margin-bottom:8px;border:1px solid ${isCover ? 'var(--primary)' : 'var(--border-light)'};border-radius:var(--radius-sm);background:var(--bg-card);font-size:0.88em;line-height:1.6;display:flex;align-items:flex-start;gap:10px;">
        <label class="prompt-checkbox" onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-top:2px;flex-shrink:0;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="App.togglePromptCheck(${i})" style="width:16px;height:16px;cursor:pointer;">
        </label>
        <div style="flex:1">
          <span style="font-weight:600;color:var(--primary);margin-right:4px;">#${i + 1}</span>
          ${badge}
          ${parts.map(s => `<span>${s}</span>`).join('，')}
          ${titleLine}
        </div>
      </div>`;
    });
    html += `</div>`;
    return html;
  },

  /** 勾选/取消配图提示词 */
  togglePromptCheck(index) {
    this.state.promptChecked[index] = !this.state.promptChecked[index];
    // 更新按钮显隐
    const hasChecked = this.state.promptChecked.some(c => c);
    const regenBtn = document.getElementById('btnRegenPrompts');
    if (regenBtn) regenBtn.style.display = hasChecked ? 'inline-flex' : 'none';
    // 更新卡片高亮
    const items = document.querySelectorAll('.prompt-item');
    if (items[index]) items[index].classList.toggle('checked');
  },

  /** 重新生成勾选的配图提示词 */
  async regenerateSelectedPrompts() {
    const checkedIndices = [];
    this.state.promptChecked.forEach((c, i) => { if (c) checkedIndices.push(i); });
    if (checkedIndices.length === 0) {
      this.showStatus('请先勾选要重新生成的提示词', 'warning');
      return;
    }

    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const title = this.state.selectedTitle || '建水紫陶';
    const article = this.state.articleEdited || this.state.article;
    const prompts = this.state.imagePrompts;

    // 构造需要重新生成的上下文
    const toRegen = checkedIndices.map(i => {
      let info = `#${i + 1}：场景「${prompts[i].scene || ''}」风格「${prompts[i].style || ''}」参考「${prompts[i].ref || ''}」`;
      if (prompts[i].title_text) info += ` 封面文字「${prompts[i].title_text}」`;
      return info;
    }).join('\n');

    // 保留不需要重生成的
    const keepPairs = prompts.map((p, i) => ({ p, i }));
    const keepInfo = keepPairs.filter(({ i }) => !this.state.promptChecked[i])
      .map(({ p, i }) => {
        let info = `#${i + 1}：${p.scene || ''}（保留不变）`;
        if (p.title_text) info += ` 封面文字「${p.title_text}」`;
        return info;
      }).join('\n');

    const refineHint = this.state.promptRefineText
      ? `\n\n用户的优化要求：${this.state.promptRefineText}` : '';

    document.getElementById('promptLoading').classList.remove('hidden');
    document.getElementById('btnGenPrompts').disabled = true;
    document.getElementById('btnRegenPrompts').disabled = true;
    document.getElementById('btnPromptRefine').disabled = true;

    let fullText = '';
    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(`你是老郭说宝的配图策划师。根据文章内容重新生成部分配图提示词。

要求：
1. 每张提示词包含：画面内容、风格参考、画幅标注
2. 画幅统一标注 "9:16竖版"
3. 每张末尾加 "9:16竖版" 字样
4. 产品本身不需要配图（已有实物照片），配图用于辅助场景意境
5. 画面要有审美、有意境，适合文生图模型
6. 以下列出需要重新生成的原提示词，请参考其序号和原意改写优化
7. 未列出的提示词保持原样，不要改动${refineHint}
8. 第1张如果是封面提示词，scene 要描绘与文章相关的画面作为视觉主体（不可脱离文章凭空创作），标题文字叠印其上；必须保留 title_text 字段（封面提炼文字，不超过15字）
9. 所有提示词（含封面）的灵感都必须来源于文章内容

返回 JSON 数组（保持总数不变，只修改需要重新生成的项），格式：
[{"scene":"画面内容描述","style":"风格参考，如中国风、水墨、工笔","ref":"参考艺术家或风格","title_text":"封面提炼文字"}, ...]

只返回 JSON，不要其他文字。`,
`文章标题：${title}

文章内容：
${article.substring(0, 1500)}

需要重新生成的提示词：
${toRegen}

保持不变的提示词：
${keepInfo}

请返回全部 ${prompts.length} 项（修改需要改的，保留不需要改的）。`),
        chunk => { fullText += chunk; },
        { temperature: 0.85, max_tokens: 4096 }
      );

      const newPrompts = LLM.parseJSON(fullText);
      // 只替换勾选的项
      if (Array.isArray(newPrompts) && newPrompts.length === prompts.length) {
        this.state.imagePrompts = newPrompts;
      } else {
        // 如果返回数量不对，只替换勾选位置的 scene/style/ref/title_text
        checkedIndices.forEach(idx => {
          if (newPrompts[idx]) {
            prompts[idx].scene = newPrompts[idx].scene || prompts[idx].scene;
            prompts[idx].style = newPrompts[idx].style || prompts[idx].style;
            prompts[idx].ref = newPrompts[idx].ref || prompts[idx].ref;
            if (newPrompts[idx].title_text) prompts[idx].title_text = newPrompts[idx].title_text;
          }
        });
      }
      // 清空勾选
      this.state.promptChecked = this.state.imagePrompts.map(() => false);
      this.renderStep6();
      this.updateFooter();
      this.showStatus('✅ 配图提示词已更新', 'success');
    } catch (err) {
      this.showStatus('❌ 配图提示词生成失败：' + err.message, 'error');
    } finally {
      document.getElementById('promptLoading').classList.add('hidden');
      document.getElementById('btnGenPrompts').disabled = false;
      const regenBtn = document.getElementById('btnRegenPrompts');
      if (regenBtn) { regenBtn.disabled = false; regenBtn.style.display = 'none'; }
      const refineBtn = document.getElementById('btnPromptRefine');
      if (refineBtn) refineBtn.disabled = false;
    }
  },

  /** 打开配图优化对话窗口 */
  showPromptRefineDialog() {
    document.getElementById('promptRefineInput').value = this.state.promptRefineText;
    this.openModal('promptRefineModal');
    setTimeout(() => document.getElementById('promptRefineInput')?.focus(), 100);
  },

  /** 提交配图优化要求并重新生成全部 */
  async submitPromptRefine() {
    const refineText = document.getElementById('promptRefineInput').value.trim();
    if (!refineText) {
      this.showStatus('请先写下你的优化要求', 'warning');
      return;
    }
    this.state.promptRefineText = refineText;
    this.closeModal('promptRefineModal');

    const llmConfig = Config.getDefault('llm');
    if (!llmConfig) {
      this.showStatus('❌ 未配置 LLM API', 'error');
      return;
    }

    const title = this.state.selectedTitle || '建水紫陶';
    const article = this.state.articleEdited || this.state.article;
    const existingPrompts = this.state.imagePrompts;

    // 把现有提示词也传给 AI，让它在原有基础上优化
    const existingText = existingPrompts.map((p, i) => {
      let info = `#${i + 1} 场景：${p.scene || ''}，风格：${p.style || ''}，参考：${p.ref || ''}`;
      if (p.title_text) info += `，封面文字：${p.title_text}`;
      return info;
    }).join('\n');

    document.getElementById('promptLoading').classList.remove('hidden');
    document.getElementById('btnGenPrompts').disabled = true;
    const regenBtn = document.getElementById('btnRegenPrompts');
    if (regenBtn) regenBtn.disabled = true;
    const refineBtn = document.getElementById('btnPromptRefine');
    if (refineBtn) refineBtn.disabled = true;

    let fullText = '';
    try {
      await LLM.chatStream(
        llmConfig,
        LLM.msgs(`你是老郭说宝的配图策划师。用户对现有的配图提示词不满意，提出了优化要求。
请根据文章内容和用户要求，重新生成全部配图提示词。

要求：
1. 每张提示词包含：画面内容、风格参考、画幅标注
2. 画幅统一标注 "9:16竖版"
3. 每张末尾加 "9:16竖版" 字样
4. 产品本身不需要配图（已有实物照片），配图用于辅助场景意境
5. 画面要有审美、有意境，适合文生图模型
6. 在原有提示词基础上优化，不要完全脱离原有风格
7. 第1张如果是封面提示词，scene 要描绘与文章相关的画面作为视觉主体（不可脱离文章凭空创作），标题文字叠印其上；必须保留并优化 title_text 字段（封面提炼文字，不超过15字）
8. 所有提示词（含封面）的灵感都必须来源于文章内容

用户的优化要求：
${refineText}

返回 JSON 数组，格式：
[{"scene":"画面内容描述","style":"风格参考，如中国风、水墨、工笔","ref":"参考艺术家或风格","title_text":"封面提炼文字"}, ...]

只返回 JSON，不要其他文字。`,
`文章标题：${title}

文章内容：
${article.substring(0, 1500)}

现有配图提示词（请在此基础上优化）：
${existingText}

用户的优化要求：${refineText}

请生成 ${existingPrompts.length} 张配图提示词。第1张为封面提示词：scene 要描绘与文章相关的画面作为视觉主体（不可脱离文章凭空创作），标题文字叠印其上，必须包含 title_text 字段。`),
        chunk => { fullText += chunk; },
        { temperature: 0.85, max_tokens: 4096 }
      );

      const newPrompts = LLM.parseJSON(fullText);
      this.state.imagePrompts = newPrompts;
      this.state.promptChecked = newPrompts.map(() => false);
      this.renderStep6();
      this.updateFooter();
      this.showStatus('✅ 配图提示词已按照你的要求优化', 'success');
    } catch (err) {
      this.showStatus('❌ 配图优化失败：' + err.message, 'error');
    } finally {
      document.getElementById('promptLoading').classList.add('hidden');
      document.getElementById('btnGenPrompts').disabled = false;
      const regenBtn2 = document.getElementById('btnRegenPrompts');
      if (regenBtn2) regenBtn2.disabled = false;
      const refineBtn2 = document.getElementById('btnPromptRefine');
      if (refineBtn2) refineBtn2.disabled = false;
    }
  },

  // ---------- 步骤7：导出 ----------
  renderStep7() {
    const el = document.getElementById('mainContent');
    const title = this.state.selectedTitle || '建水紫陶文章';
    const article = this.state.articleEdited || this.state.article;
    const prompts = this.state.imagePrompts;

    // 拼装最终输出
    let output = `# ${title}\n\n${article}\n`;
    if (prompts && prompts.length > 0) {
      output += `\n## 配图提示词\n\n`;
      prompts.forEach((p, i) => {
        const isCover = i === 0 && p.title_text;
        if (isCover) {
          // 封面提示词：突出显示标题文字
          output += `**封面** — ${p.scene || ''}`;
          if (p.style) output += `，风格参考：${p.style}`;
          if (p.ref) output += `，参考：${p.ref}`;
          output += `，9:16竖版\n> 封面文字：**${p.title_text}**\n\n`;
        } else {
          let line = `${i + 1}. ${p.scene || ''}`;
          if (p.style) line += `，风格参考：${p.style}`;
          if (p.ref) line += `，参考：${p.ref}`;
          line += `，9:16竖版`;
          output += line + `\n\n`;
        }
      });
    }
    this.state.finalOutput = output;

    el.innerHTML = `
      <div class="step-panel">
        <div class="step-header">
          <h2>📥 第七步：导出</h2>
          <p class="step-desc">预览完整文章，下载 .md 文件，或复制全文粘贴到 Bear。</p>
        </div>

        <div class="export-actions">
          <button class="btn btn-success btn-lg" onclick="App.saveToObsidian()">
            📝 保存到 Obsidian
          </button>
          <button class="btn btn-secondary btn-lg" onclick="App.downloadMarkdown()">
            📥 下载 .md 文件
          </button>
          <button class="btn btn-secondary btn-lg" onclick="App.copyArticle()">
            📋 复制全文
          </button>
          <button class="btn btn-secondary" onclick="App.showExportPreview()">
            👁️ 预览
          </button>
        </div>

        <div class="export-summary">
          <div class="summary-item">
            <span class="summary-label">标题</span>
            <span class="summary-value">${title}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">字数</span>
            <span class="summary-value">${article.length} 字</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">配图提示词</span>
            <span class="summary-value">${prompts ? prompts.length : 0} 张</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">已走过</span>
            <span class="summary-value">
              ${this.state.selectedTopic ? '✅ 选题' : '⬜ 选题'}
              ${this.state.imageDesc ? ' ✅ 识图' : ' ⬜ 识图'}
              ✅ 正文 ✅ 修改 ✅ 标题
              ${prompts.length > 0 ? ' ✅ 配图' : ' ⬜ 配图'}
            </span>
          </div>
        </div>
      </div>
    `;
  },

  showExportPreview() {
    const body = document.getElementById('exportBody');
    body.innerHTML = `<div class="article-display">${this.markdownToHtml(this.state.finalOutput)}</div>`;
    this.openModal('exportModal');
  },

  downloadMarkdown() {
    const content = this.state.finalOutput;
    if (!content) {
      this.showStatus('没有可导出的内容', 'error');
      return;
    }
    const title = this.state.selectedTitle || '建水紫陶文章';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}_${title}.md`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showStatus(`✅ 已下载: ${filename}`, 'success');
  },

  copyArticle() {
    const content = this.state.finalOutput;
    if (!content) {
      this.showStatus('没有可复制的内容', 'error');
      return;
    }
    navigator.clipboard.writeText(content).then(() => {
      this.showStatus('📋 已复制全文，可直接粘贴到 Bear', 'success');
    }).catch(() => {
      this.showStatus('复制失败，请手动复制', 'error');
    });
  },

  // ====================== 保存到 Obsidian ======================

  _obsidianDirHandle: null,

  async _initObsidianDB() {
    if (this._obsidianDB) return this._obsidianDB;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('laoguo_obsidian', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => { this._obsidianDB = req.result; resolve(this._obsidianDB); };
      req.onerror = () => reject(req.error);
    });
  },

  async _loadObsidianHandle() {
    if (this._obsidianDirHandle) return this._obsidianDirHandle;
    try {
      const db = await this._initObsidianDB();
      return await new Promise((resolve) => {
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get('dirHandle');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  async _saveObsidianHandle(handle) {
    this._obsidianDirHandle = handle;
    try {
      const db = await this._initObsidianDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(handle, 'dirHandle');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* 内存里已有，不影响 */ }
  },

  async _pickObsidianFolder() {
    if (!('showDirectoryPicker' in window)) {
      this.showStatus('⚠️ 当前浏览器不支持直接保存到文件夹，请用 Chrome 或 Edge', 'warning');
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this._saveObsidianHandle(handle);
      return handle;
    } catch (e) {
      if (e.name !== 'AbortError') this.showStatus('❌ 选择文件夹失败：' + e.message, 'error');
      return null;
    }
  },

  async saveToObsidian() {
    const content = this.state.finalOutput;
    if (!content) {
      this.showStatus('没有可保存的内容', 'error');
      return;
    }

    // 1. 获取或选择目录
    let dirHandle = await this._loadObsidianHandle();
    if (dirHandle) {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        dirHandle = await this._pickObsidianFolder();
        if (!dirHandle) return;
      }
    } else {
      dirHandle = await this._pickObsidianFolder();
      if (!dirHandle) return;
    }

    // 2. 构建文件名：日期_标题.md（去掉文件系统不允许的字符）
    const title = this.state.selectedTitle || '建水紫陶文章';
    const date = new Date().toISOString().split('T')[0];
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${date}_${safeName}.md`;

    // 3. 写入文件
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      this.showStatus(`✅ 已保存到 Obsidian: ${filename}`, 'success');
      // 自动加入知识库（如果该文件夹在知识库中）
      if (typeof ObsidianKB !== 'undefined') {
        const added = ObsidianKB.addExternalArticle(dirHandle.name, {
          title,
          category: this.state.currentCategory || '未分类',
          content
        });
        if (added) {
          console.log(`[ObsidianKB] 已自动加入知识库: ${title}`);
        }
      }
    } catch (e) {
      this.showStatus('❌ 保存失败：' + e.message, 'error');
    }
  },

  // ====================== 设置面板 ======================
  toggleSettings(e) {
    const panel = document.getElementById('settingsPanel');
    if (e && e.target === panel && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      this.renderSettings();
    }
  },

  renderSettings() {
    const body = document.getElementById('settingsBody');
    const configs = Config.loadAll();

    body.innerHTML = `
      <div class="settings-section">
        <h3>🤖 LLM 配置</h3>
        <p class="text-light">用于生成正文、标题、配图提示词</p>
        ${this.renderConfigCards(configs.filter(c => c.type === 'llm'), 'llm')}
        <button class="btn btn-secondary btn-sm" onclick="App.addConfig('llm')">➕ 添加 LLM 配置</button>
      </div>

      <div class="settings-section">
        <h3>👁️ 视觉 API 配置</h3>
        <p class="text-light">用于图片识别，默认调本地 http://127.0.0.1:8000</p>
        ${this.renderConfigCards(configs.filter(c => c.type === 'vision'), 'vision')}
        <button class="btn btn-secondary btn-sm" onclick="App.addConfig('vision')">➕ 添加视觉配置</button>
      </div>

      <div class="settings-section">
        <h3>📖 Obsidian 知识库</h3>
        <p class="text-light">连接 Obsidian 文件夹，自动读取归档文章作为写作参考（替代硬编码的「已写方向」）</p>
        ${this.renderObsidianKB()}
      </div>

      <div class="settings-section">
        <h3>🔧 故障排查</h3>
        <p class="text-light">如果本地 API 因 CORS 无法调用，试试用 HTTP 服务器打开页面：</p>
        <pre class="code-block">cd 老郭网页版V2 && python3 -m http.server 8080</pre>
        <p class="text-light">然后在浏览器打开 <code>http://localhost:8080</code></p>
      </div>
    `;
  },

  renderConfigCards(configs, type) {
    if (configs.length === 0) return '<p class="text-light">暂无配置</p>';
    return configs.map(c => `
      <div class="config-card ${c.isDefault ? 'default' : ''}">
        <div class="config-card-header">
          <strong>${c.name}</strong>
          <span class="config-badge">${c.isDefault ? '默认' : ''}</span>
        </div>
        <div class="config-card-body">
          <div class="config-field">
            <label>Endpoint</label>
            <input type="text" value="${c.baseUrl}" onchange="App.updateConfigField('${c.id}','baseUrl',this.value)">
          </div>
          <div class="config-field">
            <label>模型</label>
            <input type="text" value="${c.model}" onchange="App.updateConfigField('${c.id}','model',this.value)">
          </div>
          <div class="config-field">
            <label>API Key</label>
            <input type="password" value="${c.key || ''}" placeholder="可选" onchange="App.updateConfigField('${c.id}','key',this.value)">
          </div>
        </div>
        <div class="config-card-actions">
          <button class="btn btn-sm ${c.isDefault ? 'btn-secondary' : 'btn-primary'}"
                  onclick="App.setDefaultConfig('${c.id}')"
                  ${c.isDefault ? 'disabled' : ''}>
            ${c.isDefault ? '✓ 当前默认' : '设为默认'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteConfig('${c.id}')">删除</button>
        </div>
      </div>
    `).join('');
  },

  addConfig(type) {
    const id = 'cfg_' + Date.now();
    const newConfig = {
      id,
      name: type === 'llm' ? '新 LLM' : '新视觉',
      type,
      baseUrl: type === 'llm' ? 'https://api.openai.com/v1' : 'http://127.0.0.1:8000',
      model: type === 'llm' ? 'gpt-4o' : 'Qwen3.5-4B-MLX-4bit',
      key: '',
      isDefault: false
    };
    Config.upsert(newConfig);
    this.renderSettings();
  },

  updateConfigField(id, field, value) {
    const config = Config.get(id);
    if (!config) return;
    config[field] = value;
    Config.upsert(config);
  },

  setDefaultConfig(id) {
    Config.setDefault(id);
    this.renderSettings();
    this.showStatus('✅ 默认配置已更新', 'success');
  },

  deleteConfig(id) {
    if (!confirm('确定删除这个配置？')) return;
    Config.remove(id);
    this.renderSettings();
  },

  // ====================== 工具函数 ======================

  /** 简易 markdown → HTML */
  markdownToHtml(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\|(.+)\|$/gm, (match) => {
        // 表格行
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => /^[-:\s]+$/.test(c))) return '<tr class="sep">';
        return '<tr><td>' + cells.join('</td><td>') + '</td></tr>';
      });

    // 列表包裹
    html = html.replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>');

    // 表格包裹
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, m => '<table>' + m.replace('<tr class="sep">', '') + '</table>');

    // 段落
    const lines = html.split('\n');
    let result = '';
    for (const line of lines) {
      if (line.startsWith('<') || line.trim() === '') {
        result += line + '\n';
      } else {
        result += '<p>' + line + '</p>\n';
      }
    }
    return result;
  },

  showStatus(message, type = 'info') {
    const status = document.getElementById('statusMessage');
    if (status) {
      status.className = `status status-${type}`;
      status.textContent = message;
      status.classList.remove('hidden');
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => status.classList.add('hidden'), type === 'error' ? 8000 : 5000);
    }
  },

  openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
    document.body.style.overflow = '';
  },

  /** 自动存档：保存当前工作进度 */
  saveDraft() {
    try {
      localStorage.setItem('laoguo_v2_draft_full', JSON.stringify({
        article: this.state.article,
        articleEdited: this.state.articleEdited,
        selectedTitle: this.state.selectedTitle,
        imagePrompts: this.state.imagePrompts,
        imageDesc: this.state.imageDesc,
        step: this.state.step,
        savedAt: Date.now()
      }));
    } catch (e) { /* */ }
  },

  /** 恢复自动存档 */
  loadDraft() {
    try {
      const raw = localStorage.getItem('laoguo_v2_draft_full');
      if (raw) {
        const data = JSON.parse(raw);
        // 只恢复24小时内的存档
        if (data.savedAt && Date.now() - data.savedAt < 86400000) {
          if (data.article) this.state.article = data.article;
          if (data.articleEdited) this.state.articleEdited = data.articleEdited;
          if (data.selectedTitle) this.state.selectedTitle = data.selectedTitle;
          if (data.imagePrompts) this.state.imagePrompts = data.imagePrompts;
          if (data.imageDesc) this.state.imageDesc = data.imageDesc;
        }
      }
    } catch (e) { /* */ }
  },

  /** 保存选题列表到 localStorage */
  saveTopicsToStorage() {
    try {
      localStorage.setItem('laoguo_v2_topics', JSON.stringify({
        topics: this.state.topics,
        savedAt: Date.now()
      }));
    } catch (e) { /* */ }
  },

  /** 从 localStorage 恢复选题列表 */
  loadTopicsFromStorage() {
    try {
      const raw = localStorage.getItem('laoguo_v2_topics');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.topics && data.topics.length > 0) {
          this.state.topics = data.topics;
        }
      }
    } catch (e) { /* */ }
  },

  /** 保存灵感草稿到 localStorage */
  saveInspirationDraft() {
    try {
      localStorage.setItem('laoguo_v2_draft', JSON.stringify({
        inspiration: this.state.inspiration,
        selectedTopic: this.state.selectedTopic
      }));
    } catch (e) { /* ignore */ }
  },

  /** 加载灵感草稿 */
  loadInspirationDraft() {
    try {
      const raw = localStorage.getItem('laoguo_v2_draft');
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.inspiration) this.state.inspiration = draft.inspiration;
        if (draft.selectedTopic) this.state.selectedTopic = draft.selectedTopic;
      }
    } catch (e) { /* ignore */ }
  },

  /** 保存文章到历史记录 */
  saveToHistory() {
    const title = this.state.selectedTitle || '未命名文章';
    const article = this.state.articleEdited || this.state.article;
    if (!article) return;

    const record = {
      id: Date.now().toString(),
      title,
      category: this.state.currentCategory,
      preview: article.substring(0, 150),
      article,
      imagePrompts: this.state.imagePrompts,
      selectedTopic: this.state.selectedTopic,
      createdAt: new Date().toISOString()
    };

    let history = [];
    try {
      const raw = localStorage.getItem('laoguo_v2_history');
      if (raw) history = JSON.parse(raw);
    } catch (e) { /* */ }
    history.unshift(record);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('laoguo_v2_history', JSON.stringify(history));
  },

  /** 渲染历史记录列表 */
  renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    let history = [];
    try {
      const raw = localStorage.getItem('laoguo_v2_history');
      if (raw) history = JSON.parse(raw);
    } catch (e) { /* */ }

    if (history.length === 0) {
      container.innerHTML = '<p class="text-light" style="padding:20px;text-align:center">暂无历史文章</p>';
      return;
    }

    container.innerHTML = history.map((item, i) => `
      <div class="history-item" onclick="App.loadHistoryItem(${i})">
        <div class="history-item-title">${item.title}</div>
        <div class="history-item-meta">${new Date(item.createdAt).toLocaleString('zh-CN')} · ${item.category || ''}</div>
        <div class="history-item-preview">${item.preview}...</div>
      </div>
    `).join('');
  },

  /** 加载历史文章 */
  loadHistoryItem(index) {
    let history = [];
    try {
      const raw = localStorage.getItem('laoguo_v2_history');
      if (raw) history = JSON.parse(raw);
    } catch (e) { /* */ }
    if (!history[index]) return;

    const item = history[index];
    this.state.article = item.article;
    this.state.articleEdited = item.article;
    this.state.imagePrompts = item.imagePrompts || [];
    this.state.selectedTitle = item.title;
    this.state.selectedTopic = item.selectedTopic || '';
    this.state.finalOutput = `# ${item.title}\n\n${item.article}\n`;
    this.goToStep(7); // 跳到导出预览
    this.showStatus('✅ 已加载历史文章', 'success');
  },

  /** 绑定全局事件 */
  bindEvents() {
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.nextStep();
      }
    });
  }
};

// ====================== 启动 ======================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
