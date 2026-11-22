"""
Direct Gemini API test to diagnose why streaming is failing.
"""
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv(r'f:\Coding\Antigravity\AI Road Safety Hackathon\backend\.env')
API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MODEL = os.getenv("GEMINI_MODELS", "gemini-2.5-flash").split(",")[0].strip() or "gemini-2.5-flash"
print(f"API Key found: {bool(API_KEY)}")

url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent?alt=sse&key={API_KEY}"

payload = {
    "system_instruction": {"parts": [{"text": "You are a medical AI. Return ONLY valid JSON with keys: steps (array of 3 strings), severity (string), triage_category (string), confidence (float)."}]},
    "contents": [{"parts": [{"text": "Road accident injury: severe bleeding from a leg wound. Provide immediate first-aid steps."}]}],
    "generationConfig": {"temperature": 0.15},
}

print(f"\nCalling: {url[:80]}...")
full_text = ""
with httpx.Client(timeout=30) as client:
    with client.stream("POST", url, json=payload) as resp:
        print(f"HTTP Status: {resp.status_code}")
        if resp.status_code != 200:
            body = resp.read()
            try:
                text = body.decode("utf-8", errors="replace")
            except AttributeError:
                text = str(body)
            print(f"Error body: {text[:1000]}")
        else:
            for line in resp.iter_lines():
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    if data_str:
                        try:
                            chunk = json.loads(data_str)
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                token = parts[0].get("text", "") if parts else ""
                                if token:
                                    full_text += token
                                    print(f"TOKEN: {repr(token[:50])}")
                        except Exception as e:
                            print(f"Parse error: {e} | line: {line[:100]}")

print(f"\nFull response ({len(full_text)} chars):")
print(full_text[:500])
