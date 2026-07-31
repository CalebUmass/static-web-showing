/*
  site-header.js - the one piece of chrome both galleries share.

  Each page supplies its own section name and a link to its sibling gallery,
  so the header reads the same on both sites while still saying which one is
  open. Mount it into an empty element:

    <header id="site-header"></header>
    <script src="../shared/site-header.js"></script>
    <script>
      SiteHeader.mount({
        mount: '#site-header',
        section: 'Drawing archive',
        home: '../projects/all/',
        sibling: { label: '3D models', href: '../3d-gallery/' },
        help: '#help-modal'
      });
    </script>
*/
(function () {
  var SITE_NAME = 'Poggio Civitate';

  var ICONS = {
    sun:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6' +
      'M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>',
    moon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/></svg>',
    help:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .8-1 1.6v.4"/>' +
      '<circle cx="11.9" cy="16.8" r="0.9" fill="currentColor" stroke="none"/></svg>',
    home:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M4 10.3 12 4l8 6.3V19a1 1 0 0 1-1 1h-4.4v-5.2H9.4V20H5a1 1 0 0 1-1-1Z"/></svg>',
    swap:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
      '<path d="M4 8h13m0 0-3.4-3.4M17 8l-3.4 3.4M20 16H7m0 0 3.4-3.4M7 16l3.4 3.4"/></svg>',
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }

  function setTheme(next) {
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('pc-theme', next);
    } catch (error) {
      /*nothing to do, the theme just will not persist*/
    }
  }

  function mount(options) {
    var host =
      typeof options.mount === 'string'
        ? document.querySelector(options.mount)
        : options.mount;
    if (!host) return;

    host.className = 'site-header';
    host.innerHTML =
      '<div class="site-header__inner">' +
      '<a class="site-header__brand" href="' +
      escapeHtml(options.home || '/') +
      '">' +
      '<span class="site-header__site">' +
      SITE_NAME +
      '</span>' +
      '<span class="site-header__section">' +
      escapeHtml(options.section || '') +
      '</span>' +
      '</a>' +
      '<nav class="site-header__nav" aria-label="Site">' +
      (options.sibling
        ? '<a class="site-header__sibling" href="' +
          escapeHtml(options.sibling.href) +
          '">' +
          ICONS.swap +
          escapeHtml(options.sibling.label) +
          '</a>'
        : '') +
      '<a class="icon-button" href="' +
      escapeHtml(options.home || '/') +
      '" aria-label="Project home">' +
      ICONS.home +
      '</a>' +
      (options.help
        ? '<button class="icon-button" type="button" data-header-help aria-label="How to use this page">' +
          ICONS.help +
          '</button>'
        : '') +
      '<button class="icon-button theme-toggle" type="button" data-header-theme aria-label="Switch between light and dark">' +
      '<span class="icon-sun">' +
      ICONS.sun +
      '</span><span class="icon-moon">' +
      ICONS.moon +
      '</span>' +
      '</button>' +
      '</nav>' +
      '</div>';

    host.querySelector('[data-header-theme]').addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    var helpButton = host.querySelector('[data-header-help]');
    if (helpButton) {
      var dialog = document.querySelector(options.help);
      if (dialog) wireModal(helpButton, dialog);
    }
  }

  /*Open, close on the X, on backdrop click and on Escape. Focus returns to
    the button that opened it.*/
  function wireModal(trigger, dialog) {
    function open() {
      dialog.hidden = false;
      var closer = dialog.querySelector('[data-modal-close]');
      if (closer) closer.focus();
    }
    function close() {
      dialog.hidden = true;
      trigger.focus();
    }

    trigger.addEventListener('click', open);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.closest('[data-modal-close]')) {
        close();
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !dialog.hidden) close();
    });
  }

  window.SiteHeader = { mount: mount, icons: ICONS };
})();
