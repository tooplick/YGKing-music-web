import urllib.request

urls = [
    "https://y.qq.com/music/photo_new/T062R300x300M000060P0rWL1eOJah.jpg",
    "https://y.qq.com/music/photo_new/T062R300x300M0000048JRIA3PGl5x.jpg"
]

for url in urls:
    try:
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req) as response:
            print(f"{url}: {response.status}")
    except urllib.error.HTTPError as e:
        print(f"{url}: {e.code}")
    except Exception as e:
        print(f"{url}: {e}")
