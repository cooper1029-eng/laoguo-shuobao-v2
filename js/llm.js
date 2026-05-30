/* ============================================================
   llm.js — 通用 LLM 调用层（OpenAI 兼容格式）
   ============================================================ */

const LLM = {

  /** 流式调用 LLM，每收到一块内容调用 onChunk(text) */
  async chatStream(config, messages, onChunk, options = {}) {
    if (!config || !config.baseUrl) throw new Error('API 配置不完整，请先在设置中配置');

    const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
    const body = Config.buildChatBody(config, messages, { ...options, stream: true });

    const response = await fetch(url, {
      method: 'POST',
      headers: Config.buildHeaders(config),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        errMsg = err.error?.message || err.error || errMsg;
      } catch (e) { /* ignore */ }
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
          if (content && onChunk) onChunk(content);
        } catch (e) { /* 跳过解析错误的行 */ }
      }
    }
  },

  /** 非流式调用，直接返回完整文本 */
  async chat(config, messages, options = {}) {
    let result = '';
    await this.chatStream(config, messages, chunk => { result += chunk; }, { ...options, stream: false });
    // stream:false 走非流式 endpoint
    if (!result) {
      const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
      const body = Config.buildChatBody(config, messages, { ...options, stream: false });
      const response = await fetch(url, {
        method: 'POST',
        headers: Config.buildHeaders(config),
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const err = await response.json(); errMsg = err.error?.message || err.error || errMsg; } catch (e) { /* */ }
        throw new Error(errMsg);
      }
      const json = await response.json();
      result = json.choices?.[0]?.message?.content || '';
    }
    return result;
  },

  /** 生成系统+用户消息数组 */
  msgs(system, user) {
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  },

  /** 从响应中解析 JSON（处理模型可能包裹在 markdown 代码块中） */
  parseJSON(text) {
    // 尝试直接解析
    try { return JSON.parse(text); } catch (e) { /* fall through */ }
    // 尝试从 ```json ... ``` 中提取
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch (e) { /* fall through */ }
    }
    // 尝试找第一组 [ ] 或 { }
    const arrMatch = text.match(/\[[\s\S]*?\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch (e) { /* */ }
    }
    throw new Error('AI 返回格式异常，无法解析');
  }
};
