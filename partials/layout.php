<?php
// ============================================================
// Word Wheel — shared page layout
// ============================================================
// Every page (player, admin login, admin dashboard) uses these so the
// logo, name, top bar and footer are the same everywhere:
//
//   require_once __DIR__ . '/partials/layout.php';   (at the top)
//   ww_head('Sandbox', '')     inside <head>
//   ww_header('')              first thing in <body>
//   ww_footer('')              last thing before the scripts
//
// $base is the path from the current page back to the site root:
// '' for pages in the root, '../' for pages in admin/.
// ============================================================

const WW_SITE_NAME = 'Word Wheel';
const WW_CREDITS   = 'ICS 499 Capstone · Austin Nguyen &amp; Henry Nguyen · Instructor: Siva Jasthi';

// Is an admin logged in? Only looks at the session when the browser
// already has a session cookie, so ordinary players never get one.
// The answer is worked out once per page and remembered: the session is
// opened read-only and closed straight away, so opening it again later
// (from the footer, after the page has started printing) would fail.
// Call it once before any output (index.php does), so it can read the
// session while headers can still be sent.
function ww_is_admin(): bool {
    static $isAdmin = null;
    if ($isAdmin !== null) {
        return $isAdmin;
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        return $isAdmin = !empty($_SESSION['admin']);
    }
    if (empty($_COOKIE[session_name()]) || headers_sent()) {
        return $isAdmin = false;
    }
    session_start(['read_and_close' => true]);
    return $isAdmin = !empty($_SESSION['admin']);
}

function ww_e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

// <head> contents shared by every page. $title is the page's own
// name ("Sandbox"); the tab shows "Word Wheel · Sandbox".
function ww_head(?string $title, string $base): void {
    $full = $title ? WW_SITE_NAME . ' · ' . $title : WW_SITE_NAME;
    $b = ww_e($base);
    ?>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= ww_e($full) ?></title>
    <meta name="description" content="Word Wheel: find the hidden word by reading the letters around the wheel. A new puzzle every day, free play, and a sandbox to make your own.">
    <meta name="theme-color" content="#FFF8EE">
    <meta property="og:title" content="<?= ww_e($full) ?>">
    <meta property="og:description" content="Find the hidden word by reading the letters around the wheel.">
    <link rel="icon" href="<?= $b ?>assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="<?= $b ?>assets/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="<?= $b ?>assets/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&amp;family=Gochi+Hand&amp;display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css">
    <link rel="stylesheet" href="<?= $b ?>theme.css">
    <link rel="stylesheet" href="<?= $b ?>wheel.css">
    <?php
}

// The crayon wheel mark, on its own (footer, small spots).
function ww_logo_mark(int $size = 32): void {
    ?>
    <svg width="<?= $size ?>" height="<?= $size ?>" viewBox="0 0 150 150" aria-hidden="true" focusable="false">
      <circle cx="75" cy="75" r="52" fill="none" stroke="#FFC93C" stroke-width="10"></circle>
      <circle cx="75" cy="23" r="13" fill="#B0381A"></circle>
      <circle cx="115.6" cy="42.6" r="13" fill="#0B6659"></circle>
      <circle cx="125.7" cy="86.6" r="13" fill="#B0381A"></circle>
      <circle cx="97.6" cy="121.8" r="13" fill="#A26900"></circle>
      <circle cx="52.4" cy="121.8" r="13" fill="#B0381A"></circle>
      <circle cx="24.3" cy="86.6" r="13" fill="#0B6659"></circle>
      <circle cx="34.4" cy="42.6" r="13" fill="#A26900"></circle>
      <circle cx="75" cy="75" r="23" fill="#FFC93C"></circle>
    </svg>
    <?php
}

