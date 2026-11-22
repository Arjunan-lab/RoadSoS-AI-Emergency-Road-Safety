"""
Test different Gemini model names to find which one works.
"""
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv(r'f:\Coding\Antigravity\AI Road Safety Hackathon\backend\.env')
API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-05-20",
]

payload = {
    "contents": [{"parts": [{"text": "Say hello in one word."}]}],
    "generationConfig": {"temperature": 0.1},
}

for model in models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                print(f"OK   [{model}] -> {repr(text.strip())}")
            else:
                err = resp.json().get("error", {}).get("message", resp.text[:80])
                print(f"FAIL [{model}] -> {resp.status_code}: {err}")
    except Exception as e:
        print(f"ERR  [{model}] -> {e}")
