export function ThemeScript() {
  const code = `
(function() {
  try {
    var key = 'servicecentric-theme';
    var stored = localStorage.getItem(key);
    var dark = false;
    if (stored === 'dark') {
      dark = true;
    } else if (stored === 'light') {
      dark = false;
    } else {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

  return (
    <script
      id="theme-script"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
