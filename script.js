/* ================= AUTHENTICATION ================= */
const auth = firebase.auth();
const authScreen = document.getElementById('authScreen');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');

document.getElementById('signupBtn').addEventListener('click', () => {
  auth.createUserWithEmailAndPassword(authEmail.value, authPassword.value)
    .then(() => { authError.textContent = ''; })
    .catch(err => { authError.textContent = err.message; });
});

document.getElementById('loginBtn').addEventListener('click', () => {
  auth.signInWithEmailAndPassword(authEmail.value, authPassword.value)
    .then(() => { authError.textContent = ''; })
    .catch(err => { authError.textContent = err.message; });
});

auth.onAuthStateChanged(user => {
  authScreen.style.display = user ? 'none' : 'flex';
});

/* ================= LABEL TRANSLATOR ================= */
const LABEL_MAP = {
  'cell phone': 'mobile phone',
  'tv': 'monitor / television',
  'couch': 'sofa',
  'dining table': 'table',
  'wine glass': 'glass',
  'hair drier': 'hairdryer',
  'potted plant': 'plant',
  'sports ball': 'ball',
};

function friendlyLabel(label) {
  return LABEL_MAP[label] || label;
}

/* ================= VISION SYSTEM ================= */
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const visionBtn = document.getElementById('visionBtn');
const readTextBtn = document.getElementById('readTextBtn');
const detectedText = document.getElementById('detectedText');
const objCount = document.getElementById('objCount');
const standbyHud = document.getElementById('standbyHud');
const visionStateEl = document.getElementById('visionState');
const scanPct = document.getElementById('scanPct');
const scanBar = document.getElementById('scanBar');
const trackingEl = document.getElementById('tracking');

let model = null;
let running = false;
let stream = null;
let lastSpoken = '';

visionBtn.addEventListener('click', () => { running ? stopVision() : startVision(); });

async function startVision() {
  try {
    detectedText.textContent = 'LOADING VISION AI...';
    standbyHud.style.display = 'none';

    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    if (!model) model = await cocoSsd.load();

    running = true;
    visionBtn.textContent = '■ STOP VISION';
    visionBtn.classList.add('active');
    visionStateEl.textContent = 'ON';
    trackingEl.textContent = 'ACTIVE';
    detectFrame();
  } catch (err) {
    detectedText.textContent = 'CAMERA ERROR: ' + err.message;
    standbyHud.style.display = 'flex';
  }
}

function stopVision() {
  running = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  visionBtn.textContent = '▶ START VISION';
  visionBtn.classList.remove('active');
  visionStateEl.textContent = 'OFF';
  trackingEl.textContent = 'READY';
  scanPct.textContent = '0%';
  scanBar.style.width = '0%';
  detectedText.textContent = 'CAMERA STANDBY';
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  standbyHud.style.display = 'flex';
}

async function detectFrame() {
  if (!running) return;
  const predictions = await model.detect(video);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  objCount.textContent = predictions.length;

  const pct = Math.min(100, predictions.length * 25 + 10);
  scanPct.textContent = pct + '%';
  scanBar.style.width = pct + '%';

  if (predictions.length > 0) {
    const best = predictions.reduce((a, b) => (a.score > b.score ? a : b));
    ctx.strokeStyle = '#00eaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(...best.bbox);
    ctx.fillStyle = '#00eaff';
    ctx.font = '16px monospace';
    ctx.fillText(`${best.class} ${Math.round(best.score * 100)}%`, best.bbox[0], best.bbox[1] > 20 ? best.bbox[1] - 5 : 20);

    const label = best.class;
    const displayLabel = friendlyLabel(label);
    detectedText.textContent = `DETECTED: ${displayLabel.toUpperCase()}`;
    if (label !== lastSpoken) { speak(`Detected ${displayLabel}`); lastSpoken = label; }
  } else {
    detectedText.textContent = 'SCANNING...';
    lastSpoken = '';
  }
  requestAnimationFrame(detectFrame);
}

