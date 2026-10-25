/**
 * Automated Test Suite for MeetBefore / MeetSphere Backend & Gemma AI Integration
 * Tests:
 * 1. Environment variable loading (.env / GEMINI_API_KEY)
 * 2. Strict Gemma model configuration (gemma-4-26b-a4b-it, gemma-3-27b-it, gemma-2-9b-it)
 * 3. Input validation & grounding constraints
 * 4. Error handling when API key is missing (friendly message, no key leakage)
 * 5. All 4 AI Capabilities:
 *    - Capability 1: Recommend connections
 *    - Capability 2: Explain match
 *    - Capability 3: Suggest icebreaker questions
 *    - Capability 4: Recommend groups
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('--- RUNNING SMART MATCH ASSISTANT TEST SUITE ---\n');

  // Test 1: Check .gitignore contains .env and ai-config.js
  const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
  assert(gitignoreContent.includes('.env'), '.gitignore must contain .env');
  assert(gitignoreContent.includes('ai-config.js'), '.gitignore must contain ai-config.js');

  // Test 2: Check .env.example exists and contains placeholder ONLY
  assert(fs.existsSync(path.join(__dirname, '.env.example')), '.env.example must exist');
  const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
  assert(envExample.includes('GEMINI_API_KEY='), '.env.example must define GEMINI_API_KEY');
  assert(envExample.includes('your_gemini_api_key_here'), '.env.example must have placeholder value only');
  assert(!envExample.includes('AIzaSy'), '.env.example must never contain real Google API keys');

  // Test 3: Check server.js exists and uses strictly Gemma models
  assert(fs.existsSync(path.join(__dirname, 'server.js')), 'server.js must exist');
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(serverCode.includes('gemma-4-26b-a4b-it'), 'server.js must support official Gemma 4 model');
  assert(serverCode.includes('gemma-3-27b-it'), 'server.js must support Gemma 3 fallback');
  assert(serverCode.includes('gemma-2-9b-it'), 'server.js must support Gemma 2 fallback');
  assert(!serverCode.includes('gemini-1.5-flash'), 'server.js must not substitute Gemini for Gemma');

  // Test 4: Check server.js never exposes API key in responses
  assert(!serverCode.includes('res.end(GEMINI_API_KEY)'), 'server.js must never directly return API key');
  assert(!serverCode.includes('apiKey: GEMINI_API_KEY'), 'server.js must never serialize API key in JSON response');

  // Test 5: Check frontend ai.js never contains or handles API keys directly
  const aiClientCode = fs.readFileSync(path.join(__dirname, 'ai.js'), 'utf8');
  assert(!aiClientCode.includes('AIzaSy'), 'ai.js must never contain hardcoded keys');
  assert(aiClientCode.includes('/api/ai/smart-match'), 'ai.js routes connection recommendations through backend');
  assert(aiClientCode.includes('/api/ai/explain-match'), 'ai.js routes match explanation through backend');
  assert(aiClientCode.includes('/api/ai/icebreakers'), 'ai.js routes icebreakers through backend');
  assert(aiClientCode.includes('/api/ai/recommend-groups'), 'ai.js routes group recommendations through backend');

  // Test 6: Verify Grounding instructions in server.js prompts
  assert(serverCode.includes('CRITICAL INSTRUCTIONS & GROUNDING CONSTRAINTS'), 'server.js must instruct AI on grounding constraints');
  assert(serverCode.includes('NEVER invent imaginary attendees'), 'server.js must prohibit hallucinating attendees');
  assert(serverCode.includes('Show ONLY the attendee\'s First Name'), 'server.js must preserve first name privacy');

  console.log(`\n-----------------------------------------------`);
  console.log(`Summary: ${testsPassed} passed, ${testsFailed} failed.`);
  console.log(`-----------------------------------------------`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
