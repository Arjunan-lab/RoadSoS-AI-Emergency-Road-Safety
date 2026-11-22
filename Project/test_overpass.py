import requests
lat = 13.0827
lng = 80.2707
query = f'[out:json];node(around:8000,{lat},{lng})["amenity"~"hospital|clinic"];out 8;'
headers = {
	"User-Agent": "RoadSoS_Emergency_App/1.0 (contact@roadsos.test)",
	"Accept": "application/json",
}
res = requests.post('https://overpass-api.de/api/interpreter', data={'data': query}, headers=headers, timeout=10)
print(res.status_code)
print(res.json() if res.status_code == 200 else res.text)
