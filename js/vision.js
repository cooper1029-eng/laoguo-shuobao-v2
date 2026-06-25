/* ============================================================
   vision.js — 图片识别模块
   支持两种模式：本地视觉API / 云端LLM视觉
   ============================================================ */

const Vision = {

  MAX_IMAGES: 3,

  /** 读取图片文件为 base64 DataURL */
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  },

  /** 压缩 base64 图片 */
  compressImage(dataUrl, maxSide = 640) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  },

  /** 清洗：丢掉 Thinking Process，只保留中文输出 */
  cleanResponse(text) {
    if (!text) return '';

    // 真实模型输出格式：
    //   Thinking Process:
    //   1.  **Analyze the Request:** (英文思考)
    //   ...
    //   1. **器物类型**： (中文结果)
    //
    // 关键：中文结果以 `数字. **中文**` 开头

    // 找 `数字. **中文**`——这是真正输出的起点
    const cnMatch = text.match(/\d+\.\s*\*\*[\u4e00-\u9fff]/);
    if (cnMatch) {
      return text.slice(cnMatch.index).trim();
    }

    // 备用：跳过多行思考，找到中文内容
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 跳过空行、英文行、Thinking/数字标题行
      if (!line) continue;
      if (/^Thinking/i.test(line)) continue;
      if (/^\d+\.\s+\*\*[A-Z]/.test(line)) continue;  // "1.  **Analyze**" - 英文章节
      if (/^\d+\.\s+[A-Z]/.test(line)) continue;       // "2.  Identify" - 英文章节
      // 遇到中文行，从这里开始
      if (/[\u4e00-\u9fff]/.test(line)) {
        return lines.slice(i).join('\n').trim();
      }
    }

    // 检测 text-only
    if (/text.?based|text.?only|cannot see|no image/i.test(text)) {
      throw new VisionError('local_fallback', '本地模型不支持识图');
    }

    return text.trim();
  },

  /** 调用本地视觉 API（通过 Python 代理转发，和 recognize.py 一样可靠） */
  async recognizeLocal(imageUrls, onProgress, context) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new VisionError('no_image', '请先上传图片');
    }

    if (onProgress) onProgress('正在识别图片...');

    // 只传纯 base64 数据，不传 "data:image/png;base64," 前缀
    const rawBase64 = imageUrls[0].split(',')[1] || imageUrls[0];
    const proxyUrl = 'http://127.0.0.1:8765/v1/vision';
    const body = { image: rawBase64 };
    if (context) body.context = context;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errMsg = `代理 ${response.status}`;
      try { const err = await response.json(); errMsg = err.error || errMsg; } catch (e) { /* */ }
      throw new VisionError('proxy_error', errMsg);
    }

    const data = await response.json();
    let text = data.text || '';
    text = this.cleanResponse(text);

    if (onProgress) onProgress('');
    return text;
  },

  /** 调用云端 LLM 视觉（如 GPT-4o、Claude 等支持图片的模型） */
  async recognizeCloud(imageUrls, onProgress, configOverride, context) {
    const config = configOverride || Config.getDefault('llm');
    if (!config) throw new VisionError('no_config', '未配置 LLM API');

    const systemPrompt = `你是建水紫陶鉴定专家。用中文描述图片中的紫陶器物。
${context ? `\n用户提供了以下背景信息，识图时请重点观察与之相关的细节：\n${context}\n` : ''}
按以下格式输出：
1. **器物类型**：
2. **整体外观**：
3. **装饰图案**：
4. **工艺特征**：
5. **作者风格**：
6. **写作角度**：`;

    const content = [];
    imageUrls.forEach(url => {
      const imgUrl = url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
      content.push({ type: 'image_url', image_url: { url: imgUrl } });
    });

    const userText = context
      ? `请根据用户的背景信息，重点描述这张紫陶器物的相关特征。`
      : `请描述这张紫陶器物的特征。`;
    content.push({ type: 'text', text: userText });

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content }
    ];

    if (onProgress) onProgress('正在通过云端视觉 API 识别...');

    // 兼容两种 endpoint 格式：
    //   完整路径：https://api.xiaomimimo.com/v1/chat/completions
    //   基础路径：https://api.deepseek.com  → 自动拼接 /v1/chat/completions
    let url = config.baseUrl.replace(/\/+$/, '');
    if (!url.endsWith('/chat/completions')) {
      url += url.includes('/v1') ? '/chat/completions' : '/v1/chat/completions';
    }

    const body = {
      model: config.model,
      messages,
      stream: false,
      max_tokens: 2048,
      temperature: 0.3
    };

    const headers = { 'Content-Type': 'application/json' };
    if (config.key) headers['Authorization'] = `Bearer ${config.key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const err = await response.json(); errMsg = err.error?.message || err.error || errMsg; } catch (e) { /* */ }
      throw new VisionError('api_error', `云端视觉 API 请求失败: ${errMsg}`);
    }

    const json = await response.json();
    let text = json.choices?.[0]?.message?.content || '';

    if (onProgress) onProgress('');
    return this.cleanResponse(text);
  },

  /** 主要识图入口：优先用配置的视觉 API，其次走本地代理 */
  async recognize(imageUrls, onProgress, context) {
    const visionConfig = Config.getDefault('vision');
    if (visionConfig && visionConfig.baseUrl) {
      return await this.recognizeCloud(imageUrls, onProgress, visionConfig, context);
    }
    return await this.recognizeLocal(imageUrls, onProgress, context);
  },

  /** 将图片文件转为压缩后的 base64 数组 */
  async processFiles(files) {
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/'));
    const results = [];
    for (const file of fileList) {
      if (results.length >= this.MAX_IMAGES) break;
      const dataUrl = await this.readAsDataURL(file);
      const compressed = await this.compressImage(dataUrl);
      results.push(compressed);
    }
    return results;
  }
};

/** 自定义错误类 */
class VisionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'VisionError';
  }
}