/* ================= OCR: READ TEXT FROM PRODUCTS ================= */
readTextBtn.addEventListener('click', async () => {
  if (!running) { speak('Pehle vision system start karo'); return; }

  detectedText.textContent = 'READING TEXT...';
  speak('Packet ka text padh raha hoon, ruko');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
  const cleanText = text.replace(/\n/g, ' ').trim();

  if (cleanText.length > 2) {
    detectedText.textContent = `READ: ${cleanText.slice(0, 40)}`;
    speak(`Mujhe ye likha mila: ${cleanText.slice(0, 60)}. Google par search kar raha hoon`);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(cleanText + ' company address')}`, '_blank');
  } else {
    speak('Mujhe koi text clearly nahi mila, thoda paas leke try karo');
    detectedText.textContent = 'NO TEXT FOUND';
  }
});

/* ================= VOICE ASSISTANT ================= */
const micBtn = document.getElementById('micBtn');
const chatBox = document.getElementById('chatBox');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-IN';
recognition.continuous = false;
recognition.interimResults = false;
let listening = false;

/* ================= LANGUAGE SWITCHER ================= */
const langBtn = document.getElementById('langBtn');
const languages = [
  { code: 'en-IN', label: '🌐 EN', name: 'English' },
  { code: 'hi-IN', label: '🌐 HI', name: 'Hindi' },
  { code: 'ur-PK', label: '🌐 UR', name: 'Urdu' }
];
let langIndex = 0;

if (langBtn) {
  langBtn.addEventListener('click', () => {
    langIndex = (langIndex + 1) % languages.length;
    recognition.lang = languages[langIndex].code;
    langBtn.textContent = languages[langIndex].label;
    speak(`Language changed to ${languages[langIndex].name}`);
  });
}

micBtn.addEventListener('click', () => { listening ? recognition.stop() : recognition.start(); });
recognition.onstart = () => { listening = true; micBtn.classList.add('listening'); };
recognition.onend = () => { listening = false; micBtn.classList.remove('listening'); };
recognition.onresult = (e) => {
  const text = e.results[0][0].transcript;
  addMessage(text, 'user');
  handleCommand(text.toLowerCase());
};

function addMessage(text, who) {
  const p = document.createElement('p');
  p.className = who;
  p.textContent = (who === 'user' ? '🧑 ' : '🤖 ') + text;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ================= COMMAND HANDLER ================= */
let userName = null;

function handleCommand(cmd) {
  cmd = cmd.toLowerCase().trim();

  if (cmd.includes('my name is') || cmd.includes('mera naam')) {
    let name = cmd.replace('my name is', '').replace('mera naam', '').replace('hai', '').trim();
    if (name) {
      userName = name.charAt(0).toUpperCase() + name.slice(1);
      speak(`Nice to meet you ${userName}! Ab mein aapko ${userName} bol kar bulaunga.`);
      return;
    }
  }

  if (cmd.includes('what is my name') || cmd.includes('mera naam kya hai')) {
    speak(userName ? `Aapka naam ${userName} hai` : 'Aapne abhi tak apna naam nahi bataya.');
    return;
  }

  if (cmd.includes('kisne banaya') || cmd.includes('who made you') || cmd.includes('tumhara ceo') || cmd.includes('your ceo') || cmd.includes('creator')) {
    speak('Mujhe Pathan Altamash ne banaya hai. Wahi mere CEO aur creator hain.');
  } else if (cmd.includes('hello') || cmd.includes('hi ') || cmd === 'hi' || cmd.includes('namaste') || cmd.includes('hey jarvis')) {
    speak(userName ? `Namaste ${userName}! Kaise ho aap?` : 'Namaste! Main Jarvis hoon. Aapka naam kya hai?');
  } else if (cmd.includes('good morning')) {
    speak(userName ? `Good morning ${userName}!` : 'Good morning! Aapka din shubh ho.');
  } else if (cmd.includes('good night')) {
    speak('Good night! Aaram se soiye.');
  } else if (cmd.includes('kaise ho') || cmd.includes('how are you')) {
    speak('Main bilkul theek hoon, shukriya poochne ke liye.');
  } else if (cmd.includes('thank you') || cmd.includes('shukriya')) {
    speak(userName ? `Aapka swagat hai ${userName}!` : 'Aapka swagat hai!');
  } else if (cmd.includes('tumhara naam') || cmd.includes('your name') || cmd.includes('who are you')) {
    speak('Mera naam Jarvis hai, aapka personal AI assistant.');
  } else if (cmd.includes('what can you do') || cmd.includes('tum kya kar sakte ho')) {
    speak('Mein time, date bata sakta hoon, google search kar sakta hoon, camera se objects aur text pehchan sakta hoon.');
  } else if (cmd.includes('bye') || cmd.includes('alvida')) {
    speak(userName ? `Alvida ${userName}!` : 'Alvida! Phir milte hain.');
  } else if (cmd.includes('time')) {
    speak(`Abhi time hai ${new Date().toLocaleTimeString()}`);
  } else if (cmd.includes('date') || cmd.includes('tarikh')) {
    speak(`Aaj ki date hai ${new Date().toLocaleDateString()}`);
  } else if (cmd.includes('kaunsa din') || cmd.includes('which day')) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    speak(`Aaj ${days[new Date().getDay()]} hai`);
  } else if (cmd.includes('joke') || cmd.includes('chutkula')) {
    const jokes = ['Teacher ne pucha - homework kyun nahi kiya? Student bola - Sir, mera dimaag hi update ho raha tha.', 'Ek AI doosre AI se bola - tum kitne smart ho!'];
    speak(jokes[Math.floor(Math.random() * jokes.length)]);
  } else if (cmd.includes('battery')) {
    if (navigator.getBattery) { navigator.getBattery().then(b => speak(`Battery abhi ${Math.round(b.level*100)} percent hai`)); }
    else { speak('Battery information available nahi hai'); }
  } else if (/\d+.*(jod|plus|add|ghata|minus|multiply|guna|divide|bhag)/.test(cmd)) {
    speak(calculateFromSpeech(cmd));
  } else if (cmd.includes('read') || cmd.includes('padho') || cmd.includes('scan text')) {
    readTextBtn.click();
  } else if (cmd.includes('google') || cmd.includes('search')) {
    const q = cmd.replace('google','').replace('search','').trim();
    speak(`${q} search kar raha hoon`);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
  } else if (cmd.includes('wikipedia')) {
    const q = cmd.replace('wikipedia','').trim();
    speak(`Wikipedia par ${q} dhundh raha hoon`);
    window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`, '_blank');
  } else if (cmd.includes('open youtube')) {
    speak('Youtube khol raha hoon');
    window.open('https://youtube.com', '_blank');
  } else if (cmd.includes('open vision') || cmd.includes('camera on') || cmd.includes('start vision')) {
    speak('Vision system start kar raha hoon'); if (!running) startVision();
  } else if (cmd.includes('close vision') || cmd.includes('camera off') || cmd.includes('stop vision')) {
    speak('Vision system band kar raha hoon'); if (running) stopVision();
  } else if (cmd.includes('what do you see') || cmd.includes('kya dikh raha')) {
    speak(lastSpoken ? `Mujhe ${friendlyLabel(lastSpoken)} dikh raha hai` : 'Abhi kuch detect nahi ho raha');
  } else {
    speak('Maaf kijiye, ye mere code mein nahi likha hua hai.');
  }
}