// The full crayon logo: wheel mark + "Word Wheel" in Gochi Hand with a
// waxy crayon texture (SVG filter). Only the logo gets this look; the
// rest of the site uses Baloo 2 so it stays easy to read.
function ww_logo(): void {
    ?>
    <svg viewBox="0 0 645 150" role="img" aria-label="<?= WW_SITE_NAME ?>">
      <defs>
        <filter id="ww-crayon" x="-4%" y="-8%" width="108%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="2" result="wobble"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="rough"></feDisplacementMap>
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="5" result="grain"></feTurbulence>
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.5" result="wax"></feColorMatrix>
          <feComposite in="rough" in2="wax" operator="in"></feComposite>
        </filter>
      </defs>
      <g filter="url(#ww-crayon)">
        <circle cx="75" cy="75" r="52" fill="none" stroke="#FFC93C" stroke-width="10"></circle>
        <circle cx="75" cy="23" r="13" fill="#B0381A"></circle>
        <circle cx="115.6" cy="42.6" r="13" fill="#0B6659"></circle>
        <circle cx="125.7" cy="86.6" r="13" fill="#B0381A"></circle>
        <circle cx="97.6" cy="121.8" r="13" fill="#A26900"></circle>
        <circle cx="52.4" cy="121.8" r="13" fill="#B0381A"></circle>
        <circle cx="24.3" cy="86.6" r="13" fill="#0B6659"></circle>
        <circle cx="34.4" cy="42.6" r="13" fill="#A26900"></circle>
        <circle cx="75" cy="75" r="23" fill="#FFC93C"></circle>
        <text x="158" y="106" font-family="'Gochi Hand', 'Comic Sans MS', cursive" font-size="92" textLength="471" lengthAdjust="spacingAndGlyphs"><tspan fill="#2B2118">Word</tspan><tspan dx="16" fill="#B0381A">W</tspan><tspan fill="#A26900">h</tspan><tspan fill="#0B6659">e</tspan><tspan fill="#B0381A">e</tspan><tspan fill="#A26900">l</tspan></text>
      </g>
    </svg>
    <?php
}

// Top bar on every page: logo + name on the left (links home),
// Teacher login — or Dashboard · Log out for an admin — on the right.
// $current: 'player', 'login' or 'dashboard' (hides the link to itself).
function ww_header(string $base, string $current = 'player'): void {
    $b = ww_e($base);
    $admin = ww_is_admin();
    // The logo always goes to the game, on every page and for everyone.
    $onDashboard = $current === 'dashboard';
    ?>
    <header class="ww-topbar">
      <div class="container ww-topbar-inner">
        <a class="ww-brand" href="<?= $b ?>index.php" title="<?= WW_SITE_NAME ?> home"><?php ww_logo(); ?></a>
        <nav class="ww-topbar-actions" aria-label="Account">
          <?php if ($admin): ?>
            <?php if ($onDashboard): ?>
              <a class="btn btn-outline-primary" href="<?= $b ?>index.php">Player view</a>
            <?php else: ?>
              <a class="btn btn-outline-primary" href="<?= $b ?>admin/dashboard.php">Dashboard</a>
            <?php endif; ?>
            <a class="btn btn-outline-secondary" href="<?= $b ?>admin/logout.php">Log out</a>
          <?php elseif ($current !== 'login'): ?>
            <a class="btn btn-outline-primary" href="<?= $b ?>admin/login.php">Teacher login</a>
          <?php endif; ?>
        </nav>
      </div>
    </header>
    <?php
}

// Footer on every page: the "signature" (logo, name, credits) and the
// main links. On the player page itself ($current 'player') the tab
// links are plain #hashes, so they switch tabs without reloading.
function ww_footer(string $base, string $current = ''): void {
    $b = ww_e($base);
    $home = $current === 'player' ? '' : $b . 'index.php';
    ?>
    <footer class="ww-footer d-print-none">
      <div class="container ww-footer-inner">
        <div class="ww-footer-brand">
          <?php ww_logo_mark(36); ?>
          <div>
            <div class="ww-footer-name"><?= WW_SITE_NAME ?></div>
            <div class="small"><?= WW_CREDITS ?></div>
          </div>
        </div>
        <nav aria-label="Footer">
          <a href="<?= $home ?>#today">Daily</a>
          <a href="<?= $home ?>#free">Free Play</a>
          <a href="<?= $home ?>#sandbox">Sandbox</a>
          <?php if (ww_is_admin()): ?>
            <a href="<?= $b ?>admin/dashboard.php">Teacher dashboard</a>
          <?php else: ?>
            <a href="<?= $b ?>admin/login.php">Teacher login</a>
          <?php endif; ?>
        </nav>
      </div>
    </footer>
    <?php
}
