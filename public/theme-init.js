(function () {
  try {
    var saved = localStorage.getItem('mailgate_theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    // Ignore storage errors in restricted environments
  }
})();
