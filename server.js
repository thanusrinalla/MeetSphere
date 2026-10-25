/**
 * MeetBefore / MeetSphere - Server-Side Backend
 * 
 * Provides a lightweight, secure Node.js backend that:
 * 1. Serves static frontend assets (HTML, CSS, JS).
 * 2. Securely handles Gemma AI calls using GEMINI_API_KEY from .env.
 * 3. Never exposes the API key to frontend code, network responses, or logs.
 * 4. Uses strictly Gemma models (gemma-4-26b-a4b-it, gemma-3-27b-it, gemma-2-9b-it).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// Simple built-in .env loader (zero external dependencies required!)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          // Remove surrounding quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Ordered list of Gemma models to ensure a Gemma model is strictly used
const GEMMA_MODELS = [
  process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
  'gemma-3-27b-it',
  'gemma-2-9b-it'
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to make HTTPS requests to Google Generative Language API
function callGemmaAPI(model, prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1000
      }
    });

    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const parsed = new url.URL(endpointUrl);

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve({ success: true, text, model });
            } else {
              resolve({ success: false, error: 'Empty response from model' });
            }
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: json.error?.message || `HTTP ${res.statusCode}`
            });
          }
        } catch (e) {
          resolve({ success: false, error: 'Malformed JSON from API' });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Resilient Gemma caller that strictly tries Gemma models
async function executeGemmaPrompt(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return {
      success: false,
      missingKey: true,
      error: 'GEMINI_API_KEY is not configured in .env on the server. Please set your Google AI Studio API key in .env'
    };
  }

  // Try each Gemma model candidate
  for (const model of GEMMA_MODELS) {
    try {
      const result = await callGemmaAPI(model, prompt, GEMINI_API_KEY);
      if (result.success) {
        return result;
      }
      // If error is 404 (model not found on specific account tier), try next Gemma model
      if (result.statusCode === 404) {
        console.warn(`Model ${model} not available, trying next Gemma candidate...`);
        continue;
      }
      return result;
    } catch (err) {
      console.error(`Network error calling ${model}:`, err.message);
    }
  }

  return {
    success: false,
    error: 'All configured Gemma models failed to respond. Check API key and quota.'
  };
}

// Request Body Parser Helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect against massive payloads (max 1MB)
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// JSON response helper (ensures API key is NEVER leaked)
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Static File Server Helper
function serveStaticFile(req, res, pathname) {
  let safePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Do NOT serve .env or other hidden/secret files
    if (path.basename(filePath).startsWith('.') || filePath.endsWith('server.js')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  // --- API ROUTE: Status & Health ---
  if (pathname === '/api/ai/status' && req.method === 'GET') {
    const isConfigured = !!GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here';
    return sendJson(res, 200, {
      status: 'ok',
      configured: isConfigured,
      model: GEMMA_MODELS[0],
      provider: 'Google AI Studio (Gemma)'
    });
  }

  // --- API ROUTE 1: Recommend Connections & Explain Match ---
  if (pathname === '/api/ai/smart-match' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { currentUser, attendees, eventName } = data;

      if (!currentUser || !currentUser.firstName) {
        return sendJson(res, 400, { success: false, error: 'currentUser with firstName is required.' });
      }

      if (!Array.isArray(attendees) || attendees.length === 0) {
        return sendJson(res, 200, {
          success: true,
          recommendations: [],
          text: "No other attendees have registered for this event yet. Once others press 'I'm going', the Smart Match Assistant will find your best connections!"
        });
      }

      // Filter out current user from candidates
      const currentId = currentUser.uid || currentUser.id;
      const candidates = attendees.filter(a => (a.id !== currentId && a.uid !== currentId));

      if (candidates.length === 0) {
        return sendJson(res, 200, {
          success: true,
          recommendations: [],
          text: "You are currently the only attendee registered for this event! As more people join, your Smart Match Assistant will recommend teammates."
        });
      }

      // Build strictly grounded candidate profiles
      const candidatesListText = candidates.map((c, i) => 
        `Attendee #${i + 1}:
- ID: ${c.id || c.uid}
- First Name: ${c.firstName}
- Skills: ${(c.skills || []).join(', ') || 'None specified'}
- Interests: ${(c.interests || []).join(', ') || 'None specified'}
- Goal: "${c.goal || 'Not specified'}"`
      ).join('\n\n');

      const prompt = `You are the AI "Smart Match Assistant" for MeetBefore/MeetSphere, helping attendees meet before the event so nobody walks in alone.

CRITICAL INSTRUCTIONS & GROUNDING CONSTRAINTS:
1. You must ONLY use the exact attendees listed in the "Available Attendees" section below.
2. NEVER invent imaginary attendees, never make up names, and never claim someone is attending who is not in the list.
3. Show ONLY the attendee's First Name. Never reveal email addresses or full names.

Current User:
- First Name: ${currentUser.firstName}
- Skills: ${(currentUser.skills || []).join(', ') || 'None'}
- Interests: ${(currentUser.interests || []).join(', ') || 'None'}
- Goal at event: "${currentUser.goal || 'Connect with attendees'}"

Event: ${eventName || 'Upcoming Tech Meetup'}

Available Attendees (${candidates.length} people):
${candidatesListText}

TASK:
1. Select the top 1 to 3 best matching attendees from the list above based on complementary skills, shared interests, or aligned goals (such as walking in together or hackathon team building).
2. For each recommended match, explain in 2 friendly, motivating sentences:
   - WHY they are a great match for the current user.
   - WHAT specific project, skill, or walk-in plan they can collaborate on.
3. Maintain a warm, encouraging, and respectful tone.

Format your response clearly with bullet points starting with the person's First Name and their ID.`;

      const aiResponse = await executeGemmaPrompt(prompt);

      if (!aiResponse.success) {
        return sendJson(res, aiResponse.missingKey ? 401 : 500, aiResponse);
      }

      return sendJson(res, 200, {
        success: true,
        text: aiResponse.text,
        model: aiResponse.model
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // --- API ROUTE 2: Explain Why Two Attendees Are A Match ---
  if (pathname === '/api/ai/explain-match' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { userA, userB, eventName } = data;

      if (!userA || !userB) {
        return sendJson(res, 400, { success: false, error: 'userA and userB are required.' });
      }

      const prompt = `You are the AI Smart Match Assistant for MeetBefore/MeetSphere.
Explain why these two real attendees would make a great match to connect before ${eventName || 'the event'} and walk in together.

Attendee 1:
- First Name: ${userA.firstName}
- Skills: ${(userA.skills || []).join(', ')}
- Interests: ${(userA.interests || []).join(', ')}
- Goal: "${userA.goal || ''}"

Attendee 2:
- First Name: ${userB.firstName}
- Skills: ${(userB.skills || []).join(', ')}
- Interests: ${(userB.interests || []).join(', ')}
- Goal: "${userB.goal || ''}"

TASK:
Write a concise, friendly 2-3 sentence explanation highlighting:
1. Their shared interests or complementary skills.
2. Why connecting before the event will help them achieve their goals (e.g. hackathon team, walking in together).
Do not mention last names or emails.`;

      const aiResponse = await executeGemmaPrompt(prompt);
      if (!aiResponse.success) {
        return sendJson(res, aiResponse.missingKey ? 401 : 500, aiResponse);
      }

      return sendJson(res, 200, {
        success: true,
        text: aiResponse.text,
        model: aiResponse.model
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // --- API ROUTE 3: Suggest Icebreaker Questions ---
  if (pathname === '/api/ai/icebreakers' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { currentUser, targetAttendee, eventName } = data;

      if (!currentUser || !targetAttendee) {
        return sendJson(res, 400, { success: false, error: 'currentUser and targetAttendee are required.' });
      }

      const prompt = `You are the AI Smart Match Assistant for MeetBefore/MeetSphere.
Suggest 3 natural, friendly, non-awkward icebreaker questions for ${currentUser.firstName} to start a conversation with ${targetAttendee.firstName} before ${eventName || 'the event'}.

Sender (${currentUser.firstName}):
- Skills: ${(currentUser.skills || []).join(', ')}
- Interests: ${(currentUser.interests || []).join(', ')}
- Goal: "${currentUser.goal || ''}"

Recipient (${targetAttendee.firstName}):
- Skills: ${(targetAttendee.skills || []).join(', ')}
- Interests: ${(targetAttendee.interests || []).join(', ')}
- Goal: "${targetAttendee.goal || ''}"

RULES:
1. Provide exactly 3 short icebreaker questions.
2. Base the questions directly on ${targetAttendee.firstName}'s skills, interests, or goal.
3. Keep them casual, inviting, and conversational (avoid overly formal or corporate phrasing).
4. Include one question suggesting meeting up at the entrance to walk into the event together.`;

      const aiResponse = await executeGemmaPrompt(prompt);
      if (!aiResponse.success) {
        return sendJson(res, aiResponse.missingKey ? 401 : 500, aiResponse);
      }

      return sendJson(res, 200, {
        success: true,
        text: aiResponse.text,
        model: aiResponse.model
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // --- API ROUTE 4: Recommend Suitable Groups ---
  if (pathname === '/api/ai/recommend-groups' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const { currentUser, existingGroups, attendees, eventName } = data;

      if (!currentUser) {
        return sendJson(res, 400, { success: false, error: 'currentUser is required.' });
      }

      const groupsText = (existingGroups && existingGroups.length > 0)
        ? existingGroups.map((g, i) => `Group #${i + 1}: "${g.groupName}" (Members: ${(g.members || []).length})`).join('\n')
        : 'No existing public groups created yet.';

      const attendeesSummary = (attendees || [])
        .filter(a => a.id !== currentUser.uid && a.id !== currentUser.id)
        .map(a => `- ${a.firstName}: Skills: ${(a.skills || []).join(', ')} | Interests: ${(a.interests || []).join(', ')}`)
        .join('\n');

      const prompt = `You are the AI Smart Match Assistant for MeetBefore/MeetSphere.
Recommend suitable groups or squads for ${currentUser.firstName} based on their interests and the available attendees for ${eventName || 'the event'}.

User Profile:
- First Name: ${currentUser.firstName}
- Skills: ${(currentUser.skills || []).join(', ')}
- Interests: ${(currentUser.interests || []).join(', ')}
- Goal: "${currentUser.goal || ''}"

Existing Groups:
${groupsText}

Event Attendees:
${attendeesSummary || 'Few attendees registered so far.'}

TASK:
1. If any existing group fits their interests, recommend it and explain why.
2. If none or few exist, propose 2 catchy squad ideas they can create (e.g. "Walk-in & Coffee Squad 🚶‍♂️☕", "AI Hackathon Devs") and specify which real attendees from the list would be great to invite.
3. Ground all suggestions strictly in the attendee data provided. Do not invent people.`;

      const aiResponse = await executeGemmaPrompt(prompt);
      if (!aiResponse.success) {
        return sendJson(res, aiResponse.missingKey ? 401 : 500, aiResponse);
      }

      return sendJson(res, 200, {
        success: true,
        text: aiResponse.text,
        model: aiResponse.model
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // Fallback to static file server
  serveStaticFile(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 MeetBefore / MeetSphere Backend Server is running!`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🤖 AI Engine: Google Gemma (${GEMMA_MODELS[0]})`);
  console.log(`🔑 GEMINI_API_KEY: ${GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here' ? 'Configured ✅' : 'Not configured in .env ⚠️'}`);
  console.log(`=======================================================`);
});