function calculateFromSpeech(cmd) {
  const numbers = cmd.match(/\d+/g);
  if (!numbers || numbers.length < 2) return 'Mujhe do numbers chahiye calculate karne ke liye';
  const a = parseInt(numbers[0]);
  const b = parseInt(numbers[1]);
  let result;
  if (cmd.includes('jod') || cmd.includes('plus') || cmd.includes('add')) result = a + b;
  else if (cmd.includes('ghata') || cmd.includes('minus')) result = a - b;
  else if (cmd.includes('multiply') || cmd.includes('guna')) result = a * b;
  else if (cmd.includes('divide') || cmd.includes('bhag')) result = b !== 0 ? (a/b).toFixed(2) : 'Divide by zero nahi ho sakta';
  else result = a + b;
  return `Result hai ${result}`;
}

/* ================= VOICE SETUP (unchanged) ================= */
const voiceSelect = document.getElementById('voiceSelect');
let jarvisVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voiceSelect.innerHTML = '';
  voices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    voiceSelect.appendChild(opt);
  });
  const maleKeywords = ['male','david','ravi','daniel','mark','james'];
  let bestIndex = voices.findIndex(v => maleKeywords.some(k => v.name.toLowerCase().includes(k)));
  if (bestIndex === -1) bestIndex = 0;
  voiceSelect.value = bestIndex;
  jarvisVoice = voices[bestIndex];
}
voiceSelect.addEventListener('change', () => {
  const voices = speechSynthesis.getVoices();
  jarvisVoice = voices[voiceSelect.value];
  speak('Voice test complete');
});
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  addMessage(text, 'jarvis');
  document.getElementById('jarvisReply').textContent = text;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  if (jarvisVoice) { utter.voice = jarvisVoice; utter.lang = jarvisVoice.lang; }
  else { utter.lang = 'en-IN'; }
  utter.pitch = 0.8;
  utter.rate = 0.95;
  speechSynthesis.speak(utter);
}

