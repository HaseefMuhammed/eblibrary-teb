/**
 * Main Application Startup Entry Point
 * EDU BOT AI — SMART ATTENDANCE
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing EDU BOT AI Smart Attendance application...');
    
    // Check initial device orientation
    checkOrientation();

    const loader = document.getElementById('startupLoader');
    const statusEl = document.getElementById('startupStatus');

    try {
        // Step 1: Initialize IndexedDB
        if (statusEl) statusEl.textContent = 'Initializing Database...';
        await initDB();
        console.log('Step 1 Complete: IndexedDB Ready.');

        // Step 2: Load face-api.js pretrained models
        if (statusEl) statusEl.textContent = 'Loading Face Recognition Models...';
        await loadFaceApiModels();
        console.log('Step 2 Complete: Face Models Loaded.');

        // Step 3: Build Face Matcher from stored students
        if (statusEl) statusEl.textContent = 'Building Face Matcher...';
        await buildFaceMatcher();
        console.log('Step 3 Complete: Face Matcher Ready.');

        // Step 4: Initial ThingSpeak Mode Check
        if (statusEl) statusEl.textContent = 'Checking ThingSpeak Mode...';
        try {
            await checkThingSpeakMode();
        } catch (tsErr) {
            console.warn('Initial ThingSpeak check warning:', tsErr);
        }

        // Default to Mode 1 (Eye) if no mode was set by ThingSpeak
        if (currentMode === null) {
            console.log('No mode set by ThingSpeak. Defaulting to Mode 1 (EYE).');
            await switchMode(1);
        }

        // Step 5: Begin continuous ThingSpeak polling (every 3 seconds)
        startThingSpeakPolling();
        console.log('Step 5 Complete: ThingSpeak Polling Active.');

        // Hide startup loading screen
        if (loader) {
            loader.style.transition = 'opacity 0.4s ease';
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.classList.add('d-none');
            }, 400);
        }

    } catch (err) {
        console.error('Fatal initialization error:', err);
        if (statusEl) {
            statusEl.className = 'badge bg-danger text-white fs-6 px-3 py-2';
            statusEl.textContent = 'Initialization Error! Refresh page to retry.';
        }
        showToast('Application initialization error: ' + err.message, 'danger');
    }
});
