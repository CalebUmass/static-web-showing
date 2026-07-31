/*
  theme-init.js - runs before first paint so the page never flashes the wrong
  theme. Load it with a plain <script> in <head>, not deferred.
*/
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('pc-theme');
  } catch (error) {
    /*private browsing can refuse localStorage. Fall back to the OS setting.*/
  }

  var prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.setAttribute(
    'data-theme',
    stored || (prefersDark ? 'dark' : 'light')
  );
})();
