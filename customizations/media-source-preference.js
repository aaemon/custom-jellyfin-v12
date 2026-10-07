(function (global) {
    'use strict';
    function is1080(source) {
        var streams = source.MediaStreams || [];
        var hasDimensions = false;
        for (var i = 0; i < streams.length; i++) {
            var stream = streams[i];
            if (stream.Type !== 'Video') continue;
            if (stream.Width || stream.Height) hasDimensions = true;
            // Letterboxed 1080p movies can be 1920 x 800.
            if (stream.Height === 1080 || stream.Width === 1920) return true;
        }
        if (hasDimensions) return false;
        return /(?:^|[^0-9])1080(?:p|i)?(?:[^0-9]|$)/i.test(source.Name || '');
    }
    function find1080(sources) {
        return (sources || []).find(is1080);
    }
    function versionName(source) {
        var file = (source.Path || '').split(/[\\/]/).pop();
        file = file.replace(/\.(mkv|mp4|m4v|avi|mov|wmv|ts|m2ts|webm)$/i, '');
        var delimiter = file.lastIndexOf(' - ');
        if (delimiter >= 0) {
            var suffix = file.slice(delimiter + 3).trim();
            if (suffix) return suffix;
        }
        return source.Name;
    }
    function labelSources(sources) {
        return (sources || []).map(function (source) {
            return Object.assign({}, source, { Name: versionName(source) });
        });
    }
    function prefer1080(sources) {
        sources = labelSources(sources);
        var preferred = find1080(sources);
        if (!preferred) return sources;
        return [preferred].concat(sources.filter(function (source) {
            return source !== preferred;
        }));
    }
    global.BijoyMediaSources = {
        find1080: find1080, prefer1080: prefer1080,
        labelSources: labelSources, versionName: versionName
    };
})(window);
