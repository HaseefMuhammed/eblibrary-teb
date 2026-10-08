/**
 * ============================================================================
 * EDU BOT AI — DIGITAL INAUGURATION SYSTEM
 * Simple, Elegant, Ceremonial Interface with Party Poppers & Audio Synthesis
 * ============================================================================
 */

/* ==========================================================================
   THINGSPEAK CONFIGURATION
   Enter your ThingSpeak IoT hardware details below before deployment.
   Leave the spaces below to add them manually as needed.
   ========================================================================== */
const THINGSPEAK_CHANNEL_ID = "3525679";
const THINGSPEAK_READ_API_KEY = "TKS4NC7JB2EVAG7N";
const THINGSPEAK_WRITE_API_KEY = "9DCMH5GVC1KW7098";
const THINGSPEAK_FIELD = 1;

// Polling interval in milliseconds (approx 2.5 seconds)
const THINGSPEAK_POLL_INTERVAL = 2500;

// Target website to load inside fullscreen iframe
const TARGET_WEBSITE_URL = "https://edubotai.tebinnovations.in/";

/* ==========================================================================
   SYSTEM STATE & TRACKING
   ========================================================================== */
let initialEntryId = null;
let lastSeenEntryId = null;
let lastSeenCreatedAt = null;
let isBaselineEstablished = false;
let isCeremonyStarted = false;
let pollingTimer = null;
let audioContext = null;

// DOM Elements
const stageEl = document.getElementById("inauguration-stage");
const ribbonContainer = document.getElementById("ribbonContainer");
const ceremonyRibbon = document.getElementById("ceremonyRibbon");
const ceremonialScissors = document.getElementById("ceremonialScissors");
const ribbonLeft = document.getElementById("ribbonLeft");
const ribbonRight = document.getElementById("ribbonRight");
const ribbonCenter = document.getElementById("ribbonCenter");
const cutFlash = document.getElementById("cutFlash");
const sheens = document.querySelectorAll(".ribbon-sheen");
const ceremonyHeading = document.getElementById("ceremonyHeading");
const ceremonyInstruction = document.getElementById("ceremonyInstruction");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const ceremonyMessageOverlay = document.getElementById("ceremony-message-overlay");
const websiteContainer = document.getElementById("website-container");
const eduBotFrame = document.getElementById("eduBotFrame");
const iframeLoader = document.getElementById("iframeLoader");
const fullscreenPrompt = document.getElementById("fullscreen-prompt");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const toolbarFullscreenBtn = document.getElementById("toolbarFullscreenBtn");
const toolbarReplayBtn = document.getElementById("toolbarReplayBtn");
const pwaInstallCard = document.getElementById("pwa-install-card");
const pwaInstallButton = document.getElementById("pwa-install-button");
const pwaInstallDismiss = document.getElementById("pwa-install-dismiss");
const pwaInstallMessage = document.getElementById("pwa-install-message");
let deferredInstallPrompt = null;

const PWA_INSTALL_DISMISSED_KEY = "edubot-ai-pwa-install-dismissed";

/* ==========================================================================
   1. SYSTEM INITIALIZATION
   ========================================================================== */
function initializeSystem() {
    setupEventListeners();
    setupPwaInstallPrompt();
    registerServiceWorker();
    initCustomPopperCanvas();
    updateStatus("READY FOR INAUGURATION", true);

    // Preload iframe early for instant smooth viewing
    if (eduBotFrame && !eduBotFrame.src) {
        eduBotFrame.src = TARGET_WEBSITE_URL;
    }

    if (eduBotFrame) {
        eduBotFrame.addEventListener("load", () => {
            if (iframeLoader) iframeLoader.classList.add("hidden");
        });
        // Fallback hide loader after 3.5s just in case
        setTimeout(() => {
            if (iframeLoader) iframeLoader.classList.add("hidden");
        }, 3500);
    }

    // Initial check to record baseline entry_id so old data won't trigger inauguration
    fetchInitialBaseline();

    // Start periodic polling
    startPolling();
}

