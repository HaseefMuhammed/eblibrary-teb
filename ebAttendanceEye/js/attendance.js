/**
 * Attendance Recognition & Google Apps Script Submission Engine
 * EDU BOT AI Smart Attendance
 */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx-J6U4Y2oPqJcIdIXlRYNddf6kblNL2i5WocuTmF0rgZaNxPB_UEYgUkRPPOX-OgYsVg/exec";

const markedStudents = new Set();
let attendanceLoopActive = false;
let attendanceAnimFrameId = null;
let overlayHideTimeout = null;

/**
 * Start continuous attendance recognition scanning loop on Mode 2 video
 */
async function startAttendanceRecognition() {
    const video = document.getElementById('attendanceVideo');
    const canvas = document.getElementById('attendanceCanvas');
    if (!video || !canvas) return;

    // Ensure FaceMatcher is built
    await buildFaceMatcher();

    attendanceLoopActive = true;
    console.log('Started full-screen attendance recognition scan loop.');

    async function processFrame() {
        if (!attendanceLoopActive) return;

        if (video.paused || video.ended || video.readyState < 2) {
            attendanceAnimFrameId = requestAnimationFrame(processFrame);
            return;
        }

        try {
            const displaySize = {
                width: video.videoWidth || video.clientWidth || 1280,
                height: video.videoHeight || video.clientHeight || 720
            };

            faceapi.matchDimensions(canvas, displaySize);

            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
            const detections = await faceapi.detectAllFaces(video, options)
                .withFaceLandmarks()
                .withFaceDescriptors();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const det of resizedDetections) {
                const box = det.detection.box;
                let isMatch = false;
                let adminNo = '';
                let name = 'Unknown';

                if (globalFaceMatcher) {
                    const match = globalFaceMatcher.findBestMatch(det.descriptor);
                    if (match && match.label !== 'unknown' && match.distance <= FACE_MATCH_THRESHOLD) {
                        isMatch = true;
                        const parts = match.label.split('||');
                        adminNo = parts[0];
                        name = parts[1] || parts[0];
                    }
                }

                // Draw Bounding Box (GREEN for match, RED/NEUTRAL for unknown)
                ctx.lineWidth = 3;
                ctx.strokeStyle = isMatch ? '#28a745' : '#dc3545';
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                // Label header banner over face box
                const bannerHeight = 24;
                const bannerY = box.y >= bannerHeight ? box.y - bannerHeight : box.y;
                ctx.fillStyle = isMatch ? 'rgba(40, 167, 69, 0.9)' : 'rgba(220, 53, 69, 0.9)';
                ctx.fillRect(box.x, bannerY, box.width, bannerHeight);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 13px system-ui, sans-serif';
                const textLabel = isMatch ? `${name} (${adminNo})` : 'Unknown Face';
                ctx.fillText(textLabel, box.x + 6, bannerY + 17);

                // Handle recognized student attendance logic
                if (isMatch) {
                    handleRecognizedStudent(adminNo, name);
                }
            }
        } catch (err) {
            console.error('Error in attendance recognition frame:', err);
        }

        if (attendanceLoopActive) {
            setTimeout(() => {
                attendanceAnimFrameId = requestAnimationFrame(processFrame);
            }, 70);
        }
    }

    processFrame();
}

/**
 * Stop continuous recognition loop
 */
function stopAttendanceRecognition() {
    attendanceLoopActive = false;
    if (attendanceAnimFrameId) {
        cancelAnimationFrame(attendanceAnimFrameId);
        attendanceAnimFrameId = null;
    }
    hideRecognitionOverlay();
    const canvas = document.getElementById('attendanceCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Process a recognized student face match
 */
async function handleRecognizedStudent(adminNo, name) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB'); // HH:MM:SS
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY

    // Check session duplicate prevention
    if (markedStudents.has(adminNo)) {
        return;
    }

    // Mark student in session
    markedStudents.add(adminNo);
    console.log(`Recognized student ${name} (${adminNo}) - Submitting attendance...`);

    // Display temporary 2-second recognition overlay
    showRecognitionOverlay({
        adminNo: adminNo,
        name: name,
        time: timeStr
    });

    // Prepare payload
    const attendancePayload = {
        date: dateStr,
        time: timeStr,
        adminNo: adminNo,
        name: name,
        status: "Present"
    };

    // POST payload to Google Apps Script endpoint
    sendAttendanceToGoogleSheets(attendancePayload);
}

/**
 * Show 2-second temporary translucent student recognition overlay
 */
function showRecognitionOverlay(data) {
    const overlay = document.getElementById('recognitionOverlay');
    const nameEl = document.getElementById('overlayStudentName');
    const adminEl = document.getElementById('overlayAdminNo');
    const timeEl = document.getElementById('overlayTime');

    if (!overlay) return;

    if (nameEl) nameEl.textContent = data.name || 'Student';
    if (adminEl) adminEl.textContent = data.adminNo || '';
    if (timeEl) timeEl.textContent = data.time || '';

    overlay.classList.remove('d-none');

    // Clear previous timer if still running
    if (overlayHideTimeout) {
        clearTimeout(overlayHideTimeout);
    }

    // Automatically hide overlay after 2 seconds (2000 ms)
    overlayHideTimeout = setTimeout(() => {
        hideRecognitionOverlay();
    }, 2000);
}

/**
 * Hide temporary recognition overlay
 */
function hideRecognitionOverlay() {
    const overlay = document.getElementById('recognitionOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
    if (overlayHideTimeout) {
        clearTimeout(overlayHideTimeout);
        overlayHideTimeout = null;
    }
}

/**
 * Send attendance payload to Google Apps Script endpoint
 */
async function sendAttendanceToGoogleSheets(payload) {
    console.log('Sending attendance payload to Google Sheets:', payload);

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });
        console.log('Successfully submitted to Google Apps Script');
        return { success: true };
    } catch (err) {
        console.error('Google Sheets submission error:', err);
        return { success: false, error: err };
    }
}

/**
 * Reset local attendance recognition session ("START NEW SESSION")
 */
function resetAttendanceSession() {
    markedStudents.clear();
    hideRecognitionOverlay();
    console.log('Attendance recognition session reset (markedStudents cleared).');
}
