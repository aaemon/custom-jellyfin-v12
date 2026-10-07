use strict;
use warnings;
my $web = '/jellyfin/jellyfin-web';
my $source = '/opt/bijoy';
sub read_file {
    my ($path) = @_;
    open my $file, '<', $path or die "$path: $!";
    binmode $file;
    local $/;
    return <$file>;
}
sub write_file {
    my ($path, $contents) = @_;
    open my $file, '>', $path or die "$path: $!";
    binmode $file;
    print {$file} $contents;
    close $file or die "$path: $!";
}
my @artwork = (
    ['bijoy-logo.png', 'bijoy-icon-v1.png', 'icon-transparent.*.png'],
    ['bijoy-full.png', 'bijoy-banner-dark-v1.png', 'banner-dark.*.png'],
    ['bijoy-full.png', 'bijoy-banner-light-v1.png', 'banner-light.*.png'],
    ['bijoy-fav.ico', 'bijoy-favicon-v1.ico', 'favicon.*.ico']
);
for my $asset (@artwork) {
    my ($original, $name, $pattern) = @$asset;
    my $data = read_file("$source/assets/$original");
    die "Empty artwork: $original\n" unless length $data;
    write_file("$web/$name", $data);
    my @targets = glob "$web/$pattern";
    die "Missing Jellyfin artwork matching $pattern\n" unless @targets;
    write_file($_, $data) for @targets;
}
for my $path (glob("$web/*.js"), glob("$web/*.css"), glob("$web/*.html"), glob("$web/*.json")) {
    my $contents = read_file($path);
    my $original = $contents;
    $contents =~ s/icon-transparent\.[a-z0-9]+\.png/bijoy-icon-v1.png/g;
    $contents =~ s/banner-dark\.[a-z0-9]+\.png/bijoy-banner-dark-v1.png/g;
    $contents =~ s/banner-light\.[a-z0-9]+\.png/bijoy-banner-light-v1.png/g;
    $contents =~ s/favicon\.[a-z0-9]+\.ico/bijoy-favicon-v1.ico/g;
    write_file($path, $contents) if $contents ne $original;
}
for my $script (
    ['bijoy-branding.js', 'bijoy-branding.js'],
    ['media-source-preference.js', 'media-source-preference-v2.js'],
    ['home-release-order.js', 'home-release-order-v1.js']
) {
    write_file("$web/$script->[1]", read_file("$source/$script->[0]"));
}
my $index_path = "$web/index.html";
my $index = read_file($index_path);
$index =~ s#<title>[^<]*</title>#<title>Bijoy Media</title># or die "Missing page title\n";
my $scripts = '<script defer="defer" src="media-source-preference-v2.js"></script>'
    . '<script defer="defer" src="home-release-order-v1.js"></script>'
    . '<script defer="defer" src="bijoy-branding.js"></script>';
$index =~ s#<head>#<head>$scripts# or die "Missing HTML head\n";

# Content-derived URLs invalidate old assets whenever a patch changes.
sub cache_tag {
    my ($prefix, $url, $quote) = @_;
    my $filename = $url;
    $filename =~ s/%([0-9a-f]{2})/chr(hex($1))/egi;
    open my $pipe, '-|', 'sha256sum', "$web/$filename" or die $!;
    my $line = <$pipe>;
    close $pipe or die "Hashing $filename failed\n";
    $line =~ /^([0-9a-f]{64})/ or die "Missing asset hash\n";
    return $prefix . $url . '?bijoy-' . substr($1, 0, 16) . $quote;
}
$index =~ s{((?:src|href)=")([^"?]+\.(?:js|css))(?:\?[^\"]*)?(")}{cache_tag($1, $2, $3)}ge;
write_file($index_path, $index);
