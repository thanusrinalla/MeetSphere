"""
MeetBefore / MeetSphere - Python Server Alternative
Provides the identical backend endpoints using Python's standard library.
"""

import http.server
import json
import os
import socketserver
import urllib.request
import urllib.error
from urllib.parse import urlparse

# Load .env file
def load_env():
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    val = val.strip().strip('"').strip("'")
                    if key.strip() not in os.environ:
                        os.environ[key.strip()] = val

load_env()

PORT = int(os.environ.get('PORT', 3000))
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMMA_MODELS = [
    os.environ.get('GEMMA_MODEL', 'gemma-4-26b-a4b-it'),
    'gemma-3-27b-it',
    'gemma-2-9b-it'
]

def call_gemma_api(model, prompt, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 1000}
    }).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            return {"success": True, "text": text, "model": model}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(error_body)
            msg = err_json.get('error', {}).get('message', str(e))
        except:
            msg = str(e)
        return {"success": False, "statusCode": e.code, "error": msg}
    except Exception as e:
        return {"success": False, "error": str(e)}

def execute_gemma_prompt(prompt):
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'your_gemini_api_key_here':
        return {
            "success": False,
            "missingKey": True,
            "error": "GEMINI_API_KEY is not configured in .env on the server."
        }
    for model in GEMMA_MODELS:
        res = call_gemma_api(model, prompt, GEMINI_API_KEY)
        if res.get('success'):
            return res
        if res.get('statusCode') == 404:
            continue
        return res
    return {"success": False, "error": "All configured Gemma models failed to respond."}

class MeetSphereHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/ai/status':
            is_configured = bool(GEMINI_API_KEY and GEMINI_API_KEY != 'your_gemini_api_key_here')
            self.send_json(200, {
                "status": "ok",
                "configured": is_configured,
                "model": GEMMA_MODELS[0],
                "provider": "Google AI Studio (Gemma - Python)"
            })
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(body) if body else {}
        except:
            return self.send_json(400, {"success": False, "error": "Invalid JSON"})

        if parsed.path == '/api/ai/smart-match':
            current_user = data.get('currentUser', {})
            attendees = data.get('attendees', [])
            event_name = data.get('eventName', 'Upcoming Tech Meetup')
            candidates = [a for a in attendees if a.get('id') != current_user.get('id') and a.get('id') != current_user.get('uid')]
            
            if not candidates:
                return self.send_json(200, {"success": True, "text": "No other attendees registered yet."})

            cand_text = "\n\n".join([f"- Name: {c.get('firstName')}\n  Skills: {', '.join(c.get('skills', []))}\n  Interests: {', '.join(c.get('interests', []))}\n  Goal: \"{c.get('goal', '')}\"" for c in candidates])
            prompt = f"""You are the AI Smart Match Assistant for MeetBefore/MeetSphere.
GROUNDING: Only use the attendees listed below. Never invent attendees or emails.

Current User: {current_user.get('firstName')} (Skills: {', '.join(current_user.get('skills', []))}, Interests: {', '.join(current_user.get('interests', []))})
Event: {event_name}
Available Attendees:
{cand_text}

TASK: Recommend the top 1-3 best matches. Explain why they are a great match and suggest a plan to walk in together."""
            res = execute_gemma_prompt(prompt)
            return self.send_json(200 if res.get('success') else (401 if res.get('missingKey') else 500), res)

        elif parsed.path == '/api/ai/explain-match':
            user_a = data.get('userA', {})
            user_b = data.get('userB', {})
            prompt = f"Explain why {user_a.get('firstName')} and {user_b.get('firstName')} make a great match to connect before the event and walk in together. UserA: {user_a}. UserB: {user_b}."
            res = execute_gemma_prompt(prompt)
            return self.send_json(200 if res.get('success') else 500, res)

        elif parsed.path == '/api/ai/icebreakers':
            user = data.get('currentUser', {})
            target = data.get('targetAttendee', {})
            prompt = f"Suggest 3 friendly, casual icebreaker questions for {user.get('firstName')} to ask {target.get('firstName')}. Target skills: {target.get('skills')}, goal: {target.get('goal')}."
            res = execute_gemma_prompt(prompt)
            return self.send_json(200 if res.get('success') else 500, res)

        elif parsed.path == '/api/ai/recommend-groups':
            user = data.get('currentUser', {})
            groups = data.get('existingGroups', [])
            prompt = f"Recommend suitable groups or squad ideas for {user.get('firstName')} based on their interests: {user.get('interests')}."
            res = execute_gemma_prompt(prompt)
            return self.send_json(200 if res.get('success') else 500, res)

        self.send_json(404, {"error": "Endpoint not found"})

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), MeetSphereHandler) as httpd:
        print(f"🚀 MeetSphere Python Server running on http://localhost:{PORT}")
        httpd.serve_forever()
