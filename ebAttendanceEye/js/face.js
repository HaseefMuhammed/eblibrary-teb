/**
 * Face-API.js AI Engine Integration
 * Model loading, descriptor generation, and face matcher building.
 */

const FACE_MATCH_THRESHOLD = 0.50;

let isModelsLoaded = false;
let globalFaceMatcher = null;

/**
 * Load face-api pretrained models (Tiny Face Detector, Landmark 68, Recognition)
 */
async function loadFaceApiModels() {
    if (isModelsLoaded) return true;

    const statusEl = document.getElementById('startupStatus');
    if (statusEl) statusEl.textContent = 'Loading face recognition models...';

    const modelLocations = [
        './models',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
    ];

    let loaded = false;
    for (const location of modelLocations) {
        try {
            console.log(`Attempting to load face-api models from ${location}...`);
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(location),
                faceapi.nets.faceLandmark68Net.loadFromUri(location),
                faceapi.nets.faceRecognitionNet.loadFromUri(location)
            ]);
            loaded = true;
            console.log(`Successfully loaded face-api models from ${location}`);
            break;
        } catch (err) {
            console.warn(`Failed to load models from ${location}:`, err);
        }
    }

    if (!loaded) {
        showToast('Unable to load face recognition models. Check your internet connection.', 'danger');
        if (statusEl) statusEl.textContent = 'Face models load failed!';
        throw new Error('Face API models failed to load');
    }

    isModelsLoaded = true;
    if (statusEl) statusEl.textContent = 'Face recognition ready';
    return true;
}

/**
 * Rebuild FaceMatcher with up-to-date registered student descriptors from IndexedDB
 */
async function buildFaceMatcher() {
    try {
        const students = await getAllStudents();
        if (!students || students.length === 0) {
            globalFaceMatcher = null;
            console.log('No registered students found in IndexedDB for face matcher.');
            return null;
        }

        const labeledDescriptors = [];
        for (const student of students) {
            if (student.descriptors && student.descriptors.length > 0) {
                // Convert array of descriptor arrays back to Float32Array instances
                const floatDescriptors = student.descriptors.map(d => new Float32Array(d));
                // Encode label format: adminNo||name
                const label = `${student.adminNo}||${student.name}`;
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, floatDescriptors));
            }
        }

        if (labeledDescriptors.length > 0) {
            globalFaceMatcher = new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD);
            console.log(`FaceMatcher built with ${labeledDescriptors.length} registered students.`);
        } else {
            globalFaceMatcher = null;
        }
        return globalFaceMatcher;
    } catch (err) {
        console.error('Error building FaceMatcher:', err);
        globalFaceMatcher = null;
        return null;
    }
}

/**
 * Capture single face descriptor from video element (used during registration)
 */
async function detectSingleFaceDescriptor(videoElement) {
    if (!isModelsLoaded) {
        throw new Error('Face models not loaded yet.');
    }

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const detection = await faceapi.detectSingleFace(videoElement, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        return null;
    }

    // Convert Float32Array to standard JS Array for IndexedDB compatibility
    return Array.from(detection.descriptor);
}
