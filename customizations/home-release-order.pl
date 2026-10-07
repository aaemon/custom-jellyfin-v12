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
my @files = glob "$web/65126.*.chunk.js";
die "Expected one home-sections chunk\n" unless @files == 1;
my $path = $files[0];
my $contents = read_file($path);
my $runtime_path = "$web/runtime.bundle.js";
my $runtime = read_file($runtime_path);
if (index($contents, 'window.BijoyHomeLatest.query') < 0) {
    # loadSections declares its own R array. Capture the SDK factory at module
    # scope so the nested home-row callback cannot resolve that shadowed R.
    my $old = 'var L=r(65369),R=r(71857),P=function(e,t){';
    my $count = () = $contents =~ /\Q$old\E/g;
    die "Expected one library API import; found $count\n" unless $count == 1;
    $contents =~ s/\Q$old\E/var L=r(65369),R=r(71857),bijoyLibraryApi=R.Q,P=function(e,t){/;
    $old = 'return u.q.fetchQuery(P(i,s))';
    $count = () = $contents =~ /\Q$old\E/g;
    die "Expected one latest-row query; found $count\n" unless $count == 1;
    $contents =~ s/\Q$old\E/return u.q.fetchQuery(window.BijoyHomeLatest.query(i,s,n,bijoyLibraryApi,P,t))/;
    $old = 's.Ay.translate("LatestFromLibrary",g()(n.Name))';
    $count = () = $contents =~ /\Q$old\E/g;
    die "Expected two home-row headings; found $count\n" unless $count == 2;
    my $new = '(n.CollectionType===L.X.Movies?"Latest releases in "+g()(n.Name):s.Ay.translate("LatestFromLibrary",g()(n.Name)))';
    $contents =~ s/\Q$old\E/$new/g;
}
my $name = $path;
$name =~ s#^.*/##;
if ($name ne '65126.bijoyreleasesv2.chunk.js') {
    $name =~ /^65126\.(.+)\.chunk\.js$/ or die "Unexpected chunk name\n";
    my $old = '65126:"' . $1 . '"';
    my $count = () = $runtime =~ /\Q$old\E/g;
    die "Expected one home chunk runtime entry; found $count\n" unless $count == 1;
    $runtime =~ s/\Q$old\E/65126:"bijoyreleasesv2"/;
}
write_file($path, $contents);
if ($name ne '65126.bijoyreleasesv2.chunk.js') {
    rename $path, "$web/65126.bijoyreleasesv2.chunk.js" or die $!;
}
write_file($runtime_path, $runtime);