function setupPwaInstallPrompt() {
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
    if (isInstalled || !pwaInstallCard) return;

    let wasDismissed = false;
    try {
        wasDismissed = localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === "true";
    } catch (error) {
        console.warn("[PWA] Could not read install prompt preference:", error);
    }
    if (!wasDismissed) pwaInstallCard.hidden = false;

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
    });

    window.addEventListener("appinstalled", () => {
        pwaInstallCard.hidden = true;
        deferredInstallPrompt = null;
        rememberInstallPromptDismissal();
    });

    pwaInstallButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
            pwaInstallMessage.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                ? "To install, tap Share in your browser, then choose Add to Home Screen."
                : "To install, open your browser menu and choose Install app or Add to Home Screen.";
            return;
        }

        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice.outcome === "accepted") {
            pwaInstallCard.hidden = true;
            rememberInstallPromptDismissal();
        }
    });

    pwaInstallDismiss.addEventListener("click", () => {
        pwaInstallCard.hidden = true;
        rememberInstallPromptDismissal();
    });
}

function rememberInstallPromptDismissal() {
    try {
        localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
    } catch (error) {
        console.warn("[PWA] Could not save install prompt preference:", error);
    }
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("./service-worker.js")
        .catch((error) => {
            console.error("[PWA] Service worker registration failed:", error);
        });
}

/* ==========================================================================
   2. THINGSPEAK CONNECTION & BASELINE DETECTION
   ========================================================================== */
function getThingSpeakUrl() {
    if (!THINGSPEAK_CHANNEL_ID || THINGSPEAK_CHANNEL_ID === "YOUR_CHANNEL_ID") {
        return null;
    }
    let url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/fields/${THINGSPEAK_FIELD}/last.json`;
    if (THINGSPEAK_READ_API_KEY && THINGSPEAK_READ_API_KEY !== "YOUR_READ_API_KEY" && THINGSPEAK_READ_API_KEY.trim() !== "") {
        url += `?api_key=${encodeURIComponent(THINGSPEAK_READ_API_KEY.trim())}`;
    }
    return url;
}

/**
 * On page load, captures current entry_id to prevent triggering from old '1'
 */
async function fetchInitialBaseline() {
    const url = getThingSpeakUrl();
    if (!url) {
        console.info("[ThingSpeak] Ready in Standby/Demo mode. Enter your Channel ID in script.js to connect live hardware.");
        isBaselineEstablished = true;
        return;
    }

    try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
            const data = await response.json();
            if (data && data.entry_id !== undefined) {
                initialEntryId = data.entry_id;
                lastSeenEntryId = data.entry_id;
                lastSeenCreatedAt = data.created_at;
                isBaselineEstablished = true;
                console.log(`[ThingSpeak Baseline Set] Initial Entry ID: ${initialEntryId}. System is waiting for a NEW entry.`);
                updateStatus("READY FOR INAUGURATION", true);
                return;
            }
        }
    } catch (err) {
        console.warn("[ThingSpeak Initial Check]", err.message);
    }
    isBaselineEstablished = true;
}

function startPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(checkThingSpeak, THINGSPEAK_POLL_INTERVAL);
}

function stopPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
}

/**
 * Periodically polls ThingSpeak for new signals
 */
async function checkThingSpeak() {
    if (isCeremonyStarted) return;

    const url = getThingSpeakUrl();
    if (!url) return;

    try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
            updateStatus("READY", false);
            return;
        }

        const data = await response.json();
        updateStatus("READY FOR INAUGURATION", true);

        if (!data || data.entry_id === undefined) return;

        // Verify if entry is NEW (arrived after page was opened)
        const isNewEntry = (lastSeenEntryId !== null)
            ? (data.entry_id > lastSeenEntryId)
            : (lastSeenCreatedAt !== null ? data.created_at !== lastSeenCreatedAt : true);

        if (isNewEntry) {
            lastSeenEntryId = data.entry_id;
            lastSeenCreatedAt = data.created_at;

            const fieldValue = data[`field${THINGSPEAK_FIELD}`];
            console.log(`[ThingSpeak New Entry] #${data.entry_id}, Field ${THINGSPEAK_FIELD} = "${fieldValue}"`);

            // If value is 1, trigger inauguration ceremony
            if (fieldValue !== null && String(fieldValue).trim() === "1") {
                handleSignal();
            }
        }
    } catch (error) {
        updateStatus("READY", false);
    }
}

/* ==========================================================================
   2.1 THINGSPEAK WRITE API & RELAUNCH LOGIC
   ========================================================================== */
/**
 * Writes a value (1 for Inauguration done, 0 for Relaunch) to ThingSpeak via Write API key
 */
