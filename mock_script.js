// ================== STATE AND APP VARIABLES PARAMETERS ==================
const subject      = localStorage.getItem('last_active_subject') || "samanya_gyan"; 
const branch       = localStorage.getItem('last_active_branch_guj') || "ગુજરાતનો ઇતિહાસ"; 
const branchFolder = localStorage.getItem('last_active_branch') || "gujarat_history"; 
const type         = localStorage.getItem('last_active_type') || "Mock Test";
const quizNo       = localStorage.getItem('last_active_quiz_no') || "1";

let originalData = [];
let quizData = [];
let timeLeft = 1500; // 25 Mins
let timerInterval;
let testSubmitted = false;
let userAnswers = {}; 
let isSoundMuted = false;

// WEB AUDIO CLICK SOUND GENERATOR
let audioCtx = null;
function playClickSound() {
    if (isSoundMuted) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
}

function toggleSoundEngine() {
    isSoundMuted = !isSoundMuted;
    document.getElementById('sound-toggle-btn').innerText = isSoundMuted ? '🔇' : '🔊';
}

const STORAGE_KEY = `mock_${subject}_${branchFolder}_${type}_${quizNo}_v1`;

function getGujNumber(num) {
    const digits = {'0':'૦','1':'૧','2':'૨','3':'૩','4':'૪','5':'૫','6':'૬','7':'૭','8':'૮','9':'૯'};
    return String(num).split('').map(d => digits[d] || d).join('');
}

// DYNAMICALLY SYNC ALL HEADERS (NORMAL, RESULT & REVIEW)
const formattedDynamicTitle = `${branch.split('(')[0].trim()} - ${type} ${quizNo}`;

document.getElementById('main-title').innerText = branch.split('(')[0].trim();
document.getElementById('sub-title').innerText = `📝 મોક ટેસ્ટ - ${getGujNumber(quizNo)}`;
document.getElementById('res-dynamic-title').innerText = formattedDynamicTitle;
document.getElementById('review-title').innerText = formattedDynamicTitle;

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// SETUP CORE INITIAL SECTIONS
async function initMockEngine() {
    try {
        const res = await fetch(`data/${subject}/${branchFolder}/${type}_${quizNo}.json?v=${new Date().getTime()}`);
        if(!res.ok) throw new Error("Dataset response bad");
        originalData = await res.json();
        originalData = originalData.slice(0, 25); 

        let saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            let parsed = JSON.parse(saved);
            if (parsed.submitted) {
                localStorage.removeItem(STORAGE_KEY);
                setupFreshPaper();
            } else {
                quizData = parsed.quizData;
                userAnswers = parsed.userAnswers || {};
                timeLeft = parsed.timeLeft;
            }
        } else {
            setupFreshPaper();
        }

        buildUIElements();
        restoreRadioClicks();
        startTimerEngine();
    } catch(err) {
        alert("મોક ટેસ્ટ ફાઈલ ડેટાબેઝમાં મળી નથી!");
        window.history.back();
    }
}

function setupFreshPaper() {
    quizData = originalData.map((item, originalIdx) => {
        const rightOptionText = item.options[item.correct];
        let optionsShuffled = [...item.options];
        shuffleArray(optionsShuffled);
        const newCorrectIdx = optionsShuffled.indexOf(rightOptionText);
        
        return {
            id: originalIdx,
            q: item.q,
            options: optionsShuffled,
            correct: newCorrectIdx,
            img: item.img || null,
            explain_img: item.explain_img || null,
            explanation: item.explanation || ""
        };
    });
    shuffleArray(quizData);
}

// ================== SHEET RENDERER ENGINE ==================
function buildUIElements() {
    const container = document.getElementById('questions-container');
    container.innerHTML = "";

    quizData.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'question-block';
        div.id = `q-block-${idx}`;
        
        let imgHtml = item.img ? `<div class="q-image-frame"><img src="${item.img}" alt="Question Graphic Diagram"></div>` : '';
        
        div.innerHTML = `
            <div class="q-block-head">
                <span class="q-num-badge">પ્રશ્ન ${idx + 1} / ${quizData.length}</span>
            </div>
            ${imgHtml}
            <span class="math-text">${item.q}</span>
            <div class="options-list">
                ${item.options.map((opt, oIdx) => `
                    <label class="opt-label" id="label-${idx}-${oIdx}">
                        <div class="opt-left-core">
                            <input type="radio" name="q${idx}" value="${oIdx}" onchange="registerAnswer(${idx}, ${oIdx})">
                            <span class="opt-radio-visual"></span>
                            <span>${opt}</span>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div class="review-badge-row" id="badge-row-${idx}" style="display:none;"></div>
        `;
        container.appendChild(div);
    });

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, { delimiters: [{left: '$', right: '$', display: false}] });
    }

    buildGridSheet();
    refreshProgressTracker();
}

function registerAnswer(qIdx, oIdx) {
    if(testSubmitted) return;
    playClickSound(); // PLAY SOUND ON SELECTION

    const itemUniqueId = quizData[qIdx].id;
    userAnswers[itemUniqueId] = oIdx;

    document.querySelectorAll(`#q-block-${qIdx} .opt-label`).forEach(lbl => lbl.classList.remove('selected'));
    document.getElementById(`label-${qIdx}-${oIdx}`).classList.add('selected');

    refreshProgressTracker();
    updateGridCellState(qIdx);
    saveSessionState();
}

