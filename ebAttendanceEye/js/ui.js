/**
 * UI State Manager & Manage Faces Controller
 * EDU BOT AI Smart Attendance
 */

let regCapturedSamples = [];

/**
 * Main Mode Switching Function
 * Mode 1 = EYE (iframe full screen)
 * Mode 2 = ATTENDANCE (camera + recognition)
 * Mode 3 = MANAGE FACES (IndexedDB registration table + session reset)
 */
async function switchMode(newMode) {
    if (newMode === currentMode) return;

    console.log(`Switching mode to ${newMode}`);
    currentMode = newMode;

    const div1 = document.getElementById('div1');
    const div2 = document.getElementById('div2');
    const div3 = document.getElementById('div3');

    // 1. Hide all main sections
    div1.classList.add('d-none');
    div2.classList.add('d-none');
    div3.classList.add('d-none');

    // 2. Stop all active camera feeds and recognition loops
    stopAttendanceRecognition();
    stopAllCameras();

    // 3. Close registration modal if open
    closeRegisterModal();

    // 4. Activate target mode
    if (newMode === 1) {
        // MODE 1 — EYE
        div1.classList.remove('d-none');
    } else if (newMode === 2) {
        // MODE 2 — ATTENDANCE
        div2.classList.remove('d-none');
        
        try {
            const attendanceVideo = document.getElementById('attendanceVideo');
            await startCamera(attendanceVideo);
            await startAttendanceRecognition();
        } catch (err) {
            console.error('Failed to initialize Mode 2 camera/recognition:', err);
            showCameraErrorModal('Camera Access Required', 'Please allow camera access to start attendance recognition.');
        }
    } else if (newMode === 3) {
        // MODE 3 — MANAGE FACES & ATTENDANCE CONTROL
        div3.classList.remove('d-none');
        // Camera is OFF initially in Mode 3
        await renderStudentTable();
    }
}

/**
 * Render Registered Students Table in Mode 3
 */
