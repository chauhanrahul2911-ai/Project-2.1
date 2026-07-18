// 🚀 NEW SESSIONSTORAGE PARSING ENGINE ✅
const subject      = localStorage.getItem('last_active_subject'); 
const branch       = localStorage.getItem('last_active_branch_guj') || ""; 
const branchFolder = localStorage.getItem('last_active_branch') || ""; 
const type         = localStorage.getItem('last_active_type') || "Quiz";
const quizNo       = localStorage.getItem('last_active_quiz_no') || "1";

if (!subject) {
    alert("કોઈ વિષય પસંદ કરેલ નથી! કૃપા કરીને ફરીથી પ્રયાસ કરો.");
    window.history.back();
}

const cleanBranchTitle = branch.split('(')[0].trim();
document.getElementById('quiz-title').innerText = `${cleanBranchTitle} - ${type} ${quizNo}`;

// 🔐 SESSION IDENTITY GUARD: Ye current quiz ka unique fingerprint hai.
// Agar sessionStorage mein kisi DUSRE quiz ka leftover data pada hai
// (e.g. user beech mein back button dabake nikal gaya tha), to use yahan
// use karne se pehle hi saaf kar dete hain — warna galat score/answers
// naye quiz mein dikh sakte the.
const quizSessionKey = `${subject}_${branchFolder}_${type}_${quizNo}`;
if (sessionStorage.getItem('quiz_session_key') !== quizSessionKey) {
    sessionStorage.removeItem('quiz_current_idx');
    sessionStorage.removeItem('quiz_current_score');
    sessionStorage.removeItem('quiz_user_choices');
    sessionStorage.removeItem('quiz_time_left');
    sessionStorage.removeItem('quiz_is_review');
    sessionStorage.setItem('quiz_session_key', quizSessionKey);
}

// 🎯 REFRESH LOCK ENGINE: Session se state uthao ya zero se shuru karo
var quizData = []; 
var currentIdx = parseInt(sessionStorage.getItem('quiz_current_idx')) || 0; 
var score = parseInt(sessionStorage.getItem('quiz_current_score')) || 0; 
var answered = false;
var timeLeft = parseInt(sessionStorage.getItem('quiz_time_left')) || 600; 
var isReview = sessionStorage.getItem('quiz_is_review') === 'true'; 
var userChoices = JSON.parse(sessionStorage.getItem('quiz_user_choices')) || [];
var isMuted = false; 
var timerInterval;

// Audio System Wrapper
function playSnd(id) { 
    if (isMuted) return; 
    var s = document.getElementById(id); 
    if(s) {
        s.currentTime = 0; 
        s.play().catch(e => console.log("Audio block mechanism handled")); 
    }
}

function toggleMute() { 
    isMuted = !isMuted; 
    document.getElementById('mute-toggle').innerText = isMuted ? "🔇" : "🔊"; 
}

// Countdown Engine
function startCountdown() {
    clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        if(isReview) return;
        timeLeft--;
        sessionStorage.setItem('quiz_time_left', timeLeft); // Save time on every tick
        var mins = Math.floor(timeLeft / 60); 
        var secs = timeLeft % 60;
        document.getElementById('timer-display').innerText = "⌛ " + (mins < 10 ? "0"+mins : mins) + ":" + (secs < 10 ? "0"+secs : secs);
        if (timeLeft <= 0) { 
            clearInterval(timerInterval); 
            autoSaveScore(); 
            showFinalPage(); 
        }
    }, 1000);
}

// State Backup Helper
function backupCurrentState() {
    sessionStorage.setItem('quiz_current_idx', currentIdx);
    sessionStorage.setItem('quiz_current_score', score);
    sessionStorage.setItem('quiz_user_choices', JSON.stringify(userChoices));
    sessionStorage.setItem('quiz_is_review', isReview);
}

