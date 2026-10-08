/**
 * Camera Stream Manager for EDU BOT AI Smart Attendance
 * Manages MediaStream initialization, video attachment, and cleanup.
 */

const activeStreams = new Map();

/**
 * Start camera and bind stream to a video element
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<MediaStream>}
 */
async function startCamera(videoElement) {
    if (!videoElement) {
        throw new Error('No video element provided to startCamera');
    }

    // Stop existing stream on this video element if any
    stopCamera(videoElement);

    const constraintsList = [
        { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'user' } },
        { video: true }
    ];

    let lastErr = null;
    let stream = null;

    for (const constraints of constraintsList) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) break;
        } catch (err) {
            lastErr = err;
        }
    }

    if (!stream) {
        console.error('Failed to start camera:', lastErr);
        if (lastErr && (lastErr.name === 'NotAllowedError' || lastErr.name === 'PermissionDeniedError')) {
            showToast('Camera permission denied. Please allow camera access.', 'danger');
        } else if (lastErr && (lastErr.name === 'NotFoundError' || lastErr.name === 'DevicesNotFoundError')) {
            showToast('No camera detected on this device.', 'danger');
        } else {
            showToast('Unable to start camera feed.', 'danger');
        }
        throw lastErr || new Error('Camera access failed');
    }

    videoElement.srcObject = stream;
    activeStreams.set(videoElement, stream);

    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            videoElement.play().catch(e => console.warn('Video play error:', e));
            resolve(stream);
        };
    });
}

/**
 * Stop camera feed and release all MediaStream tracks completely
 * @param {HTMLVideoElement} videoElement
 */
function stopCamera(videoElement) {
    if (!videoElement) return;

    let stream = videoElement.srcObject;
    if (!stream && activeStreams.has(videoElement)) {
        stream = activeStreams.get(videoElement);
    }

    if (stream) {
        try {
            const tracks = stream.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log(`Stopped camera track: ${track.kind} (${track.label})`);
            });
        } catch (err) {
            console.error('Error stopping camera tracks:', err);
        }
    }

    videoElement.srcObject = null;
    activeStreams.delete(videoElement);
}

/**
 * Global cleanup to ensure no camera tracks remain running
 */
function stopAllCameras() {
    activeStreams.forEach((stream, videoElement) => {
        stopCamera(videoElement);
    });
}
