
document.addEventListener('DOMContentLoaded', function () {
    const themeButton = document.getElementById('theme-toggle');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('fintrack-theme', theme);

        if (themeButton) {
            themeButton.textContent =
                theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
        }
    }

    const savedTheme = localStorage.getItem('fintrack-theme') || 'light';
    applyTheme(savedTheme);

    if (themeButton) {
        themeButton.addEventListener('click', function () {
            const currentTheme =
                document.documentElement.getAttribute('data-bs-theme');

            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }
});