// Core Question Loader Block
function loadQuestion() {
    answered = false;
    window.scrollTo(0, 0);
    backupCurrentState(); // Backup state on question load

    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const explainBtn = document.getElementById('explain-btn');
    
    // Next button control
    nextBtn.style.display = isReview ? 'block' : 'none';
    explainBtn.style.display = 'none';
    document.getElementById('review-tag').style.display = isReview ? 'block' : 'none';
    
    // Back navigation active in both modes
    if (backBtn) {
        backBtn.style.display = (currentIdx > 0) ? 'block' : 'none';
    }

    if (currentIdx === quizData.length - 1) {
        nextBtn.innerText = isReview ? "Finish Review" : "Submit";
    } else {
        nextBtn.innerText = "Next ➔";
    }

    // Dynamic Lifeline Logic
    var lifelineBtn = document.getElementById('fifty-fifty');
    if (lifelineBtn) {
        lifelineBtn.style.display = isReview ? 'none' : 'block';
        if (isReview || userChoices[currentIdx] !== undefined) {
            lifelineBtn.disabled = true;
        } else {
            lifelineBtn.disabled = false; 
        }
    }

    document.getElementById('progress-text').innerText = "Question " + (currentIdx + 1) + " of " + quizData.length;
    document.getElementById('score-display').innerText = "Score: " + score;
    
    var data = quizData[currentIdx];
    document.getElementById('question').innerText = data.q;
    
    var imgBox = document.getElementById('image-container');
    if (data.img) {
        document.getElementById('q-image').src = data.img; 
        imgBox.style.display = 'block';
    } else { 
        imgBox.style.display = 'none'; 
    }
    
    // Options grid alignment processor
    var btns = document.querySelectorAll('.option-btn');
    btns.forEach(function(btn, i) {
        btn.textContent = data.options[i];
        btn.className = 'option-btn'; 
        btn.style.display = 'block'; 
        btn.disabled = isReview;
        
        if(!isReview && userChoices[currentIdx] !== undefined) {
            answered = true;
            nextBtn.style.display = 'block';
            if(data.explanation || data.explain_img) explainBtn.style.display = 'block';
            if(i === data.correct) btn.classList.add('correct');
            if(userChoices[currentIdx] === i && i !== data.correct) btn.classList.add('wrong');
            btn.disabled = true;
        }

        if(isReview) {
            if(i === data.correct) btn.classList.add('correct');
            if(userChoices[currentIdx] === i && i !== data.correct) btn.classList.add('wrong');
            if(data.explanation || data.explain_img) explainBtn.style.display = 'block';
        }
    });
}

// Back Navigation Processor
function handleBackQuestion() {
    if (currentIdx > 0) {
        playSnd('snd-click');
        
        if (!isReview) {
            var correct = quizData[currentIdx - 1].correct;
            if(userChoices[currentIdx - 1] === correct && score > 0) {
                score--;
            }
        }
        
        currentIdx--;
        loadQuestion();
    }
}

// User Answer Handler
function handleChoice(idx) {
    if (answered || isReview) return;
    answered = true; 
    userChoices[currentIdx] = idx;
    var correct = quizData[currentIdx].correct;
    var btns = document.querySelectorAll('.option-btn');
    
    var lifelineBtn = document.getElementById('fifty-fifty');
    if(lifelineBtn) lifelineBtn.disabled = true;
    
    if(idx === correct) { 
        btns[idx].classList.add('correct'); 
        score++; 
        playSnd('snd-correct'); 
    } else { 
        btns[idx].classList.add('wrong'); 
        btns[correct].classList.add('correct'); 
        playSnd('snd-wrong'); 
    }
    
    document.getElementById('score-display').innerText = "Score: " + score;
    backupCurrentState();
    
    if(quizData[currentIdx].explanation || quizData[currentIdx].explain_img) { 
        document.getElementById('explain-btn').style.display = 'block'; 
    }
    document.getElementById('next-btn').style.display = 'block';
}

// Explanations View Trigger
function openExplain() {
    playSnd('snd-click');
    var data = quizData[currentIdx];
    if (data.explain_img) {
        document.getElementById('fullImg').src = data.explain_img;
        document.getElementById('zoomModal').style.display = 'flex';
    } else if (data.explanation) {
        document.getElementById('explain-text').innerText = data.explanation;
        document.getElementById('explainModal').style.display = 'flex';
    }
}
function closeExplain() { 
    document.getElementById('explainModal').style.display = 'none'; 
}

// 🎭 50:50 Lifeline
function useFiftyFifty() {
    if(answered || isReview || userChoices[currentIdx] !== undefined) return;
    playSnd('snd-click');
    
    var lifelineBtn = document.getElementById('fifty-fifty');
    if(lifelineBtn) lifelineBtn.disabled = true;
    
    var correct = quizData[currentIdx].correct;
    var btns = document.querySelectorAll('.option-btn');
    var indices = [0, 1, 2, 3].filter(function(i) { return i !== correct; }).sort(function() { return Math.random() - 0.5; });
    
    btns[indices[0]].style.display = 'none'; 
    btns[indices[1]].style.display = 'none';
}

