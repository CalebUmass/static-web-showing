document.addEventListener('DOMContentLoaded', function () {
    // navbar functionality
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarMenu = document.getElementById('navbarMenu');
    if (navbarToggle) {
        navbarToggle.addEventListener('click', function () {
            navbarToggle.classList.toggle('is-active');
            navbarMenu.classList.toggle('is-active');
        });
    }

    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }


    // info functionality
    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');
    const closeInfo = document.getElementById('close-info');

    infoBtn.addEventListener('click', () => {
        infoModal.classList.remove('hidden');
    });

    closeInfo.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === infoModal) {
        infoModal.classList.add('hidden');
        }
    });
});