async function sendThingSpeakValue(value) {
    if (!THINGSPEAK_WRITE_API_KEY || THINGSPEAK_WRITE_API_KEY === "YOUR_WRITE_API_KEY") {
        console.warn("[ThingSpeak Write] Write API key not configured.");
        return;
    }

    try {
        const url = `https://api.thingspeak.com/update?api_key=${encodeURIComponent(THINGSPEAK_WRITE_API_KEY.trim())}&field${THINGSPEAK_FIELD}=${value}`;
        console.log(`[ThingSpeak Write] Updating Field ${THINGSPEAK_FIELD} to "${value}"...`);

        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
            const entryIdStr = await response.text();
            const entryId = parseInt(entryIdStr, 10);
            if (!isNaN(entryId) && entryId > 0) {
                console.log(`[ThingSpeak Write Success] Field ${THINGSPEAK_FIELD} updated to ${value}. New Entry ID: ${entryId}`);
                lastSeenEntryId = entryId;
            } else {
                console.warn(`[ThingSpeak Write Response] ThingSpeak response: ${entryIdStr}`);
            }
        } else {
            console.error(`[ThingSpeak Write Failed] HTTP Status: ${response.status}`);
        }
    } catch (err) {
        console.error("[ThingSpeak Write Exception]", err);
    }
}

/**
 * Handles Relaunch button action: sends 0 to ThingSpeak and resets ceremony state
 */
async function handleRelaunch() {
    console.log("[Relaunch] Sending 0 to ThingSpeak and resetting ceremony...");
    updateStatus("RELAUNCHING...", true);
    await sendThingSpeakValue(0);
    resetCeremony();
}

/* ==========================================================================
   3. INAUGURATION CEREMONY TIMELINE WITH SCISSORS, SOUND & POPPERS
   ========================================================================== */
function handleSignal() {
    if (isCeremonyStarted) return;
    isCeremonyStarted = true;
    stopPolling();
    startCeremony();
}

/**
 * Step-by-step ceremony animation (~3 to 4 seconds total)
 */
function startCeremony() {
    // 1. Screen slightly darkens & title emphasizes
    document.body.classList.add("ceremony-active");
    if (ceremonyHeading) ceremonyHeading.textContent = "INAUGURATION IN PROGRESS";
    if (ceremonyInstruction) ceremonyInstruction.textContent = "Ceremony in Progress...";
    updateStatus("INAUGURATION ACTIVE", true);

    // 2. Play realistic scissor cutting sound & trigger scissor snip
    playCuttingSound();
    if (ceremonialScissors) {
        ceremonialScissors.classList.add("cutting");
    }

    // 3. Silk sheen sweeps across ribbon
    sheens.forEach(sheen => sheen.classList.add("active"));

    // 4. Ribbon cuts after 350ms with party poppers, flash, and joy sound!
    setTimeout(() => {
        cutRibbon();
    }, 350);
}

/**
 * Animates the ceremonial ribbon separating, firing party poppers & joy sound
 */
function cutRibbon() {
    // Flash spark on the knot
    if (cutFlash) cutFlash.classList.add("flash");

    // Ribbon separates with realistic cloth tension release
    if (ribbonLeft) ribbonLeft.classList.add("cut");
    if (ribbonRight) ribbonRight.classList.add("cut");
    if (ribbonCenter) ribbonCenter.classList.add("cut");

    // Fade scissors away gently
    if (ceremonialScissors) {
        ceremonialScissors.classList.add("fade-away");
    }

    // FIRE PARTY POPPERS (Confetti cannon explosions!)
    triggerPartyPoppers();

    // PLAY JOYFUL CELEBRATORY FANFARE & POP SOUND EFFECT
    playJoySound();

    // SEND 1 TO THINGSPEAK (Inauguration Done)
    sendThingSpeakValue(1);

    // 5. Ceremony message display (~1000ms after cut)
    setTimeout(() => {
        showInaugurationMessage();
    }, 1000);
}

/**
 * Briefly displays "INAUGURATED / WELCOME TO EDU BOT AI"
 */
function showInaugurationMessage() {
    if (ceremonyMessageOverlay) {
        ceremonyMessageOverlay.classList.add("show");
    }

    // 6. Transition to fullscreen website after ~1.4s
    setTimeout(() => {
        openEduBot();
    }, 1400);
}

/**
 * Fades out inauguration screen smoothly and reveals target platform iframe
 */
