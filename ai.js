/**
 * MeetBefore / MeetSphere - AI Client Service Module (ai.js)
 * 
 * Powered by Google Gemma AI via the secure server-side backend.
 * 
 * TECHNICAL COMPLIANCE:
 * - NO API keys are stored or handled in frontend code.
 * - All AI generation calls route through the server backend (/api/ai/...)
 * - Backend reads GEMINI_API_KEY from environment variables only.
 * - Strictly requests Gemma models (gemma-4-26b-a4b-it, gemma-3-27b-it, gemma-2-9b-it).
 * - Includes a graceful intelligent local fallback when testing offline or via file://.
 */

class SmartMatchAssistant {
  constructor() {
    this.backendBaseUrl = window.location.origin;
    // If opened via file:// or non-http, target standard default port
    if (!this.backendBaseUrl.startsWith('http')) {
      this.backendBaseUrl = 'http://localhost:3000';
    }
  }

  /**
   * Helper to perform safe POST requests to the server backend
   */
  async postToBackend(endpoint, payload) {
    const url = `${this.backendBaseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && data.missingKey) {
          return {
            success: false,
            missingKey: true,
            error: data.error || 'GEMINI_API_KEY is not configured in .env on the server.'
          };
        }
        return {
          success: false,
          error: data.error || `Server responded with HTTP ${response.status}`
        };
      }

      return data;
    } catch (err) {
      // Backend not running on this origin (e.g. opened directly from disk or server not started yet)
      return {
        success: false,
        backendOffline: true,
        error: `Backend server is not running at ${this.backendBaseUrl}.`
      };
    }
  }

  /**
   * Check backend status and Gemma model availability
   */
  async checkStatus() {
    try {
      const response = await fetch(`${this.backendBaseUrl}/api/ai/status`);
      if (response.ok) {
        return await response.json();
      }
      return { configured: false, status: 'offline' };
    } catch (e) {
      return { configured: false, status: 'offline', error: e.message };
    }
  }

  /**
   * Capability 1: Recommend potential connections using attendee interests, skills, and goals.
   * Grounded strictly in real attendee data supplied by the application.
   */
  async getSmartMatchRecommendations(currentUser, attendees, eventName = 'Upcoming Event') {
    if (!currentUser || !currentUser.firstName) {
      return {
        success: false,
        error: 'Please sign in and complete your profile first.'
      };
    }

    const sanitizedAttendees = (attendees || []).map(a => ({
      id: a.id || a.uid,
      firstName: a.firstName,
      skills: a.skills || [],
      interests: a.interests || [],
      goal: a.goal || ''
    }));

    const result = await this.postToBackend('/api/ai/smart-match', {
      currentUser: {
        id: currentUser.uid || currentUser.id,
        firstName: currentUser.firstName,
        skills: currentUser.skills || [],
        interests: currentUser.interests || [],
        goal: currentUser.goal || ''
      },
      attendees: sanitizedAttendees,
      eventName
    });

    if (result.success || result.missingKey) {
      return result;
    }

    // Intelligent local fallback if server is offline
    return this.fallbackMatchRecommendations(currentUser, sanitizedAttendees, eventName);
  }

  /**
   * Capability 2: Explain why two attendees may be a good match.
   */
  async explainMatch(userA, userB, eventName = 'the event') {
    if (!userA || !userB) {
      return {
        success: false,
        error: 'Both attendee profiles are required to explain the match.'
      };
    }

    const result = await this.postToBackend('/api/ai/explain-match', {
      userA: {
        firstName: userA.firstName,
        skills: userA.skills || [],
        interests: userA.interests || [],
        goal: userA.goal || ''
      },
      userB: {
        firstName: userB.firstName,
        skills: userB.skills || [],
        interests: userB.interests || [],
        goal: userB.goal || ''
      },
      eventName
    });

    if (result.success || result.missingKey) {
      return result;
    }

    return this.fallbackExplainMatch(userA, userB, eventName);
  }

  /**
   * Capability 3: Suggest icebreaker questions for starting conversations.
   */
  async suggestIcebreakers(currentUser, targetAttendee, eventName = 'the event') {
    if (!currentUser || !targetAttendee) {
      return {
        success: false,
        error: 'Current user and target attendee are required.'
      };
    }

    const result = await this.postToBackend('/api/ai/icebreakers', {
      currentUser: {
        firstName: currentUser.firstName,
        skills: currentUser.skills || [],
        interests: currentUser.interests || [],
        goal: currentUser.goal || ''
      },
      targetAttendee: {
        firstName: targetAttendee.firstName,
        skills: targetAttendee.skills || [],
        interests: targetAttendee.interests || [],
        goal: targetAttendee.goal || ''
      },
      eventName
    });

    if (result.success || result.missingKey) {
      return result;
    }

    return this.fallbackIcebreakers(currentUser, targetAttendee, eventName);
  }

  /**
   * Capability 4: Recommend suitable groups based on the user's interests.
   */
  async recommendGroups(currentUser, existingGroups, attendees, eventName = 'the event') {
    if (!currentUser) {
      return {
        success: false,
        error: 'Current user is required.'
      };
    }

    const sanitizedAttendees = (attendees || []).map(a => ({
      id: a.id || a.uid,
      firstName: a.firstName,
      skills: a.skills || [],
      interests: a.interests || []
    }));

    const result = await this.postToBackend('/api/ai/recommend-groups', {
      currentUser: {
        firstName: currentUser.firstName,
        skills: currentUser.skills || [],
        interests: currentUser.interests || [],
        goal: currentUser.goal || ''
      },
      existingGroups: (existingGroups || []).map(g => ({
        id: g.id,
        groupName: g.groupName,
        members: g.members || []
      })),
      attendees: sanitizedAttendees,
      eventName
    });

    if (result.success || result.missingKey) {
      return result;
    }

    return this.fallbackRecommendGroups(currentUser, existingGroups, sanitizedAttendees, eventName);
  }

  // =========================================================================
  // LOCAL GROUNDED FALLBACKS (Active when testing directly in browser)
  // =========================================================================

  fallbackMatchRecommendations(currentUser, attendees, eventName) {
    const candidates = attendees.filter(a => a.id !== currentUser.uid && a.id !== currentUser.id);
    if (candidates.length === 0) {
      return {
        success: true,
        text: "You are currently the first attendee here! Once more people join, the Smart Match Assistant will recommend your best matches."
      };
    }

    // Rank candidates by shared interests & complementary skills
    const mySkills = new Set(currentUser.skills || []);
    const myInterests = new Set(currentUser.interests || []);

    const scored = candidates.map(c => {
      const commonInterests = (c.interests || []).filter(i => myInterests.has(i));
      const complementarySkills = (c.skills || []).filter(s => !mySkills.has(s));
      const sharedSkills = (c.skills || []).filter(s => mySkills.has(s));
      const score = (commonInterests.length * 3) + complementarySkills.length + sharedSkills.length;
      return { attendee: c, score, commonInterests, complementarySkills, sharedSkills };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 3);

    let output = `🎯 Top Recommended Matches for ${currentUser.firstName} at ${eventName}:\n\n`;

    topMatches.forEach((m, idx) => {
      const c = m.attendee;
      output += `${idx + 1}. **${c.firstName}**\n`;
      if (m.commonInterests.length > 0) {
        output += `   • Shared Interest: Both looking for "${m.commonInterests.join(', ')}"\n`;
      }
      if (m.complementarySkills.length > 0) {
        output += `   • Complementary Skills: Brings ${m.complementarySkills.slice(0, 2).join(' & ')} to pair with your ${Array.from(mySkills).slice(0, 2).join(' & ')}\n`;
      }
      output += `   • Walk-in Plan: ${c.goal ? `They mentioned: "${c.goal}". Say hi and coordinate meeting up outside before walking in!` : 'Connect to walk into the venue together!'}\n\n`;
    });

    output += `*(⚡ Running in demo mode. For live Gemma AI responses, run "node server.js" with your GEMINI_API_KEY)*`;

    return { success: true, text: output };
  }

  fallbackExplainMatch(userA, userB, eventName) {
    const commonInterests = (userA.interests || []).filter(i => (userB.interests || []).includes(i));
    const compSkills = (userB.skills || []).filter(s => !(userA.skills || []).includes(s));

    let text = `💡 **Why ${userA.firstName} and ${userB.firstName} are a great match:**\n\n`;
    if (commonInterests.length > 0) {
      text += `• **Shared Focus:** Both of you share an interest in "${commonInterests.join(', ')}". Connecting before ${eventName} ensures neither of you has to walk into the venue alone!\n`;
    }
    if (compSkills.length > 0) {
      text += `• **Skill Synergy:** ${userB.firstName} brings experience in ${compSkills.slice(0, 2).join(', ')}, which complements your skills well for hackathon teams or project discussions.\n`;
    }
    if (userB.goal) {
      text += `• **Aligned Goal:** ${userB.firstName}'s goal is: "${userB.goal}". You can reach out with a "Say hi" request to coordinate meeting up 15 minutes before the event starts.`;
    }

