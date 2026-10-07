use strict;
use warnings;
my $web = '/jellyfin/jellyfin-web';
sub read_file {
    my ($path) = @_;
    open my $file, '<', $path or die "$path: $!";
    local $/;
    return <$file>;
}
sub write_file {
    my ($path, $contents) = @_;
    open my $file, '>', $path or die "$path: $!";
    print {$file} $contents;
    close $file or die "$path: $!";
}
sub replace_once {
    my ($contents, $old, $new) = @_;
    my $count = () = $$contents =~ /\Q$old\E/g;
    die "Expected one occurrence of $old; got $count\n" unless $count == 1;
    $$contents =~ s/\Q$old\E/$new/;
}
my $main_path = "$web/main.jellyfin.bundle.js";
my $main = read_file($main_path);
my @details = glob "$web/itemDetails.*.chunk.js";
die "Expected one item-details chunk\n" unless @details == 1;
my $detail_path = $details[0];
my $detail = read_file($detail_path);
my $runtime_path = "$web/runtime.bundle.js";
my $runtime = read_file($runtime_path);
if (index($main, 'bijoySourceId') < 0) {
    replace_once(\$main, 'return nt(0,a)?function(e,t,n){var r=n.map',
        'return nt(0,a)?function(e,t,n,bijoySourceId){var r=n.map');
    replace_once(\$main, '}(t,r,a.MediaSources).then',
        '}(t,r,a.MediaSources,i).then');
    replace_once(\$main, 'var o=n.find((function(e){return e.Id===t.Id}));',
        'var bijoyPreferred=bijoySourceId?n.find(function(s){return s.Id===bijoySourceId}):t.Type==="Movie"&&window.BijoyMediaSources.find1080(n.filter(function(s){return s.enableDirectPlay||s.SupportsDirectStream||s.SupportsTranscoding}));if(bijoyPreferred&&(bijoyPreferred.enableDirectPlay||bijoyPreferred.SupportsDirectStream||bijoyPreferred.SupportsTranscoding))return bijoyPreferred;var o=n.find((function(e){return e.Id===t.Id}));');
}
if (index($detail, 'window.BijoyMediaSources.prefer1080') < 0) {
    replace_once(\$detail, 'var a=r.MediaSources;t._currentPlaybackMediaSources=a',
        'var a=r.Type==="Movie"?window.BijoyMediaSources.prefer1080(r.MediaSources):r.MediaSources;t._currentPlaybackMediaSources=a');
}
if (index($main, 'window.BijoyMediaSources.labelSources') < 0) {
    replace_once(\$main,
        '(function(e){return e.MediaSources}))}))}))},o.getItemFromPlaylistItemId',
        '(function(e){return window.BijoyMediaSources.labelSources(e.MediaSources)}))}))}))},o.getItemFromPlaylistItemId');
}
my $name = $detail_path;
$name =~ s#^.*/##;
if ($name ne 'itemDetails.bijoy1080v2.chunk.js') {
    $name =~ /^itemDetails\.(.+)\.chunk\.js$/ or die "Unexpected chunk name\n";
    replace_once(\$runtime, '"' . $1 . '"', '"bijoy1080v2"');
}
write_file($main_path, $main);
write_file($detail_path, $detail);
if ($name ne 'itemDetails.bijoy1080v2.chunk.js') {
    rename $detail_path, "$web/itemDetails.bijoy1080v2.chunk.js" or die $!;
}
write_file($runtime_path, $runtime);
