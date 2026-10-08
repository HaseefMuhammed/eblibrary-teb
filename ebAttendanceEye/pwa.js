(() => {
    const installButton = document.getElementById('installButton');
    const installStatus = document.getElementById('installStatus');
    let installPrompt = null;

    const setStatus = (message) => {
        if (installStatus) installStatus.textContent = message;
    };

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((error) => {
                console.error('Service worker registration failed:', error);
                setStatus('Offline support could not be enabled. Check your connection and reload.');
            });
        });
    } else {
        setStatus('Offline app installation is not supported by this browser.');
    }

    if (!installButton) return;

    if (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true) {
        installButton.querySelector('span:last-child').textContent = 'Open EDU BOT Attendance System';
        installButton.addEventListener('click', () => window.location.assign('./app.html'));
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
        setStatus('Ready to install on this device.');
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        setStatus('Installed successfully. Opening the attendance app…');
        window.location.assign('./app.html');
    });

    installButton.addEventListener('click', async () => {
        if (!installPrompt) {
            setStatus('If installation is not offered, open your browser menu and choose “Install app” or “Add to Home Screen”.');
            return;
        }

        installButton.disabled = true;
        try {
            const promptEvent = installPrompt;
            installPrompt = null;
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice.outcome === 'accepted') {
                setStatus('Installation started. Opening the attendance app…');
                window.location.assign('./app.html');
            } else {
                setStatus('Installation was cancelled. You can install it whenever you are ready.');
            }
        } catch (error) {
            console.error('PWA installation prompt failed:', error);
            setStatus('The installation prompt could not be opened. Use your browser menu to install the app.');
        } finally {
            installButton.disabled = false;
        }
    });
})();