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
    def test_public_feed_has_ids_and_preserves_order_without_credentials(self):
        def respond(request, **kwargs):
            self.assertEqual(request.get_header('X-api-key'), 'private-key')
            self.assertIn('timeWindow=day', request.full_url)
            if 'mediaType=movie' in request.full_url:
                return Response({'totalPages': 1, 'results': [
                    {'id': 12, 'mediaType': 'movie'}, {'id': 9, 'mediaType': 'movie'},
                    {'id': 12, 'mediaType': 'movie'}, {'id': 90, 'mediaType': 'tv'}]})
            return Response({'totalPages': 1, 'results': [{'id': 4, 'mediaType': 'tv'}]})
        with patch.object(feed.urllib.request, 'urlopen', side_effect=respond):
            result = feed.fetch_feed({'url': 'http://seerr:5055', 'api_key': 'private-key', 'pages': 3})
        self.assertEqual(result['movies'], ['12', '9'])
        self.assertEqual(result['tv'], ['4'])
        self.assertNotIn('private-key', json.dumps(result))

if __name__ == '__main__':
    unittest.main()
