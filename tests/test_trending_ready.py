import os
import sys
import unittest

sys.path.insert(0, os.environ.get('HELPER_ROOT', '/opt/bijoy'))
from trending_ready import matching_ids, select_ready

class ReadyTests(unittest.TestCase):
    def test_duplicates_and_virtual_items(self):
        items = [{'Id':'a','Type':'Movie','ProviderIds':{'Tmdb':'10'}},
            {'Id':'b','Type':'Movie','ProviderIds':{'Tmdb':'10'}},
            {'Id':'c','Type':'Movie','ProviderIds':{'Tmdb':'20'}},
            {'Id':'v','Type':'Movie','ProviderIds':{'Tmdb':'30'},'IsVirtualItem':True}]
        self.assertEqual(matching_ids(['20','30','10'],items,'Movie'), ['c','a'])

    def test_popular_and_top_rated_fill_after_trending_and_deduplicate(self):
        items = [
            {'Id':'trend','Type':'Movie','ProviderIds':{'Tmdb':'1'}},
            {'Id':'popular','Type':'Movie','ProviderIds':{'Tmdb':'2'}},
            {'Id':'top','Type':'Movie','ProviderIds':{'Tmdb':'3'}},
            {'Id':'duplicate-version','Type':'Movie','ProviderIds':{'Tmdb':'2'}},
        ]
        tiers = [['1','not-downloaded'], ['2','1'], ['3','2']]
        self.assertEqual(matching_ids(tiers, items, 'Movie'), ['trend','popular','top'])

    def test_shared_selection_contains_ids_only_and_playable_tv(self):
        def request(route, params=None):
            self.assertEqual(params['userId'], 'user')
            if params.get('includeItemTypes') == 'Episode':
                return {'Items': [] if params['parentId']=='empty-series' else [{'Id':'episode'}]}
            return {'Items': [{'Id':'allowed-copy','ProviderIds':{'Tmdb':'10'}},
                {'Id':'movie2','ProviderIds':{'Tmdb':'20'}},
                {'Id':'empty-series','ProviderIds':{'Tmdb':'30'}},
                {'Id':'playable-series','ProviderIds':{'Tmdb':'40'}}]}
        result = select_ready(request, 'user', ['blocked-copy','allowed-copy','movie2'],
            ['empty-series','playable-series'], 42)
        self.assertEqual(result, {'movies':['allowed-copy','movie2'], 'tv':['playable-series'], 'updatedAt':42})

    def test_empty_ids_never_trigger_an_unfiltered_items_query(self):
        def request(*args, **kwargs):
            self.fail('No request should be made for an empty candidate set')
        self.assertEqual(select_ready(request,'user',[],[],1), {'movies':[],'tv':[],'updatedAt':1})

if __name__ == '__main__':
    unittest.main()
