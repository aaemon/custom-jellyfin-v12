"""Fetch TMDb daily trending IDs; credentials remain server-side."""
import argparse
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request
from trending_ready import prepare

def fetch_feed(settings):
    token = settings.get('tmdb_bearer_token')
    if not token:
        raise ValueError('TMDb bearer token is not configured')
    language = settings.get('language', 'en-US')
    result = {'movies': [], 'tv': [], 'popularMovies': [], 'topRatedMovies': [],
              'popularTv': [], 'topRatedTv': [], 'updatedAt': time.time(), 'timeWindow': 'day'}
    feeds = [
        ('movie', 'movies', 'trending/movie/day'),
        ('movie', 'popularMovies', 'movie/popular'),
        ('movie', 'topRatedMovies', 'movie/top_rated'),
        ('tv', 'tv', 'trending/tv/day'),
        ('tv', 'popularTv', 'tv/popular'),
        ('tv', 'topRatedTv', 'tv/top_rated'),
    ]
    for media_type, key, endpoint in feeds:
        seen = set()
        for page in range(1, int(settings.get('pages', 10)) + 1):
            query = urllib.parse.urlencode({'language': language, 'page': page})
            request = urllib.request.Request(
                'https://api.themoviedb.org/3/' + endpoint + '?' + query,
                headers={'Authorization': 'Bearer ' + token, 'accept': 'application/json'})
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
            if page >= data.get('total_pages', page) or not data.get('results'):
                break
    return result

def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(path)

def prepare_with_retry(feed, base, attempts=12):
    # Jellyfin's setup listener can answer before the final server listener has
    # replaced it. Retry across that startup transition instead of waiting six
    # hours after a single connection failure.
    for attempt in range(attempts):
        try:
            return prepare(feed, base=base)
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(5)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--config', default='/trending/settings.json')
    parser.add_argument('--output', default='/jellyfin/jellyfin-web/bijoy-trending.json')
    args = parser.parse_args()
    config = Path(args.config)
    output = Path(args.output)
    cached = config.parent / 'feed.json'
    ready_cached = config.parent / 'ready.json'
    ready_output = output.parent / 'bijoy-trending-ready.json'
    if cached.exists():
        output.write_bytes(cached.read_bytes())
    if ready_cached.exists():
        ready_output.write_bytes(ready_cached.read_bytes())
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
        # The server may still be booting when this child process starts.
        base = os.environ.get('JELLYFIN_INTERNAL_URL', 'http://127.0.0.1:8096')
        for attempt in range(60):
            try:
                with urllib.request.urlopen(base + '/System/Info/Public', timeout=5) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(2)
        try:
            ready = prepare_with_retry(json.loads(cached.read_text()), base=base)
            save(ready_cached, ready)
            save(ready_output, ready)
        except Exception as error:
            print('[trending] Ready-list preparation failed (' + type(error).__name__
                  + '); keeping the previous shared list.', flush=True)
            if args.once:
                raise
        if args.once:
            return
        time.sleep(21600)

if __name__ == '__main__':
    main()
