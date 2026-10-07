"""Cache Seerr's daily trending IDs; no server credentials reach the browser."""
import argparse
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request

def fetch_feed(settings):
    result = {'movies': [], 'tv': [], 'updatedAt': time.time(), 'timeWindow': 'day'}
    for media_type, key in (('movie', 'movies'), ('tv', 'tv')):
        seen = set()
        for page in range(1, int(settings.get('pages', 10)) + 1):
            query = urllib.parse.urlencode({'mediaType': media_type, 'timeWindow': 'day', 'page': page})
            request = urllib.request.Request(settings['url'].rstrip('/') + '/api/v1/discover/trending?' + query,
                headers={'X-Api-Key': settings['api_key']})
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.load(response)
            for item in data.get('results', []):
                # Also handles Seerr releases that return a mixed trending feed.
                if item.get('mediaType', media_type) != media_type:
                    continue
                identifier = item.get('id')
                if identifier and identifier not in seen:
                    seen.add(identifier)
                    result[key].append(str(identifier))
            if page >= data.get('totalPages', page) or not data.get('results'):
                break
    return result

def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--config', default='/trending/settings.json')
    parser.add_argument('--output', default='/jellyfin/jellyfin-web/bijoy-trending.json')
    args = parser.parse_args()
    config = Path(args.config)
    output = Path(args.output)
    cached = config.parent / 'feed.json'
    if cached.exists():
        output.write_bytes(cached.read_bytes())
    while True:
        try:
            settings = json.loads(config.read_text())
            feed = fetch_feed(settings)
            save(cached, feed)
            save(output, feed)
            print('[trending] Updated daily feed: ' + str(len(feed['movies'])) + ' movie IDs, '
                  + str(len(feed['tv'])) + ' TV IDs.', flush=True)
        except Exception as error:
            # Do not print request headers, response contents, or credentials.
            print('[trending] Feed refresh failed (' + type(error).__name__ + '); keeping cached feed.', flush=True)
            if args.once:
                raise
        if args.once:
            return
        time.sleep(21600)

if __name__ == '__main__':
    main()
