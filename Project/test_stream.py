"""
Quick test: call the backend /triage/stream endpoint and print what comes back.
Run: python test_stream.py
"""
import httpx
import sys

BASE = "http://127.0.0.1:8000"

def test_stream(description: str):
    url = f"{BASE}/triage/stream"
    params = {"description": description}
    print(f"\n{'='*60}")
    print(f"Testing: {description!r}")
    print('='*60)
    tokens = []
    done_event = None
    with httpx.Client(timeout=40) as client:
        with client.stream("GET", url, params=params) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str:
                    continue
                import json
                data = json.loads(data_str)
                if data.get("done"):
                    done_event = data
                    break
                elif isinstance(data.get("token"), str) and data["token"]:
                    tokens.append(data["token"])
                    sys.stdout.write(data["token"])
                    sys.stdout.flush()

    print()
    if done_event:
        print(f"\nDONE -- source={done_event.get('source')}, severity={done_event.get('severity')}")
        for i, step in enumerate(done_event.get("steps", []), 1):
            print(f"  Step {i}: {step}")
    else:
        print("FAIL: No 'done' event received")

if __name__ == "__main__":
    test_stream("severe bleeding from a leg wound after a road accident")
    test_stream("bone fracture in the arm, visible deformity")
    test_stream("victim unconscious, not responding after crash")
    test_stream("severe burn on hands from car fire")
