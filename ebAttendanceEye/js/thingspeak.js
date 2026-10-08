/**
 * ThingSpeak Polling Integration
 * Channel ID: 3525653
 * Read API Key: 3GE9PFBMD6D4EDHM
 * Field 1: Mode (1 = EYE, 2 = ATTENDANCE, 3 = MANAGE FACES)
 */

const THINGSPEAK_CHANNEL_ID = "3525653";
const THINGSPEAK_READ_API_KEY = "3GE9PFBMD6D4EDHM";
const THINGSPEAK_POLL_URL = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/fields/1/last.json?api_key=${THINGSPEAK_READ_API_KEY}`;

let currentMode = null;
let thingspeakPollTimer = null;

/**
 * Poll ThingSpeak API for the latest Field 1 mode value
 */
async function checkThingSpeakMode() {
    try {
        // Cache bust query parameter to ensure fresh read from ThingSpeak API
        const fetchUrl = `${THINGSPEAK_POLL_URL}&_=${Date.now()}`;
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            console.warn(`ThingSpeak HTTP status: ${response.status}`);
            return;
        }

        const data = await response.json();
        if (data && data.field1 !== undefined && data.field1 !== null) {
            const rawVal = parseInt(data.field1, 10);
            if (!isNaN(rawVal) && [1, 2, 3].includes(rawVal)) {
                if (rawVal !== currentMode) {
                    console.log(`ThingSpeak Mode Changed: ${currentMode} -> ${rawVal}`);
                    switchMode(rawVal);
                }
            } else {
                console.log('ThingSpeak Field 1 returned non-mode value:', data.field1);
            }
        }
    } catch (err) {
        console.warn('ThingSpeak polling connection unavailable:', err.message);
    }
}

/**
 * Start recurring 3-second polling interval
 */
function startThingSpeakPolling() {
    if (thingspeakPollTimer) {
        clearInterval(thingspeakPollTimer);
    }
    // Perform initial check immediately
    checkThingSpeakMode();
    // Set 3 second recurring check
    thingspeakPollTimer = setInterval(checkThingSpeakMode, 3000);
}

/**
 * Stop polling interval
 */
function stopThingSpeakPolling() {
    if (thingspeakPollTimer) {
        clearInterval(thingspeakPollTimer);
        thingspeakPollTimer = null;
    }
}