/* ================= BOOT GREETING ================= */
window.addEventListener('load', () => {
  setTimeout(() => {
    if (auth.currentUser) speak('Systems online. Namaste, main Jarvis hoon.');
  }, 1500);
});

/* ===================================================
   J.A.R.V.I.S CINEMATIC BOOT SEQUENCE LOGIC
   =================================================== */
(function initBootSequence() {
  const bootScreen = document.getElementById('bootScreen');
  const initBtn = document.getElementById('initBtn');
  const particlesWrap = document.getElementById('bootParticles');

  if (!bootScreen || !initBtn || !particlesWrap) return;

  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.style.left = (35 + Math.random() * 30) + '%';
    p.style.top = (30 + Math.random() * 40) + '%';
    p.style.animationDelay = (0.5 + Math.random() * 0.6) + 's, ' + (2.9 + Math.random() * 3) + 's';
    particlesWrap.appendChild(p);
  }

  function activateJarvis() {
    initBtn.classList.add('clicked');
    setTimeout(() => {
      bootScreen.classList.add('hide');
      setTimeout(() => { bootScreen.style.display = 'none'; }, 750);
    }, 250);
  }

  initBtn.addEventListener('click', activateJarvis);
  initBtn.addEventListener('touchstart', () => {
    initBtn.classList.add('tapped');
    setTimeout(() => initBtn.classList.remove('tapped'), 200);
  }, { passive: true });
})();

/* ===================================================
   LANDING PAGE LOGIC (NEW)
   =================================================== */
(function initLanding() {
  const landingScreen = document.getElementById('landingScreen');
  const getStartedBtn = document.getElementById('getStartedBtn');
  const bootScreen = document.getElementById('bootScreen');
  const statNums = document.querySelectorAll('.stat-num');

  if (!landingScreen || !getStartedBtn) return;

  // animated stat counters
  statNums.forEach(el => {
    const target = parseInt(el.getAttribute('data-target'));
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 40);
  });

  // hide boot screen initially, show only after "Get Started"
  if (bootScreen) bootScreen.style.display = 'none';

  getStartedBtn.addEventListener('click', () => {
    landingScreen.classList.add('hide');
    setTimeout(() => {
      landingScreen.style.display = 'none';
      if (bootScreen) {
        bootScreen.style.display = 'flex';
        // restart boot animations fresh
        bootScreen.style.animation = 'none';
        void bootScreen.offsetWidth; // reflow trick
        bootScreen.style.animation = '';
      }
    }, 650);
  });
})();