    return { success: true, text };
  }

  fallbackIcebreakers(currentUser, target, eventName) {
    const q1 = target.skills && target.skills.length > 0 
      ? `Hey ${target.firstName}! 👋 I saw you know ${target.skills[0]}—are you planning to build something with that at ${eventName}?`
      : `Hey ${target.firstName}! 👋 Are you excited for ${eventName}?`;

    const q2 = target.goal 
      ? `Hi ${target.firstName}! I noticed your goal: "${target.goal}". Would you want to team up or chat about ideas?`
      : `Hi ${target.firstName}! What are you most looking forward to at the event?`;

    const q3 = `Hey! Neither of us should walk in alone—would you like to meet up outside 10 minutes before it kicks off and walk in together?`;

    const text = `💬 **Suggested Icebreaker Questions for ${target.firstName}:**\n\n1. "${q1}"\n\n2. "${q2}"\n\n3. "${q3}"`;

    return { success: true, text };
  }

  fallbackRecommendGroups(currentUser, existingGroups, attendees, eventName) {
    let text = `👥 **Recommended Squads for ${currentUser.firstName}:**\n\n`;

    if (existingGroups && existingGroups.length > 0) {
      text += `• **Existing Group:** Consider joining "${existingGroups[0].groupName}". It matches attendees interested in connecting and collaborating before ${eventName}.\n\n`;
    }

    text += `• **Squad Idea 1: "Entrance Walk-in Squad 🚶‍♂️"**\n`;
    text += `  Invite attendees with the "Walk in together" interest so nobody has to walk through the doors by themselves.\n\n`;

    text += `• **Squad Idea 2: "Hackathon Dev Squad 💻"**\n`;
    text += `  Combine frontend and backend builders to brainstorm ideas and assemble your team before the kickoff!`;

    return { success: true, text };
  }
}

// Global instance attached to window
window.MeetBeforeAI = new SmartMatchAssistant();
window.MeetSphereAI = window.MeetBeforeAI;
