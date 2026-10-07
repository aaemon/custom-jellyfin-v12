use strict;
use warnings;
my $web = '/jellyfin/jellyfin-web';
sub read_file {
    open my $file, '<', $_[0] or die $!;
    local $/;
    return <$file>;
}
sub write_file {
    open my $file, '>', $_[0] or die $!;
    print {$file} $_[1];
    close $file or die $!;
}
my @files = glob "$web/65126.*.chunk.js";
die "Expected one home chunk\n" unless @files == 1;
my $file = $files[0];
my $contents = read_file($file);
my $runtime = read_file("$web/runtime.bundle.js");
if (index($contents, 'window.BijoyTrendingRows.install') < 0) {
    my $old = 'r(15453),r(1177),r(41765),r(10353);var B=';
    my $count = () = $contents =~ /\Q$old\E/g;
    die "Expected home dependency anchor once\n" unless $count == 1;
    my $new = 'r(15453),r(1177),r(41765),r(10353);var bijoyTrendingDependencies={libraryApi:bijoyLibraryApi,cards:p.Ay,portraitShape:I.xK,connections:l.A},B=';
    $contents =~ s/\Q$old\E/$new/;
    $old = 'case n.LatestMedia:!function(e,t,r,n,a){';
    $count = () = $contents =~ /\Q$old\E/g;
    die "Expected latest-media insertion point once\n" unless $count == 1;
    $new = 'case n.LatestMedia:window.BijoyTrendingRows.install(v,t,r,h,bijoyTrendingDependencies),!function(e,t,r,n,a){';
    $contents =~ s/\Q$old\E/$new/;
}
my $name = $file;
$name =~ s#^.*/##;
if ($name ne '65126.bijoytrendingv1.chunk.js') {
    $name =~ /^65126\.(.+)\.chunk\.js$/ or die "Unexpected home chunk name\n";
    my $old = '65126:"' . $1 . '"';
    my $count = () = $runtime =~ /\Q$old\E/g;
    die "Expected runtime home reference once\n" unless $count == 1;
    $runtime =~ s/\Q$old\E/65126:"bijoytrendingv1"/;
}
write_file($file, $contents);
rename $file, "$web/65126.bijoytrendingv1.chunk.js" or die $! if $name ne '65126.bijoytrendingv1.chunk.js';
write_file("$web/runtime.bundle.js", $runtime);
