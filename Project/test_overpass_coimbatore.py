import asyncio
import httpx

async def fetch_hospitals():
    lat, lng, radius = 11.0786, 77.1430, 10000
    query = f"""
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lng});
      way["amenity"="hospital"](around:{radius},{lat},{lng});
      relation["amenity"="hospital"](around:{radius},{lat},{lng});
    );
    out center body;
    """
    headers = {'User-Agent': 'RoadSoS_Vanguard/1.0 (emergency_hackathon_demo)'}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post('https://overpass-api.de/api/interpreter', data={'data': query}, headers=headers)
            print(resp.status_code)
            if resp.status_code != 200:
                print(resp.text[:500])
            else:
                data = resp.json()
                print('Success, got', len(data.get('elements', [])), 'elements')
    except Exception as e:
        print('Error:', e)

if __name__ == '__main__':
    asyncio.run(fetch_hospitals())
