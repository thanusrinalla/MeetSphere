# 🤝 MeetSphere (MeetBefore)

> *"Meet your people before you reach the event, so nobody walks in alone."*

MeetSphere is a mobile-friendly web app designed for hackathons, college fests, and workshops. It connects attendees before the event so they can form teams, make friends, and walk in together as a group.

---

## 🤖 Gemma AI "Smart Match Assistant"

MeetSphere features a dedicated **Smart Match Assistant** powered by **Google Gemma** open models (`gemma-4-26b-a4b-it`, `gemma-3-27b-it`, and `gemma-2-9b-it`) via the Google AI Studio / Gemini API.

### 4 Core Capabilities:
1. **🎯 Recommend Potential Connections**:
   - Analyzes real attendees registered for an event using their interests, skills, and goals.
   - Recommends the best 1–3 matches with actionable advice on what to collaborate on.
2. **💡 Explain Why Two Attendees Are a Match**:
   - Compares any two attendee profiles and provides a friendly 2–3 sentence breakdown of their shared interests and complementary skill sets.
3. **💬 Suggest Icebreaker Questions**:
   - Generates 3 natural, non-awkward icebreaker questions tailored specifically to an attendee's skills and goals, including an invitation to meet outside the venue.
4. **👥 Recommend Suitable Groups & Squads**:
   - Recommends existing groups matching the user's interests, or proposes custom squads (e.g., *"Walk-in Squad 🚶‍♂️"*, *"AI Hackathon Team"*) with specific real attendees to invite.
5. **🔒 Strict Grounding & Privacy**:
   - **Zero Hallucination Constraint**: Uses **only** real attendee data supplied by the application. Never invents imaginary attendees or claims someone is attending without data.
   - **First Name Only**: Never exposes full names or email addresses.

---

## 🛡️ Architecture & Security

- **Server-Side Backend (`server.js` & `server.py`)**:
  - All Gemma AI calls route through the lightweight server backend.
  - The browser **never** calls the AI API directly, preventing any client-side API key exposure.
- **Environment Variables**:
  - `GEMINI_API_KEY` is loaded by the backend from `.env` only.
  - `.env` is listed in `.gitignore` and never committed or sent over browser responses.
  - A clean `.env.example` template is provided for setup.
- **No Heavy Dependencies Required**:
  - `server.js` uses standard built-in Node.js modules (`http`, `https`, `fs`, `path`, `url`). It runs out of the box with `node server.js` even without running `npm install`!

---

## 📁 Project Structure

```text
hacktoberfest/
├── index.html            # Main single-page application with Smart Match Assistant modal
├── styles.css            # Responsive, mobile-first design with primary accent color
├── app.js                # Core frontend application logic & UI management
├── ai.js                 # Frontend AI client routing requests through server backend
├── server.js             # Lightweight Node.js server (serves static files + handles Gemma AI)
├── server.py             # Optional Python server alternative (serves static files + Gemma AI)
├── package.json          # Node.js project manifest with start scripts
├── .env.example          # Safe environment template containing GEMINI_API_KEY placeholder
├── .env                  # Local environment file for your real API key (git-ignored)
├── .gitignore            # Protects .env, node_modules, and sensitive files
├── firestore.rules       # Firestore security rules ensuring private profiles & chats
├── test-assistant.ps1    # Automated PowerShell test suite for AI & backend integration
└── README.md             # Complete project guide and instructions
```

---

## 🚀 How to Run the App Locally

### Step 1: Set Your Gemma API Key
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open `.env` (or copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```
3. Add your key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualAPIKeyHere
   PORT=3000
   GEMMA_MODEL=gemma-4-26b-a4b-it
   ```

---

### Step 2: Start the Backend Server

#### Option A: Using Node.js (Recommended)
In your terminal, run:
```bash
node server.js
```
*(or `npm start`)*

#### Option B: Using Python
If you prefer Python, you can run:
```bash
python server.py
```

Both options start the server at **`http://localhost:3000`**.

---

### Step 3: Open in Browser
Visit:
```text
http://localhost:3000
```

1. Click **"Sign In"** > **"Demo: Sam"** or **"Demo: Maya"** (or use Google Sign-In with Firebase).
2. Click on any event (e.g. *"Hacktoberfest Hackathon & Open Source Meetup"*).
3. Click **"🤖 Smart Match Assistant (Gemma AI)"** or click **"💬 Icebreaker"** / **"💡 Match?"** on any attendee card!

---

## 🧪 Testing the AI Integration

Run the automated test suite in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File test-assistant.ps1
```
All 19 checks verify:
- Safe environment variables (`.env` in `.gitignore`, placeholder in `.env.example`)
- Strict Gemma model usage (`gemma-4-26b-a4b-it`, `gemma-3-27b-it`, `gemma-2-9b-it`)
- Server-side routing (no client-side API key exposure)
- Strict attendee grounding constraints (no hallucinated attendees)