function openEduBot() {
    if (ceremonyMessageOverlay) {
        ceremonyMessageOverlay.classList.remove("show");
    }
    if (stageEl) {
        stageEl.classList.add("fade-out");
    }
    if (websiteContainer) {
        websiteContainer.classList.add("active");
    }

    // Ensure iframe is loaded
    if (eduBotFrame && !eduBotFrame.src) {
        eduBotFrame.src = TARGET_WEBSITE_URL;
    }

    // Gracefully attempt automatic browser fullscreen
    requestFullscreen();
}

/**
 * Attempts browser fullscreen; gracefully handles browser gesture policies
 */
function requestFullscreen() {
    const docEl = document.documentElement;
    const requestMethod = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;

    if (requestMethod) {
        requestMethod.call(docEl)
            .then(() => {
                if (fullscreenPrompt) fullscreenPrompt.classList.add("d-none");
            })
            .catch(() => {
                // If browser requires explicit user gesture, show minimal button
                if (fullscreenPrompt) fullscreenPrompt.classList.remove("d-none");
            });
    } else {
        if (fullscreenPrompt) fullscreenPrompt.classList.remove("d-none");
    }
}

/**
 * Resets the ceremony back to initial waiting state
 */
function resetCeremony() {
    console.log("[System] Resetting ceremony to initial state...");
    isCeremonyStarted = false;

    // Reset UI elements
    document.body.classList.remove("ceremony-active");
    if (stageEl) stageEl.classList.remove("fade-out");
    if (ceremonyMessageOverlay) ceremonyMessageOverlay.classList.remove("show");
    if (websiteContainer) websiteContainer.classList.remove("active");
    if (fullscreenPrompt) fullscreenPrompt.classList.add("d-none");

    if (ceremonialScissors) {
        ceremonialScissors.classList.remove("cutting", "fade-away");
    }
    if (cutFlash) cutFlash.classList.remove("flash");

    if (ribbonLeft) ribbonLeft.classList.remove("cut");
    if (ribbonRight) ribbonRight.classList.remove("cut");
    if (ribbonCenter) ribbonCenter.classList.remove("cut");
    sheens.forEach(sheen => sheen.classList.remove("active"));

    if (ceremonyHeading) ceremonyHeading.textContent = "INAUGURATION CEREMONY";
    if (ceremonyInstruction) ceremonyInstruction.textContent = "Please proceed to inaugurate EDU BOT AI";
    updateStatus("READY FOR INAUGURATION", true);

    // Restart polling
    startPolling();
}

/* ==========================================================================
   4. AUDIO SYNTHESIS: REALISTIC CUTTING SOUND & JOY SOUND EFFECT
   ========================================================================== */
function getAudioContext() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }
    return audioContext;
}

/**
 * Realistic Scissor Snip & Cloth Cutting Sound Effect (Web Audio API)
 */
function playCuttingSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // 1. Blade friction glide (metallic friction noise)
        const bufferSize = Math.floor(ctx.sampleRate * 0.08);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(3200, now);
        filter.Q.setValueAtTime(3, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);

        // 2. Sharp mechanical scissor closure "SNIP!" impact
        const snipOsc = ctx.createOscillator();
        const snipGain = ctx.createGain();
        snipOsc.type = "sine";
        snipOsc.frequency.setValueAtTime(2800, now + 0.035);
        snipOsc.frequency.exponentialRampToValueAtTime(360, now + 0.09);
        snipGain.gain.setValueAtTime(0.55, now + 0.035);
        snipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        snipOsc.connect(snipGain);
        snipGain.connect(ctx.destination);
        snipOsc.start(now + 0.035);
        snipOsc.stop(now + 0.12);

        // 3. Silk fabric parting / shear sound
        const clothOsc = ctx.createOscillator();
        const clothGain = ctx.createGain();
        clothOsc.type = "triangle";
        clothOsc.frequency.setValueAtTime(1400, now + 0.05);
        clothOsc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
        clothGain.gain.setValueAtTime(0.25, now + 0.05);
        clothGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        clothOsc.connect(clothGain);
        clothGain.connect(ctx.destination);
        clothOsc.start(now + 0.05);
        clothOsc.stop(now + 0.2);
    } catch (e) {
        console.warn("Audio cut sound error:", e);
    }
}

/**
 * Party Popper "POP!" + Joyful Celebratory Fanfare Chimes (Web Audio API)
 */
