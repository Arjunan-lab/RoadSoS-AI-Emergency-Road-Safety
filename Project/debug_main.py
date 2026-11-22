"""
Fix the JSON parsing section in main.py to use a robust multi-strategy extractor.
"""
path = r'f:\Coding\Antigravity\AI Road Safety Hackathon\backend\main.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''        # Streaming complete — extract JSON from full response
        if not full_response.strip():
            raise ValueError("Empty response from Gemini")

        # Strip markdown code fences if Gemini wraps in ```json ... ```
        clean = full_response.strip()
        json_match = re.search(r\'\\{.*\\}\', clean, re.DOTALL)
        if json_match:
            clean = json_match.group(0)

        parsed = json.loads(clean)
        steps = [str(s) for s in parsed.get("steps", [])[:3]]
        if not steps:
            raise ValueError("Gemini returned no steps")
            
        logger.info(f"[Stream] \\u2705 Done \\u2014 {len(steps)} steps, severity={parsed.get(\'severity\')}")
        yield f"data: {json.dumps({\'done\': True, \'steps\': steps, \'severity\': parsed.get(\'severity\', \'moderate\'), \'triage_category\': parsed.get(\'triage_category\', \'yellow\'), \'confidence\': float(parsed.get(\'confidence\', 0.85)), \'source\': \'gemini-2.5-flash\'})}\\\\n\\\\n"
        await asyncio.sleep(0.1)

    except Exception as e:
        logger.error(f"[Stream] Gemini failed: {e}")
        if full_response:
            logger.error(f"[Stream] Raw was: {repr(full_response[:500])}")
        if require_gemini:
            raise
        fb = _MOCK_TRIAGE.copy()
        yield f"data: {json.dumps({\'done\': True, **fb, \'source\': \'mock\'})}\\\\n\\\\n"
        await asyncio.sleep(0.1)'''

# Find and show the actual text around line 293
lines = content.split('\n')
for i, line in enumerate(lines[290:325], start=291):
    print(f"{i}: {repr(line)}")
