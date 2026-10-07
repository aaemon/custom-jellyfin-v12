(function (global) {
    'use strict';
    function query(api, params, collectionType, libraryApi, latestQuery, user) {
        if (collectionType !== 'movies') return latestQuery(api, params);
        return {
            queryKey: ['User', params.userId, 'LatestReleases', params,
                !!(user && user.Configuration && user.Configuration.HidePlayedInLatest)],
            enabled: !!api,
            queryFn: function (context) {
                var options = Object.assign({}, params, {
                    recursive: true,
                    includeItemTypes: ['Movie'],
                    sortBy: ['PremiereDate', 'ProductionYear', 'SortName'],
                    sortOrder: ['Descending'],
                    enableTotalRecordCount: false
                });
                if (user && user.Configuration && user.Configuration.HidePlayedInLatest) {
                    options.isPlayed = false;
                }
                return libraryApi(api).getItems(options, { signal: context.signal })
                    .then(function (response) { return response.data.Items || []; });
            }
        };
    }
    global.BijoyHomeLatest = { query: query };
})(window);