function playJoySound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // 1. Party Popper Acoustic "POP!"
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = "triangle";
        popOsc.frequency.setValueAtTime(480, now);
        popOsc.frequency.exponentialRampToValueAtTime(65, now + 0.08);
        popGain.gain.setValueAtTime(0.7, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        popOsc.connect(popGain);
        popGain.connect(ctx.destination);
        popOsc.start(now);
        popOsc.stop(now + 0.12);

        // 2. Joyful Celebratory Chimes & Fanfare Bell Arpeggio
        // Notes: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz), E6 (1318Hz), G6 (1568Hz)
        const chimeNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
        chimeNotes.forEach((freq, idx) => {
            const noteStart = now + 0.06 + idx * 0.085;

            // Fundamental Chime Tone
            const chimeOsc = ctx.createOscillator();
            const chimeGain = ctx.createGain();
            chimeOsc.type = "sine";
            chimeOsc.frequency.setValueAtTime(freq, noteStart);
            chimeGain.gain.setValueAtTime(0, noteStart);
            chimeGain.gain.linearRampToValueAtTime(0.18, noteStart + 0.015);
            chimeGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.8);
            chimeOsc.connect(chimeGain);
            chimeGain.connect(ctx.destination);
            chimeOsc.start(noteStart);
            chimeOsc.stop(noteStart + 1.9);

            // Shimmer Bell Overtones
            const harmonic = ctx.createOscillator();
            const harmonicGain = ctx.createGain();
            harmonic.type = "triangle";
            harmonic.frequency.setValueAtTime(freq * 2, noteStart);
            harmonicGain.gain.setValueAtTime(0, noteStart);
            harmonicGain.gain.linearRampToValueAtTime(0.06, noteStart + 0.01);
            harmonicGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.9);
            harmonic.connect(harmonicGain);
            harmonicGain.connect(ctx.destination);
            harmonic.start(noteStart);
            harmonic.stop(noteStart + 1.0);
        });
    } catch (e) {
        console.warn("Audio joy sound error:", e);
    }
}

/* ==========================================================================
   5. CELEBRATORY PARTY POPPERS / CONFETTI CANNON BLAST
   ========================================================================== */
function triggerPartyPoppers() {
    // Confetti palette: Gold, Brand Emerald, Ribbon Crimson, Crisp White, Amber, Deep Navy
    const colors = ["#ffd700", "#1acc8d", "#e52d27", "#ffffff", "#ffb703", "#040677"];

    // Use standard canvas-confetti library if loaded
    if (typeof confetti === "function") {
        // Popper 1: Left Cannon (Shooting inward from bottom left)
        confetti({
            particleCount: 80,
            angle: 55,
            spread: 65,
            origin: { x: 0.12, y: 0.85 },
            colors: colors,
            startVelocity: 48,
            gravity: 0.9,
            scalar: 1.2,
            ticks: 250
        });

        // Popper 2: Right Cannon (Shooting inward from bottom right)
        confetti({
            particleCount: 80,
            angle: 125,
            spread: 65,
            origin: { x: 0.88, y: 0.85 },
            colors: colors,
            startVelocity: 48,
            gravity: 0.9,
            scalar: 1.2,
            ticks: 250
        });

        // Popper 3: Knot Center Burst (Exploding 360 degrees right where ribbon splits)
        confetti({
            particleCount: 100,
            spread: 100,
            origin: { x: 0.5, y: 0.52 },
            colors: colors,
            startVelocity: 36,
            gravity: 0.85,
            scalar: 1.1,
            ticks: 280
        });

        // Second celebratory wave after 350ms
        setTimeout(() => {
            confetti({
                particleCount: 60,
                angle: 65,
                spread: 70,
                origin: { x: 0.2, y: 0.8 },
                colors: colors,
                startVelocity: 42
            });
            confetti({
                particleCount: 60,
                angle: 115,
                spread: 70,
                origin: { x: 0.8, y: 0.8 },
                colors: colors,
                startVelocity: 42
            });
        }, 350);
    } else {
        // Fallback custom canvas party poppers
        launchCustomPoppers();
    }
}

/* Fallback High-Performance 2D Canvas Party Popper Engine */
let customPopperParticles = [];
let popperAnimId = null;

