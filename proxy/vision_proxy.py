#!/usr/bin/env python3
"""
老郭说宝 — 视觉代理服务器（纯标准库，无需安装任何包）

用法：
  python3 proxy/vision_proxy.py

然后网页端会自动走这个代理。按 Ctrl+C 停止。
"""

import http.server
import json
import base64
import os
import re
import sys
import urllib.request
import urllib.error
from urllib.parse import urlparse

# ===== 配置 =====
PROXY_HOST = "127.0.0.1"
PROXY_PORT = 8765
OMLX_URL = "http://127.0.0.1:8000/v1/chat/completions"
OMLX_MODEL = "Qwen3.5-4B-MLX-4bit"
OMLX_API_KEY = os.environ.get("OMLX_API_KEY", "123456")

SYSTEM_PROMPT = """你是建水紫陶鉴定专家。用中文描述图片中的紫陶器物。

直接按以下格式输出，不要思考过程：
1. **器物类型**：
2. **整体外观**：
3. **装饰图案**：
4. **工艺特征**：
5. **作者风格**：
6. **写作角度**："""


class VisionProxyHandler(http.server.BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/v1/vision":
            self._json(404, {"error": "仅支持 POST /v1/vision"})
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            self._json(400, {"error": f"JSON 解析失败: {e}"})
            return

        image_data_url = data.get("image")
        if not image_data_url:
            self._json(400, {"error": "缺少 image 字段"})
            return

        context = data.get("context", "")

        # 提取纯 base64
        raw_b64 = image_data_url.split(",", 1)[1] if "," in image_data_url else image_data_url

        img_size = len(raw_b64)
        print(f"[代理] 收到图片: {img_size} bytes base64 (~{img_size * 3 // 4} bytes raw)" +
              (f" | 背景: {context[:50]}..." if context else ""), flush=True)

        try:
            result = self._call_omlx(raw_b64, context)
            self._json(200, {"text": result})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            self._json(500, {"error": f"oMLX 返回 {e.code}: {err_body[:200]}"})
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _call_omlx(self, image_b64: str, context: str = "") -> str:
        """调用 oMLX 视觉 API"""
        system_text = SYSTEM_PROMPT
        if context:
            system_text += f"\n\n用户提供了以下背景信息，识图时请重点观察与之相关的细节：\n{context}"

        payload = json.dumps({
            "model": OMLX_MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": system_text},
                    {"type": "image_url", "image_url": {"url": f"data:image/{'jpeg' if image_b64.startswith('/9j/') else 'png'};base64,{image_b64}"}},
                ],
            }],
            "stream": False,
            "max_tokens": 2048,
            "temperature": 0.01,
            "chat_template_kwargs": {"enable_thinking": False},
        }).encode("utf-8")

        req = urllib.request.Request(
            OMLX_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OMLX_API_KEY}",
            },
        )

        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read())
        text = data["choices"][0]["message"]["content"]

        # 清洗 Thinking Process
        cn = re.search(r"\d+\.\s*\*\*[\u4e00-\u9fff]", text)
        if cn:
            text = text[cn.start():]

        return text.strip()

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")

    def log_message(self, fmt, *args):
        print(f"[代理] {args[0]} {args[1]}", flush=True)


if __name__ == "__main__":
    server = http.server.HTTPServer((PROXY_HOST, PROXY_PORT), VisionProxyHandler)
    print(f"🚀 视觉代理已启动: http://{PROXY_HOST}:{PROXY_PORT}  →  oMLX:{OMLX_MODEL}", flush=True)
    print(f"   Ctrl+C 停止", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 已停止", flush=True)
        server.server_close()
