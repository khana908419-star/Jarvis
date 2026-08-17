const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

function addMessage(text, sender) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function getWeather(city) {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}`);
    const geoData = await geoRes.json();

    if (!geoData.results) return `Sorry, I couldn't find "${city}".`;

    const { latitude, longitude, name } = geoData.results[0];
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather.temperature;

    return `Current temperature in ${name} is ${temp}°C.`;
  } catch (err) {
    return "Sorry, weather service is unavailable right now.";
  }
}

async function getWikipedia(topic) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
    const data = await res.json();

    if (data.extract) return data.extract;
    return `I couldn't find information about "${topic}".`;
  } catch (err) {
    return "Sorry, knowledge service is unavailable right now.";
  }
}

async function processCommand(command) {
  const lower = command.toLowerCase();

  if (lower.includes('weather')) {
    const city = command.split('in').pop().trim();
    return await getWeather(city);
  }

  if (lower.includes('who is') || lower.includes('what is') || lower.includes('tell me about')) {
    const topic = command.replace(/who is|what is|tell me about/gi, '').trim();
    return await getWikipedia(topic);
  }

  return "I can help with weather or general knowledge. Try: 'weather in Mumbai' or 'what is artificial intelligence'.";
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  userInput.value = '';

  addMessage('Thinking...', 'bot');
  const reply = await processCommand(text);

  chatBox.lastChild.remove();
  addMessage(reply, 'bot');
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSend();
});