function initCustomPopperCanvas() {
    const canvas = document.getElementById("popperCanvas");
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

function launchCustomPoppers() {
    const canvas = document.getElementById("popperCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const colors = ["#ffd700", "#1acc8d", "#e52d27", "#ffffff", "#ffb703", "#040677"];
    const count = 160;

    // Spawn popper particles from bottom corners and center
    for (let i = 0; i < count; i++) {
        const fromLeft = i % 3 === 0;
        const fromRight = i % 3 === 1;

        const startX = fromLeft ? width * 0.15 : (fromRight ? width * 0.85 : width * 0.5);
        const startY = fromLeft || fromRight ? height * 0.85 : height * 0.52;

        const baseAngle = fromLeft ? -Math.PI / 3 : (fromRight ? -2 * Math.PI / 3 : -Math.PI / 2);
        const angle = baseAngle + (Math.random() - 0.5) * 1.1;
        const speed = Math.random() * 14 + 10;

        customPopperParticles.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            w: Math.random() * 8 + 4,
            h: Math.random() * 12 + 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 14,
            decay: Math.random() * 0.008 + 0.005
        });
    }

    if (popperAnimId) cancelAnimationFrame(popperAnimId);

    function render() {
        ctx.clearRect(0, 0, width, height);
        let active = 0;

        customPopperParticles.forEach((p) => {
            if (p.alpha > 0.01) {
                active++;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.32; // Gravity
                p.vx *= 0.985;
                p.alpha -= p.decay;
                p.rotation += p.vRot;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        });

        if (active > 0) {
            popperAnimId = requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, width, height);
            customPopperParticles = [];
        }
    }
    render();
}

function updateStatus(text, isReady) {
    if (statusText) statusText.textContent = text;
    if (statusDot) {
        if (isReady) {
            statusDot.classList.remove("standby");
        } else {
            statusDot.classList.add("standby");
        }
    }
}

/* ==========================================================================
   6. EVENT LISTENERS & SHORTCUTS
   ========================================================================== */
function setupEventListeners() {
    // Unlock Web Audio API on first user interaction
    document.addEventListener("pointerdown", () => getAudioContext(), { once: true });

    // Interactive Ribbon Click to Cut (Direct Click/Tap)
    const triggerElements = [ribbonContainer, ceremonyRibbon, ribbonCenter, ribbonLeft, ribbonRight, ceremonialScissors];
    triggerElements.forEach(el => {
        if (el) {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                getAudioContext();
                console.log("[User Interaction] Ribbon clicked -> Cutting ribbon now!");
                handleSignal();
            });
        }
    });

    // Fullscreen fallback button click
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
            getAudioContext();
            requestFullscreen();
            if (fullscreenPrompt) fullscreenPrompt.classList.add("d-none");
        });
    }

    // Toolbar Fullscreen Toggle
    if (toolbarFullscreenBtn) {
        toolbarFullscreenBtn.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    // Top Header Bar Relaunch Button (Sends 0 to ThingSpeak & Resets)
    const topRelaunchBtn = document.getElementById("topRelaunchBtn");
    if (topRelaunchBtn) {
        topRelaunchBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            getAudioContext();
            handleRelaunch();
        });
    }

    // Toolbar Relaunch Button (Sends 0 to ThingSpeak & Resets)
    const toolbarRelaunchBtn = document.getElementById("toolbarRelaunchBtn");
    if (toolbarRelaunchBtn) {
        toolbarRelaunchBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            getAudioContext();
            handleRelaunch();
        });
    }

    const toolbarReplayBtn = document.getElementById("toolbarReplayBtn");
    if (toolbarReplayBtn) {
        toolbarReplayBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            getAudioContext();
            handleRelaunch();
        });
    }

    // Keyboard Shortcuts for Exhibition Testing / Backup
    window.addEventListener("keydown", (e) => {
        getAudioContext();

        // Prevent accidental triggers when typing in input/textarea (if any)
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        // Key 'D' (or Ctrl+Shift+D or Space or Enter): Cut Ribbon
        if (e.key === "d" || e.key === "D" || e.key === " " || e.key === "Enter" || (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d"))) {
            e.preventDefault();
            console.log("[Shortcut Trigger] Ribbon cut triggered via keyboard ('" + e.key + "')");
            handleSignal();
        }

        // Key 'R' (or Ctrl+Shift+R): Reset Ceremony & Send 0
        if (e.key === "r" || e.key === "R" || (e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r"))) {
            e.preventDefault();
            console.log("[Shortcut Trigger] Relaunch triggered via keyboard ('" + e.key + "')");
            handleRelaunch();
        }
    });
}

/* ==========================================================================
   DOM READY BOOTSTRAP
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    initializeSystem();
});