// Next Step Action Route
function handleNext() {
    playSnd('snd-click');
    if(currentIdx === quizData.length - 1) { 
        clearInterval(timerInterval); 
        if(!isReview) { 
            autoSaveScore(); 
            clearQuizSession(); 
            showFinalPage();
        } else {
            clearQuizSession();
            showFinalPage();
        }
        return; 
    }
    currentIdx++;
    loadQuestion();
}

function autoSaveScore() {
    var finalPercent = Math.round((score / quizData.length) * 100) || 0;
    let scoreKey = `${subject}_${branch}_${type}_${quizNo}_score`;
    localStorage.setItem(scoreKey, finalPercent);
}

function clearQuizSession() {
    sessionStorage.removeItem('quiz_current_idx');
    sessionStorage.removeItem('quiz_current_score');
    sessionStorage.removeItem('quiz_user_choices');
    sessionStorage.removeItem('quiz_time_left');
    sessionStorage.removeItem('quiz_is_review');
    sessionStorage.removeItem('quiz_session_key');
}

function showFinalPage() {
    playSnd('snd-finish');
    document.getElementById('game-ui').style.display = 'none';
    
    const finalUi = document.getElementById('final-ui');
    finalUi.style.display = 'flex';
    finalUi.style.flexDirection = 'column';
    finalUi.style.justifyContent = 'center';
    finalUi.style.alignItems = 'center';
    finalUi.style.minHeight = '60vh'; 

    var percent = Math.round((score / quizData.length) * 100) || 0;
    var msg = ""; 
    var tier = "";
    if(percent === 100) { msg = "બધા જવાબ સાચા — શાનદાર!"; tier = "🏆 ગોલ્ડ મેડલ"; }
    else if(percent >= 70) { msg = "બહુ સરસ, થોડું અને પાક્કું!"; tier = "🥈 સિલ્વર મેડલ"; }
    else if(percent >= 40) { msg = "સારો પ્રયત્ન, પ્રેક્ટિસ ચાલુ રાખો"; tier = "🥉 બ્રોન્ઝ મેડલ"; }
    else { msg = "ફરી પ્રયત્ન કરો, થાકવાનું નહીં"; tier = "📖 વધુ પ્રેક્ટિસ જરૂરી"; }

    document.getElementById('final-ring').style.setProperty('--pct', percent);
    document.getElementById('final-score-num').innerText = percent + "%";
    document.getElementById('final-tier').innerText = tier;

    var msgDiv = document.getElementById('final-msg');
    msgDiv.innerText = msg; 
    document.getElementById('final-score').innerText = score + " / " + quizData.length + " સાચા જવાબ";
}

function saveAndGoHome() {
    clearQuizSession();
    window.history.back();
}

function restartQuizFresh() {
    playSnd('snd-click');
    clearQuizSession();
    sessionStorage.setItem('quiz_session_key', quizSessionKey);
    currentIdx = 0; 
    score = 0; 
    answered = false; 
    timeLeft = 600; 
    isReview = false; 
    userChoices = [];
    
    document.getElementById('score-display').innerText = "Score: 0";
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('final-ui').style.display = 'none';
    
    startCountdown();
    loadQuestion();
}

// Review mode kickstart
function startReview() { 
    playSnd('snd-click'); 
    isReview = true; 
    currentIdx = 0; 
    sessionStorage.setItem('quiz_is_review', 'true');
    document.getElementById('game-ui').style.display = 'block'; 
    document.getElementById('final-ui').style.display = 'none'; 
    loadQuestion(); 
}

function openZoom() { 
    playSnd('snd-click'); 
    document.getElementById('fullImg').src = document.getElementById('q-image').src; 
    document.getElementById('zoomModal').style.display = 'flex'; 
}
function closeZoom() { 
    document.getElementById('zoomModal').style.display = 'none'; 
}

// Initial Fetch Kickstart Engine
async function loadQuizDataset() {
    try {
        const response = await fetch(`data/${subject}/${branchFolder}/${type}_${quizNo}.json?v=${new Date().getTime()}`);
        if(!response.ok) throw new Error("File not found");
        quizData = await response.json();
        
        startCountdown();
        loadQuestion();
        
        if(sessionStorage.getItem('quiz_current_idx') === null && userChoices.length >= quizData.length) {
             clearInterval(timerInterval);
             showFinalPage();
        }
    } catch (err) {
        alert("Quiz data file load nahi ho saki! Path check kijiye.");
        window.history.back();
    }
}

loadQuizDataset();
                                                                                                           
