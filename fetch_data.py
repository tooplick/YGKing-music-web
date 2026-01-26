import urllib.request
import json
import urllib.parse

keyword = "传奇 (2023 JJ20世界巡回演唱会武汉站"
url = f"https://api.ygking.top/api/search?keyword={urllib.parse.quote(keyword)}&type=song&num=1&page=1"

try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
