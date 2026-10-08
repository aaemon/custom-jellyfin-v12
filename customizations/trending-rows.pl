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
    if (index($contents, 'bijoyLibraryApi=R.Q') < 0) {
        my $old = 'var L=r(65369),R=r(71857),P=function(e,t){';
        my $count = () = $contents =~ /\Q$old\E/g;
        die "Expected library API import once\n" unless $count == 1;
        $contents =~ s/\Q$old\E/var L=r(65369),R=r(71857),bijoyLibraryApi=R.Q,P=function(e,t){/;
    }
    my $old = 'r(15453),r(1177),r(41765),r(10353);var B=';
    my $count = () = $contents =~ /\Q$old\E/g;
    die "Expected home dependency anchor once\n" unless $count == 1;
    my $new = 'r(15453),r(1177),r(41765),r(10353);var bijoyTrendingDependencies={libraryApi:bijoyLibraryApi,cards:p.Ay,portraitShape:I.xK,connections:l.A,queryClient:u.q},B=';
    $contents =~ s/\Q$old\E/$new/;
    $old = 'loadSections:function(e,t,r,a){var f=l.A.getApi(t.serverId()),v=r.Id||t.getCurrentUserId();return';
    $count = () = $contents =~ /\Q$old\E/g;
    die "Expected home preloading point once\n" unless $count == 1;
    $new = 'loadSections:function(e,t,r,a){var f=l.A.getApi(t.serverId()),v=r.Id||t.getCurrentUserId();window.BijoyTrendingRows.prefetch(t,r,bijoyTrendingDependencies);return';
    $contents =~ s/\Q$old\E/$new/;
    $old = 'case n.LatestMedia:!function(e,t,r,n,a){';
    $count = () = $contents =~ /\Q$old\E/g;
    die "Expected latest-media insertion point once\n" unless $count == 1;
    $new = 'case n.LatestMedia:window.BijoyTrendingRows.install(v,t,r,h,bijoyTrendingDependencies),!function(e,t,r,n,a){';
    $contents =~ s/\Q$old\E/$new/;
}
my $name = $file;
$name =~ s#^.*/##;
if ($name ne '65126.bijoytrendingv3.chunk.js') {
    $name =~ /^65126\.(.+)\.chunk\.js$/ or die "Unexpected home chunk name\n";
    my $old = '65126:"' . $1 . '"';
    my $count = () = $runtime =~ /\Q$old\E/g;
    die "Expected runtime home reference once\n" unless $count == 1;
    $runtime =~ s/\Q$old\E/65126:"bijoytrendingv3"/;
}
write_file($file, $contents);
rename $file, "$web/65126.bijoytrendingv3.chunk.js" or die $! if $name ne '65126.bijoytrendingv3.chunk.js';
write_file("$web/runtime.bundle.js", $runtime);