function refreshProgressTracker() {
    if(testSubmitted) return;
    const doneCount = Object.keys(userAnswers).length;
    document.getElementById('progress-fill').style.width = `${(doneCount / quizData.length) * 100}%`;
    document.getElementById('progress-text').innerText = `${doneCount}/${quizData.length}`;
}

// ================== DYNAMIC CONTROLS GRID SHEET ==================
function buildGridSheet() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = "";
    quizData.forEach((_, idx) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'palette-cell';
        cell.id = `cell-grid-${idx}`;
        cell.innerText = idx + 1;
        cell.onclick = () => {
            document.getElementById(`q-block-${idx}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
            closePalette();
        };
        grid.appendChild(cell);
    });
    quizData.forEach((_, idx) => updateGridCellState(idx));
}

function updateGridCellState(idx) {
    const cell = document.getElementById(`cell-grid-${idx}`);
    if(!cell) return;
    const itemUniqueId = quizData[idx].id;
    cell.classList.remove('answered');
    if(userAnswers.hasOwnProperty(itemUniqueId)) cell.classList.add('answered');
}

function openPalette() {
    document.getElementById('palette-overlay').classList.add('show');
    document.getElementById('palette-sheet').classList.add('show');
}
function closePalette() {
    document.getElementById('palette-overlay').classList.remove('show');
    document.getElementById('palette-sheet').classList.remove('show');
}
document.getElementById('btn-palette').onclick = openPalette;

function openSubmitModal() {
    if (testSubmitted) return;
    const answered = Object.keys(userAnswers).length;
    document.getElementById('modal-answered').innerText = answered;
    document.getElementById('modal-remaining').innerText = quizData.length - answered;
    document.getElementById('submit-modal').classList.add('show');
}
function closeSubmitModal() { document.getElementById('submit-modal').classList.remove('show'); }

// BOTTOM BUTTON ACTION (SUBMIT OR FINISH REVIEW)
function handleMainBottomBtn() {
    if (testSubmitted) {
        document.getElementById('questions-area').style.display = 'none';
        document.getElementById('review-header').style.display = 'none'; // HIDE REVIEW HEADER ON RESULT
        document.getElementById('result-panel').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        openSubmitModal();
    }
}

// RESTART TEST FRESH (CLEAR CACHE)
function restartTestFresh() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// ================== TIMERS MATRIX CONTROLS ==================
function startTimerEngine() {
    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!testSubmitted) autoTimeOutTrigger();
        } else {
            timeLeft--;
            updateTimerUI();
            saveSessionState();
        }
    }, 1000);
}

function updateTimerUI() {
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    document.getElementById('timer').innerText = `⌛ ${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
    const header = document.getElementById('test-header');
    header.classList.remove('time-warn', 'time-danger');
    if(timeLeft <= 60) header.classList.add('time-danger');
    else if(timeLeft <= 300) header.classList.add('time-warn');
}

function autoTimeOutTrigger() {
    processResults(true);
}

// ================== METRICS MATHEMATICAL COMPILER ==================
function processResults(forced = false) {
    if(testSubmitted) return;
    closeSubmitModal();
    clearInterval(timerInterval);
    testSubmitted = true;

    document.getElementById('mock-test-form').classList.add('submitted');
    document.getElementById('test-header').style.display = 'none'; // GAYAB STICKY NAVBAR ON RESULT
    document.getElementById('questions-area').style.display = 'none';

    let elapsedSeconds = 1500 - timeLeft;
    let elapsedMins = Math.floor(elapsedSeconds / 60);
    let elapsedSecs = elapsedSeconds % 60;
    let timeTakenString = `${elapsedMins < 10 ? '0'+elapsedMins : elapsedMins}:${elapsedSecs < 10 ? '0'+elapsedSecs : elapsedSecs} Min`;

    let correctTotal = 0, wrongTotal = 0, skippedTotal = 0;

    quizData.forEach((item, idx) => {
        const correctIdx = item.correct;
        const itemUniqueId = item.id;
        const chosenIdx = userAnswers.hasOwnProperty(itemUniqueId) ? userAnswers[itemUniqueId] : null;

        const correctLabel = document.getElementById(`label-${idx}-${correctIdx}`);
        correctLabel.classList.add('correct-ans');

        if ((item.explanation && item.explanation.trim() !== "") || item.explain_img) {
            const bulbBtn = document.createElement('button');
            bulbBtn.type = 'button';
            bulbBtn.className = 'bulb-btn';
            bulbBtn.innerHTML = '💡';
            bulbBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerBulbModal(item);
            };
            correctLabel.appendChild(bulbBtn);
        }

        const badgeRow = document.getElementById(`badge-row-${idx}`);
        let badges = `<span class="rev-status-badge" style="background:var(--success-wash); color:#14532d;">Correct Ans: ${item.options[correctIdx]}</span>`;

        if (chosenIdx !== null) {
            if (chosenIdx === correctIdx) {
                correctTotal++;
            } else {
                document.getElementById(`label-${idx}-${chosenIdx}`).classList.add('wrong-ans');
                badges += `<span class="rev-status-badge" style="background:var(--danger-wash); color:#7f1d1d;">Your Ans: ${item.options[chosenIdx]}</span>`;
                wrongTotal++;
            }
        } else {
            skippedTotal++;
            badges += `<span class="rev-status-badge" style="background:#f1f2f4; color:#64748b;">Left (છોડેલ)</span>`;
        }
        badgeRow.innerHTML = badges;
        badgeRow.style.display = 'flex';

        document.querySelectorAll(`input[name="q${idx}"]`).forEach(inp => inp.disabled = true);
    });

    let negativeCut = wrongTotal * 0.25;
    let finalRealScore = correctTotal - negativeCut;
    if(finalRealScore < 0) finalRealScore = 0;

    let attemptedTotal = correctTotal + wrongTotal;
    let displayRingPct = ((finalRealScore / quizData.length) * 100);
    if(displayRingPct < 0) displayRingPct = 0;

    document.getElementById('result-ring').style.setProperty('--pct', Math.round(displayRingPct));
    document.getElementById('result-pct').innerText = displayRingPct.toFixed(2) + '%';
    document.getElementById('final-score').innerText = `${finalRealScore.toFixed(2)} / ${quizData.length}`;
    
    document.getElementById('stat-time-taken').innerText = timeTakenString;
    document.getElementById('stat-attempted').innerText = attemptedTotal;
    document.getElementById('stat-correct').innerText = correctTotal;
    document.getElementById('stat-wrong').innerText = wrongTotal;
    document.getElementById('stat-skipped').innerText = skippedTotal;
    document.getElementById('stat-negative').innerText = `-${negativeCut.toFixed(2)}`;

    document.getElementById('result-panel').style.display = 'block';
    
    let masterSaveKey = `${subject}_${localStorage.getItem('last_active_branch_guj')}_${type}_${quizNo}_score`;
    localStorage.setItem(masterSaveKey, Math.round(displayRingPct));

    localStorage.removeItem(STORAGE_KEY);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// REVIEW ANSWERS CLICK
document.getElementById('btn-review').onclick = () => {
    document.getElementById('result-panel').style.display = 'none'; 
    document.body.classList.add('review-mode');
    
    // TOGGLE HEADERS FOR CLEAN SINGLE LINE IN REVIEW MODE
    document.getElementById('test-header').style.display = 'none';
    document.getElementById('review-header').style.display = 'block';

    document.getElementById('questions-area').style.display = 'block';
    
    // UPDATE BOTTOM BUTTON TO FINISH REVIEW
    const bottomBtn = document.getElementById('btn-main-submit');
    bottomBtn.innerText = "Finish Review (પરિણામ પર વળદો)";
    bottomBtn.style.background = "var(--ink)";
    bottomBtn.style.color = "#ffffff";

    document.getElementById('questions-container').scrollIntoView({ behavior: 'smooth' });
};

// ================== POPUP SOLUTION CORE MODULES ==================
function triggerBulbModal(item) {
    const targetBox = document.getElementById('bulb-modal-content');
    targetBox.innerHTML = "";
    
    if(item.explanation) {
        const textPara = document.createElement('p');
        textPara.style.fontSize = "1.05rem";
        textPara.style.lineHeight = "1.5";
        textPara.innerText = item.explanation;
        targetBox.appendChild(textPara);
    }
    
    if(item.explain_img) {
        const imgObj = document.createElement('img');
        imgObj.src = item.explain_img;
        imgObj.className = 'bulb-img-fullscreen';
        targetBox.appendChild(imgObj);
    }

    document.getElementById('bulb-modal').classList.add('show');
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(targetBox, { delimiters: [{left: '$', right: '$', display: false}] });
    }
}
function closeBulbModal() { document.getElementById('bulb-modal').classList.remove('show'); }

// ================== STATE ENGINES CONTROLS ==================
function saveSessionState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            userAnswers, quizData, timeLeft, submitted: testSubmitted
        }));
    } catch(e){}
}

function restoreRadioClicks() {
    quizData.forEach((item, idx) => {
        const itemUniqueId = item.id;
        if(userAnswers.hasOwnProperty(itemUniqueId)) {
            const radioVal = userAnswers[itemUniqueId];
            const targetRadio = document.querySelector(`input[name="q${idx}"][value="${radioVal}"]`);
            if(targetRadio) {
                targetRadio.checked = true;
                document.getElementById(`label-${idx}-${radioVal}`).classList.add('selected');
            }
        }
    });
}

window.onload = initMockEngine;
