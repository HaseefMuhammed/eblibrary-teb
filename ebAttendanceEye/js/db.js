/**
 * IndexedDB storage manager for EDU BOT AI Smart Attendance
 * Database: EDUBOTAttendance
 * Object Store: students
 */

const DB_NAME = 'EDUBOTAttendance';
const DB_VERSION = 1;
const STORE_NAME = 'students';

let dbInstance = null;

function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('adminNo', 'adminNo', { unique: true });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            console.log('IndexedDB initialized successfully.');
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB initialization failed:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Save student object with array of descriptors
 */
async function saveStudent(studentData) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Generate unique ID if not present
        if (!studentData.id) {
            studentData.id = 'std_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        }
        if (!studentData.createdAt) {
            studentData.createdAt = new Date().toISOString();
        }

        const request = store.put(studentData);

        request.onsuccess = () => resolve(studentData);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Retrieve all registered students
 */
async function getAllStudents() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Delete a student by ID
 */
async function deleteStudent(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Get student by Admin Number
 */
async function getStudentByAdminNo(adminNo) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('adminNo');
        const request = index.get(adminNo);

        request.onsuccess = (event) => resolve(event.target.result || null);
        request.onerror = (event) => reject(event.target.error);
    });
}