async function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;

    try {
        const students = await getAllStudents();

        if (!students || students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="bi bi-people display-6 d-block mb-2 opacity-50"></i>
                        No registered students found.<br>
                        Click <strong>Register Student</strong> to add face descriptors.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        students.forEach(student => {
            const dateStr = student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-GB') : 'N/A';
            html += `
                <tr>
                    <td class="ps-4 fw-bold font-monospace">${escapeHtml(student.adminNo)}</td>
                    <td class="fw-semibold">${escapeHtml(student.name)}</td>
                    <td class="text-muted small">${dateStr}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="confirmDeleteStudent('${student.id}', '${escapeHtml(student.adminNo)}', '${escapeHtml(student.name)}')">
                            <i class="bi bi-trash me-1"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (err) {
        console.error('Error rendering student table:', err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Error loading students from IndexedDB</td></tr>`;
    }
}

/**
 * Handle "START NEW SESSION" Button Click in Mode 3
 */
function handleStartNewSession() {
    resetAttendanceSession();
    showToast('✓ New Attendance Session Started', 'success');
}

/**
 * Prepare Registration Form & Reset State
 */
function prepareRegisterModal() {
    document.getElementById('regAdminNo').value = '';
    document.getElementById('regStudentName').value = '';
    regCapturedSamples = [];
    updateSampleProgressUI();

    document.getElementById('btnStartRegCamera').disabled = false;
    document.getElementById('btnCaptureSample').disabled = true;
    document.getElementById('btnSaveStudent').disabled = true;
    document.getElementById('regCameraPlaceholder').classList.remove('d-none');
}

/**
 * Start Registration Camera Feed
 */
async function startRegistrationCamera() {
    const regVideo = document.getElementById('regVideo');
    const placeholder = document.getElementById('regCameraPlaceholder');

    try {
        await startCamera(regVideo);
        placeholder.classList.add('d-none');
        document.getElementById('btnCaptureSample').disabled = (regCapturedSamples.length >= 5);
        showToast('Registration camera active. Position face and click Capture Face.', 'info');
    } catch (err) {
        console.error('Registration camera error:', err);
        showToast('Failed to access camera for registration.', 'danger');
    }
}

/**
 * Capture single face sample for student registration (up to 5 samples)
 */
async function captureFaceSample() {
    if (regCapturedSamples.length >= 5) {
        showToast('5 samples already captured.', 'warning');
        return;
    }

    const regVideo = document.getElementById('regVideo');
    const btnCapture = document.getElementById('btnCaptureSample');

    btnCapture.disabled = true;
    btnCapture.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Detecting...';

    try {
        const descriptor = await detectSingleFaceDescriptor(regVideo);

        if (!descriptor) {
            showToast('No face detected! Please face the camera directly.', 'warning');
        } else {
            regCapturedSamples.push(descriptor);
            updateSampleProgressUI();
            showToast(`Sample ${regCapturedSamples.length}/5 captured!`, 'success');

            if (regCapturedSamples.length === 5) {
                document.getElementById('btnSaveStudent').disabled = false;
                showToast('All 5 samples captured successfully! Click Register Student.', 'success');
            }
        }
    } catch (err) {
        console.error('Error capturing sample:', err);
        showToast('Error detecting face sample.', 'danger');
    } finally {
        btnCapture.innerHTML = '<i class="bi bi-aspect-ratio me-1"></i> Capture Face';
        btnCapture.disabled = (regCapturedSamples.length >= 5);
    }
}

/**
 * Update Registration Samples Counter & Progress Bar UI
 */
function updateSampleProgressUI() {
    const count = regCapturedSamples.length;
    const countEl = document.getElementById('sampleCount');
    const barEl = document.getElementById('sampleProgressBar');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${(count / 5) * 100}%`;
}

/**
 * Save Student Object to IndexedDB
 */
async function saveStudentRegistration() {
    const adminNo = document.getElementById('regAdminNo').value.trim();
    const name = document.getElementById('regStudentName').value.trim();

    if (!adminNo || !name) {
        showToast('Please enter both Admin Number and Student Name.', 'warning');
        return;
    }

    if (regCapturedSamples.length < 5) {
        showToast('Please capture 5 face samples before saving.', 'warning');
        return;
    }

    try {
        const existing = await getStudentByAdminNo(adminNo);
        if (existing) {
            showCustomConfirm(
                'Overwrite Student Face Data?',
                `Student with Admin No ${adminNo} already exists (${existing.name}). Do you want to update their face data?`,
                'Overwrite',
                'btn-warning',
                async () => {
                    await performSaveStudent(existing.id, adminNo, name);
                }
            );
            return;
        }

        await performSaveStudent(null, adminNo, name);
    } catch (err) {
        console.error('Error in save student procedure:', err);
        showToast('Failed to save student registration.', 'danger');
    }
}

async function performSaveStudent(existingId, adminNo, name) {
    try {
        const studentData = {
            id: existingId || ('std_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
            adminNo: adminNo,
            name: name,
            descriptors: regCapturedSamples,
            createdAt: new Date().toISOString()
        };

        await saveStudent(studentData);
        showToast(`Registered ${name} (${adminNo}) successfully!`, 'success');

        await buildFaceMatcher();

        const modalEl = document.getElementById('registerModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        closeRegisterModal();

        await renderStudentTable();
    } catch (err) {
        console.error('Error saving student to IndexedDB:', err);
        showToast('Failed to save student registration.', 'danger');
    }
}

/**
 * Cleanup Registration Modal Camera
 */
function closeRegisterModal() {
    const regVideo = document.getElementById('regVideo');
    if (regVideo) {
        stopCamera(regVideo);
    }
    const placeholder = document.getElementById('regCameraPlaceholder');
    if (placeholder) placeholder.classList.remove('d-none');
}

/**
 * Confirm and Delete Student from IndexedDB (Using Custom Bootstrap Modal instead of native confirm())
 */
function confirmDeleteStudent(id, adminNo, name) {
    showCustomConfirm(
        'Remove Registered Student?',
        `Are you sure you want to remove ${name} (Admin No: ${adminNo})?`,
        'Remove',
        'btn-danger',
        async () => {
            try {
                await deleteStudent(id);
                showToast(`Deleted ${name} successfully.`, 'info');
                await buildFaceMatcher();
                await renderStudentTable();
            } catch (err) {
                console.error('Error deleting student:', err);
                showToast('Failed to delete student.', 'danger');
            }
        }
    );
}

/**
 * Custom Modal Confirmation Helper (Replaces native browser confirm() popups)
 */
function showCustomConfirm(title, message, confirmBtnText, confirmBtnClass, onConfirmCallback) {
    const titleEl = document.getElementById('confirmModalTitle');
    const bodyEl = document.getElementById('confirmModalBody');
    const actionBtn = document.getElementById('confirmModalActionBtn');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;

    if (actionBtn) {
        actionBtn.textContent = confirmBtnText || 'Confirm';
        actionBtn.className = `btn rounded-pill px-4 ${confirmBtnClass || 'btn-danger'}`;
        actionBtn.onclick = () => {
            const modalEl = document.getElementById('customConfirmModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            if (typeof onConfirmCallback === 'function') {
                onConfirmCallback();
            }
        };
    }

    const modalEl = document.getElementById('customConfirmModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Custom Camera Error Modal Helper (Replaces native browser alert() popups)
 */
function showCameraErrorModal(title, message) {
    const titleEl = document.getElementById('cameraErrorTitle');
    const bodyEl = document.getElementById('cameraErrorBody');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;

    const modalEl = document.getElementById('cameraErrorModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'dark') {
    const toastEl = document.getElementById('appToast');
    const msgEl = document.getElementById('toastMessage');
    if (!toastEl || !msgEl) return;

    msgEl.textContent = message;
    toastEl.className = `toast align-items-center text-white bg-${type} border-0 shadow`;

    const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
    toast.show();
}

/**
 * Orientation Listener for Portrait Warning Banner
 */
function checkOrientation() {
    const banner = document.getElementById('portraitWarning');
    if (!banner) return;

    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
        banner.classList.remove('d-none');
    } else {
        banner.classList.add('d-none');
    }
}

window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

/**
 * HTML Escaping Helper
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
