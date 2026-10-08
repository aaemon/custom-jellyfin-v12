import importlib.util
import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

source = Path(os.environ.get('HELPER_ROOT', '/opt/bijoy')) / 'trending-feed.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('trending_feed', source)
feed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)

class Response:
    def __init__(self, data):
        self.data = data
    def read(self, *args):
        return json.dumps(self.data).encode()
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass

class TrendingTests(unittest.TestCase):
    def test_preparation_retries_the_server_startup_transition(self):
        with patch.object(feed, 'prepare', side_effect=[ConnectionError('starting'), {'movies':['id'],'tv':[]}]) as prepare:
            with patch.object(feed.time, 'sleep') as sleep:
                result = feed.prepare_with_retry({'movies':[],'tv':[]}, 'http://jellyfin:8096', attempts=3)
        self.assertEqual(result['movies'], ['id'])
        self.assertEqual(prepare.call_count, 2)
        sleep.assert_called_once_with(5)

    def test_tmdb_feed_has_ids_and_preserves_order_without_credentials(self):
        calls = []
        def respond(request, **kwargs):
            calls.append(request.full_url)
            self.assertEqual(request.get_header('Authorization'), 'Bearer private-token')
            self.assertIn('language=en-US', request.full_url)
            path = request.full_url.split('?')[0]
            if path.endswith('/trending/movie/day'):
                if 'page=1' in request.full_url:
                    return Response({'total_pages': 2, 'results': [{'id': 12}, {'id': 9}]})
                return Response({'total_pages': 2, 'results': [{'id': 12}, {'id': 7}]})
            if path.endswith('/trending/tv/day'):
                return Response({'total_pages': 1, 'results': [{'id': 4}]})
            if path.endswith('/movie/popular'):
                return Response({'total_pages': 1, 'results': [{'id': 7}, {'id': 8}]})
            if path.endswith('/movie/top_rated'):
                return Response({'total_pages': 1, 'results': [{'id': 9}]})
            if path.endswith('/tv/popular'):
                return Response({'total_pages': 1, 'results': [{'id': 5}]})
            return Response({'total_pages': 1, 'results': [{'id': 6}]})
        with patch.object(feed.urllib.request, 'urlopen', side_effect=respond):
            result = feed.fetch_feed({'tmdb_bearer_token': 'private-token', 'language': 'en-US', 'pages': 3})
        self.assertEqual(result['movies'], ['12', '9', '7'])
        self.assertEqual(result['tv'], ['4'])
        self.assertEqual(result['popularMovies'], ['7', '8'])
        self.assertEqual(result['topRatedMovies'], ['9'])
        self.assertEqual(result['popularTv'], ['5'])
        self.assertEqual(result['topRatedTv'], ['6'])
        self.assertEqual(len(calls), 7)
        self.assertNotIn('private-token', json.dumps(result))

    def test_missing_tmdb_token_fails_without_requests(self):
        with patch.object(feed.urllib.request, 'urlopen') as request:
            with self.assertRaisesRegex(ValueError, 'TMDb bearer token is not configured'):
                feed.fetch_feed({'pages': 2})
        request.assert_not_called()

if __name__ == '__main__':
    unittest.main()
