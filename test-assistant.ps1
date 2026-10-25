# Test Suite in PowerShell for MeetBefore / MeetSphere & Gemma AI Integration
$pass = 0
$fail = 0

function Assert-Test($condition, $name) {
    if ($condition) {
        Write-Host "✅ PASS: $name" -ForegroundColor Green
        $global:pass++
    } else {
        Write-Host "❌ FAIL: $name" -ForegroundColor Red
        $global:fail++
    }
}

Write-Host "--- RUNNING SMART MATCH ASSISTANT TEST SUITE (POWERSHELL) ---`n"

# Test 1: .gitignore checks
$gitignore = Get-Content ".gitignore" -Raw
Assert-Test ($gitignore -match "\.env") ".gitignore contains .env"
Assert-Test ($gitignore -match "ai-config\.js") ".gitignore contains ai-config.js"

# Test 2: .env.example checks
Assert-Test (Test-Path ".env.example") ".env.example exists"
$envEx = Get-Content ".env.example" -Raw
Assert-Test ($envEx -match "GEMINI_API_KEY=") ".env.example defines GEMINI_API_KEY"
Assert-Test ($envEx -match "your_gemini_api_key_here") ".env.example has placeholder value"
Assert-Test ($envEx -notmatch "AIzaSy") ".env.example does not contain real API key"

# Test 3: server.js Gemma models
Assert-Test (Test-Path "server.js") "server.js exists"
$serverJs = Get-Content "server.js" -Raw
Assert-Test ($serverJs -match "gemma-4-26b-a4b-it") "server.js supports official Gemma 4 model"
Assert-Test ($serverJs -match "gemma-3-27b-it") "server.js supports Gemma 3 fallback"
Assert-Test ($serverJs -match "gemma-2-9b-it") "server.js supports Gemma 2 fallback"
Assert-Test ($serverJs -notmatch "gemini-1\.5-flash") "server.js strictly uses Gemma (no Gemini substitution)"

# Test 4: Frontend ai.js routing & security
$aiJs = Get-Content "ai.js" -Raw
Assert-Test ($aiJs -notmatch "AIzaSy") "ai.js does not contain hardcoded keys"
Assert-Test ($aiJs -match "/api/ai/smart-match") "ai.js routes connection recommendations through backend"
Assert-Test ($aiJs -match "/api/ai/explain-match") "ai.js routes match explanations through backend"
Assert-Test ($aiJs -match "/api/ai/icebreakers") "ai.js routes icebreakers through backend"
Assert-Test ($aiJs -match "/api/ai/recommend-groups") "ai.js routes group recommendations through backend"

# Test 5: Grounding constraints
Assert-Test ($serverJs -match "CRITICAL INSTRUCTIONS & GROUNDING CONSTRAINTS") "server.js enforces grounding constraints"
Assert-Test ($serverJs -match "NEVER invent imaginary attendees") "server.js prevents inventing attendees"
Assert-Test ($serverJs -match "Show ONLY the attendee's First Name") "server.js enforces first name only safety"

Write-Host "`n-----------------------------------------------"
Write-Host "Summary: $pass passed, $fail failed."
Write-Host "-----------------------------------------------"

if ($fail -gt 0) { exit 1 } else { exit 0 }
