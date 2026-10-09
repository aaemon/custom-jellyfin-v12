"""Prepare one shared ID-only list; clients still authorize card-detail reads."""
from concurrent.futures import ThreadPoolExecutor
import json
import secrets
import sqlite3
import urllib.parse
import urllib.request

def matching_ids(feed, inventory, kind):
    index = {}
    id_to_tmdb = {}
    for item in inventory:
        if item.get('Type') != kind or item.get('IsVirtualItem') or item.get('LocationType') in ('Virtual', 'Remote'):
            continue
        identifier = next((str(value) for name, value in item.get('ProviderIds', {}).items()
                           if name.lower() == 'tmdb'), None)
        if identifier:
            index.setdefault(identifier, []).append(item['Id'])
            id_to_tmdb[item['Id']] = identifier
    tiers = feed if feed and isinstance(feed[0], list) else [feed]
    selected, seen = [], set()
    for tier in tiers:
        for identifier in tier:
            for item_id in index.get(str(identifier), []):
                tmdb = id_to_tmdb.get(item_id, str(identifier))
                if tmdb not in seen:
                    seen.add(tmdb)
                    selected.append(item_id)
    return selected

def four_k_movie_ids(request, user_id):
    result, start = [], 0
    while True:
        items = request('/Items', {'userId': user_id, 'recursive': 'true',
            'includeItemTypes': 'Movie', 'is4K': 'true',
            'excludeLocationTypes': 'Virtual,Remote', 'fields': 'MediaSourceCount',
            'enableImages': 'false', 'enableUserData': 'false', 'startIndex': start,
            'limit': 2000, 'enableTotalRecordCount': 'false'}).get('Items', [])
        result.extend(item['Id'] for item in items if item.get('Id'))
        if len(items) < 2000:
            return list(dict.fromkeys(result))
        start += len(items)

def select_ready(request, user_id, movies, series, updated_at):
    visible = []
    identifiers = movies + series
    for start in range(0, len(identifiers), 100):
        response = request('/Items', {'userId': user_id, 'ids': ','.join(identifiers[start:start + 100]),
            'includeItemTypes': 'Movie,Series', 'excludeLocationTypes': 'Virtual,Remote',
            'fields': 'ProviderIds', 'enableImages': 'false', 'enableUserData': 'false', 'enableTotalRecordCount': 'false'})
        visible += response.get('Items', [])
    allowed = {item['Id'] for item in visible}
    by_id = {item['Id']: item for item in visible}
    def deduplicate(identifiers):
        result, seen = [], set()
        for identifier in identifiers:
            tmdb = next((str(value) for name, value in by_id[identifier].get('ProviderIds', {}).items()
                         if name.lower() == 'tmdb'), identifier)
            if tmdb not in seen:
                seen.add(tmdb)
                result.append(identifier)
        return result[:16]
    movie_ids = deduplicate([identifier for identifier in movies if identifier in allowed])
    tv_ids = [identifier for identifier in series if identifier in allowed]
    def playable(identifier):
        episodes = request('/Items', {'userId': user_id, 'parentId': identifier, 'recursive': 'true',
            'includeItemTypes': 'Episode', 'isMissing': 'false', 'excludeLocationTypes': 'Virtual,Remote',
            'enableImages': 'false', 'enableUserData': 'false', 'limit': 1, 'enableTotalRecordCount': 'false'})
        return bool(episodes.get('Items'))
    with ThreadPoolExecutor(max_workers=8) as executor:
        flags = list(executor.map(playable, tv_ids))
    tv_ids = deduplicate([identifier for identifier, available in zip(tv_ids, flags) if available])
    return {'movies': movie_ids, 'tv': tv_ids, 'updatedAt': updated_at}

def prepare(feed, base='http://127.0.0.1:8096', database='/config/data/jellyfin.db'):
    token, name = secrets.token_hex(16), '_bijoy_trending_prepare_' + secrets.token_hex(4)
    def request(route, params=None):
        url = base.rstrip('/') + route
        if params:
            url += '?' + urllib.parse.urlencode(params)
        with urllib.request.urlopen(urllib.request.Request(url,
            headers={'Authorization': 'MediaBrowser Token="' + token + '"'}), timeout=60) as response:
            return json.load(response)
    with sqlite3.connect(database, timeout=30) as db:
        db.execute('INSERT INTO ApiKeys (DateCreated,DateLastActivity,Name,AccessToken) '
                   "VALUES (datetime('now'),datetime('now'),?,?)", (name, token))
    try:
        users = [user for user in request('/Users') if not user.get('Policy', {}).get('IsDisabled')]
        user = next((user for user in users if user['Name'].lower() == 'bijoy'), next(iter(users), None))
        if not user:
            raise RuntimeError('No enabled user is available for the shared library lookup')
        inventory, start = [], 0
        while True:
            items = request('/Items', {'userId': user['Id'], 'recursive': 'true',
                'includeItemTypes': 'Movie,Series', 'excludeLocationTypes': 'Virtual,Remote',
                'fields': 'ProviderIds', 'enableImages': 'false', 'enableUserData': 'false',
                'startIndex': start, 'limit': 2000, 'sortBy': 'SortName', 'sortOrder': 'Ascending',
                'enableTotalRecordCount': 'false'}).get('Items', [])
            inventory += items
            if len(items) < 2000:
                break
            start += len(items)
        movie_tiers = [feed.get('movies', []), feed.get('popularMovies', []), feed.get('topRatedMovies', [])]
        tv_tiers = [feed.get('tv', []), feed.get('popularTv', []), feed.get('topRatedTv', [])]
        result = select_ready(request, user['Id'], matching_ids(movie_tiers, inventory, 'Movie'),
                              matching_ids(tv_tiers, inventory, 'Series'), feed['updatedAt'])
        result['fourkMovies'] = four_k_movie_ids(request, user['Id'])
        print('[trending] Prepared shared list: ' + str(len(result['movies'])) + ' movies, '
              + str(len(result['tv'])) + ' TV series, ' + str(len(result['fourkMovies']))
              + ' 4K movies.', flush=True)
        return result
    finally:
        with sqlite3.connect(database, timeout=30) as db:
            db.execute('DELETE FROM ApiKeys WHERE Name=? AND AccessToken=?', (name, token))
