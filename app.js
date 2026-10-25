/**
 * MeetBefore - Core Application Logic (app.js)
 * 
 * "Meet your people before you reach the event, so nobody walks in alone."
 * 
 * Features implemented in order:
 * 1. Login (Google Sign-In with Firebase Auth + Demo switcher)
 * 2. Profile (First name, skills multi-select, interests multi-select, what I want to do)
 * 3. Events (Browse events, create events, "I'm going" toggle)
 * 4. Attendees (View attendee cards, filter by skill and interest)
 * 5. Connect requests ("Say hi", accept/decline, unlocks chat upon acceptance)
 * 6. Chat (Real-time 1-on-1 messaging)
 * 7. Group chat (3 or more connected people)
 * 8. Safety (First name only, Block, Report, no emails displayed)
 * 9. AI (Suggest people for me & Write icebreaker via Gemma/Gemini in ai.js)
 */

// Initial pre-seeded events to make the app vibrant immediately
const SEED_EVENTS = [
  {
    id: "evt_hacktoberfest_2026",
    name: "Hacktoberfest Hackathon & Open Source Meetup",
    date: "Saturday, Oct 31 • 10:00 AM - 6:00 PM",
    place: "Campus Innovation Lab & Main Auditorium",
    description: "A full-day hackathon celebrating open-source software! Connect with other builders beforehand, assemble a squad, and walk into the venue together ready to build.",
    attendees: ["user_maya", "user_liam", "user_aisha", "user_kenji", "user_priya"]
  },
  {
    id: "evt_ai_workshop",
    name: "Generative AI & Agentic Systems Workshop",
    date: "Wednesday, Nov 4 • 2:00 PM - 5:30 PM",
    place: "Engineering Hall B, Room 204",
    description: "Hands-on coding workshop on building practical LLM agents. Meet fellow beginners and developers before the session so you can pair program!",
    attendees: ["user_maya", "user_liam", "user_kenji"]
  },
  {
    id: "evt_design_tech_fest",
    name: "Design + Tech Campus Summit",
    date: "Friday, Nov 13 • 1:00 PM - 7:00 PM",
    place: "Creative Arts Center Plaza",
    description: "Where UI/UX designers and engineers meet. Find collaborators for your portfolio projects and break the ice beforehand.",
    attendees: ["user_sam", "user_aisha", "user_priya"]
  }
];

// Seed profiles for initial attendees (Strictly FIRST NAMES ONLY for safety!)
const SEED_PROFILES = {
  "user_maya": {
    id: "user_maya",
    firstName: "Maya",
    skills: ["AI", "Python", "Web"],
    interests: ["Walk in together", "Hackathon team", "Meet friends"],
    goal: "Looking to join a hackathon team and not walk in by myself! Excited about AI and open source."
  },
  "user_sam": {
    id: "user_sam",
    firstName: "Sam",
    skills: ["Web", "Design", "Beginner"],
    interests: ["Walk in together", "Meet friends", "Brainstorming"],
    goal: "First time at this event! Would love to meet friendly people to grab coffee with before we walk in."
  },
  "user_liam": {
    id: "user_liam",
    firstName: "Liam",
    skills: ["Python", "AI", "Cloud"],
    interests: ["Hackathon team", "Brainstorming"],
    goal: "Backend/Python coder looking for a frontend or UI partner to build a cool hackathon project."
  },
  "user_aisha": {
    id: "user_aisha",
    firstName: "Aisha",
    skills: ["Design", "Web", "Mobile"],
    interests: ["Walk in together", "Hackathon team"],
    goal: "Passionate about clean UI/UX and Flutter apps. Let's meet at the entrance and walk in together!"
  },
  "user_kenji": {
    id: "user_kenji",
    firstName: "Kenji",
    skills: ["Rust", "Python", "Data"],
    interests: ["Meet friends", "Brainstorming", "Mentorship"],
    goal: "Happy to help anyone new to coding and open to chatting about interesting technical challenges."
  },
  "user_priya": {
    id: "user_priya",
    firstName: "Priya",
    skills: ["Web", "Beginner", "Python"],
    interests: ["Walk in together", "First hackathon", "Meet friends"],
    goal: "A bit nervous as this is my first tech event, looking for someone to team up or walk in with!"
  }
};

class MeetBeforeApp {
  constructor() {
    this.currentUser = null;
    this.events = [];
    this.activeEventId = null;
    this.selectedSkillFilter = "ALL";
    this.selectedInterestFilter = "ALL";
    this.activeChatId = null;

    // Safety lists
    this.blockedUsers = new Set();

    // Firebase handles
    this.auth = null;
    this.db = null;
    this.unsubscribeAuth = null;
    this.unsubscribeAttendees = null;
    this.unsubscribeRequests = null;
    this.unsubscribeChats = null;
    this.unsubscribeMessages = null;

    this.init();
  }

  // ==========================================================================
  // INITIALIZATION & STATE SETUP
  // ==========================================================================
  async init() {
    this.loadSafetyData();
    this.initLocalDataIfEmpty();

    // Setup Firebase if configured
    if (window.MEETBEFORE_FIREBASE && window.MEETBEFORE_FIREBASE.isLive()) {
      this.auth = window.MEETBEFORE_FIREBASE.auth();
      this.db = window.MEETBEFORE_FIREBASE.db();

      document.getElementById("banner-text").innerText = "🔥 Live Firebase Connected!";
      document.getElementById("demo-banner").style.backgroundColor = "#ecfdf5";
      document.getElementById("demo-banner").style.borderColor = "#a7f3d0";
      document.getElementById("demo-banner").style.color = "#065f46";

      // Listen to Auth State
      this.auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          await this.handleFirebaseUserLogin(firebaseUser);
        } else {
          this.currentUser = null;
          this.renderAuthUI();
        }
      });
    } else {
      // Offline / Demo Mode: load stored demo session if any
      const savedUser = localStorage.getItem("meetbefore_current_user");
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (e) {
          this.currentUser = null;
        }
      }
      this.renderAuthUI();
    }

    // Load initial events
    await this.loadEvents();
    this.updateConnectionsBadge();
  }

  initLocalDataIfEmpty() {
    if (!localStorage.getItem("mb_events")) {
      localStorage.setItem("mb_events", JSON.stringify(SEED_EVENTS));
    }
    if (!localStorage.getItem("mb_profiles")) {
      localStorage.setItem("mb_profiles", JSON.stringify(SEED_PROFILES));
    }
    if (!localStorage.getItem("mb_requests")) {
      // Seed an initial friendly incoming request so user immediately sees how it works!
      const initialRequests = [
        {
          id: "req_demo_1",
          fromUserId: "user_maya",
          fromUserName: "Maya",
          toUserId: "user_sam",
          toUserName: "Sam",
          eventId: "evt_hacktoberfest_2026",
          status: "pending",
          createdAt: Date.now() - 3600000
        }
      ];
      localStorage.setItem("mb_requests", JSON.stringify(initialRequests));
    }
    if (!localStorage.getItem("mb_chats")) {
      const initialChats = [
        {
          id: "chat_demo_1",
          isGroup: false,
          members: ["user_maya", "user_liam"],
          memberNames: { "user_maya": "Maya", "user_liam": "Liam" },
          lastMessage: "Sounds great! Let's meet 15 mins before at the entrance.",
          updatedAt: Date.now() - 1800000
        }
      ];
      localStorage.setItem("mb_chats", JSON.stringify(initialChats));
    }
    if (!localStorage.getItem("mb_messages")) {
      const initialMessages = [
        {
          id: "msg_1",
          chatId: "chat_demo_1",
          senderId: "user_maya",
          senderName: "Maya",
          text: "Hey Liam! I saw you're interested in the AI workshop too 👋",
          timestamp: Date.now() - 3600000 * 2
        },
        {
          id: "msg_2",
          chatId: "chat_demo_1",
          senderId: "user_liam",
          senderName: "Liam",
          text: "Hi Maya! Yes, would love to team up for the hackathon project as well.",
          timestamp: Date.now() - 3600000 * 1.5
        },
        {
          id: "msg_3",
          chatId: "chat_demo_1",
          senderId: "user_maya",
          senderName: "Maya",
          text: "Sounds great! Let's meet 15 mins before at the entrance.",
          timestamp: Date.now() - 1800000
        }
      ];
      localStorage.setItem("mb_messages", JSON.stringify(initialMessages));
    }
  }

  // ==========================================================================
  // FEATURE 1: AUTHENTICATION (Google Sign-In + Demo Sign-in)
  // ==========================================================================
  async loginGoogle() {
    if (this.auth) {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await this.auth.signInWithPopup(provider);
        this.closeModal("modal-login");
        this.showToast("Signed in with Google! 🎉");
      } catch (error) {
        console.error("Google sign-in error:", error);
        alert("Google Sign-In error: " + error.message);
      }
    } else {
      // In demo mode, inform user and open demo login
      alert("Firebase credentials are not configured yet. Switching to Demo Mode login!");
      this.loginDemo("user_sam");
    }
  }

  async handleFirebaseUserLogin(firebaseUser) {
    // Check if user has an existing profile in Firestore
    try {
      const docRef = this.db.collection("users").doc(firebaseUser.uid);
      const doc = await docRef.get();

      if (doc.exists) {
        this.currentUser = { uid: firebaseUser.uid, ...doc.data() };
        this.renderAuthUI();
      } else {
        // First login: prompt profile setup
        const extractedFirstName = (firebaseUser.displayName || "").split(" ")[0] || "Friend";
        this.currentUser = {
          uid: firebaseUser.uid,
          firstName: extractedFirstName,
          skills: [],
          interests: [],
          goal: ""
        };
        this.openProfileModal(true);
      }
    } catch (e) {
      console.error("Error reading Firestore profile:", e);
    }
  }

  loginDemo(presetUserId = "user_sam") {
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    const selected = profiles[presetUserId] || SEED_PROFILES[presetUserId];

    this.currentUser = {
      uid: selected.id,
      id: selected.id,
      firstName: selected.firstName,
      skills: selected.skills || [],
      interests: selected.interests || [],
      goal: selected.goal || ""
    };

    localStorage.setItem("meetbefore_current_user", JSON.stringify(this.currentUser));
    this.closeModal("modal-login");
    this.renderAuthUI();
    this.showToast(`Logged in as ${this.currentUser.firstName} (Demo Mode)`);

    // Refresh views
    if (this.activeEventId) {
      this.viewEventDetail(this.activeEventId);
    } else {
      this.loadEvents();
    }
  }

  logout() {
    if (this.auth) {
      this.auth.signOut();
    }
    this.currentUser = null;
    localStorage.removeItem("meetbefore_current_user");
    this.renderAuthUI();
    this.switchTab("events");
    this.showToast("Signed out successfully.");
  }

  renderAuthUI() {
    const loggedOutEl = document.getElementById("auth-logged-out");
    const loggedInEl = document.getElementById("auth-logged-in");
    const heroJoinBtn = document.getElementById("hero-join-btn");

    if (this.currentUser) {
      loggedOutEl.style.display = "none";
      loggedInEl.style.display = "flex";
      document.getElementById("header-user-avatar").innerText = (this.currentUser.firstName || "U")[0].toUpperCase();
      document.getElementById("header-user-name").innerText = this.currentUser.firstName || "Friend";

      if (heroJoinBtn) {
        heroJoinBtn.innerText = "👤 My Profile";
        heroJoinBtn.onclick = () => this.openProfileModal();
      }
    } else {
      loggedOutEl.style.display = "flex";
      loggedInEl.style.display = "none";

      if (heroJoinBtn) {
        heroJoinBtn.innerText = "👋 Join MeetBefore";
        heroJoinBtn.onclick = () => this.openLoginModal();
      }
    }
  }

  // ==========================================================================
  // FEATURE 2: PROFILE SETUP & EDIT
  // ==========================================================================
  openProfileModal(isFirstLogin = false) {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    const modalTitle = document.getElementById("profile-modal-title");
    modalTitle.innerText = isFirstLogin ? "Welcome! Set Up Your Profile" : "Edit Profile";

    document.getElementById("profile-first-name").value = this.currentUser.firstName || "";
    document.getElementById("profile-goal").value = this.currentUser.goal || "";

    // Reset and populate skill tags
    const skillsGrid = document.getElementById("profile-skills-grid");
    skillsGrid.querySelectorAll(".selectable-tag").forEach(tag => {
      const val = tag.getAttribute("data-tag");
      if ((this.currentUser.skills || []).includes(val)) {
        tag.classList.add("selected");
      } else {
        tag.classList.remove("selected");
      }
    });

    // Reset and populate interest tags
    const interestsGrid = document.getElementById("profile-interests-grid");
    interestsGrid.querySelectorAll(".selectable-tag").forEach(tag => {
      const val = tag.getAttribute("data-tag");
      if ((this.currentUser.interests || []).includes(val)) {
        tag.classList.add("selected");
      } else {
        tag.classList.remove("selected");
      }
    });

    this.openModal("modal-profile");
  }

  toggleSelectableTag(element) {
    element.classList.toggle("selected");
  }

  async saveProfile(event) {
    event.preventDefault();
    if (!this.currentUser) return;

    // Safety: only store first name, trim spaces
    const fullNameInput = document.getElementById("profile-first-name").value.trim();
    const firstName = fullNameInput.split(" ")[0]; // Enforce first name only!
    const goal = document.getElementById("profile-goal").value.trim();

    // Collect selected skills
    const selectedSkills = [];
    document.querySelectorAll("#profile-skills-grid .selectable-tag.selected").forEach(el => {
      selectedSkills.push(el.getAttribute("data-tag"));
    });

    // Collect selected interests
    const selectedInterests = [];
    document.querySelectorAll("#profile-interests-grid .selectable-tag.selected").forEach(el => {
      selectedInterests.push(el.getAttribute("data-tag"));
    });

    const updatedProfile = {
      ...this.currentUser,
      firstName,
      skills: selectedSkills,
      interests: selectedInterests,
      goal,
      updatedAt: Date.now()
    };

    // Save to Firestore if live
    if (this.db && this.currentUser.uid) {
      try {
        await this.db.collection("users").doc(this.currentUser.uid).set(updatedProfile, { merge: true });
      } catch (err) {
        console.error("Error saving profile to Firestore:", err);
      }
    }

    // Save locally
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    profiles[this.currentUser.uid || this.currentUser.id] = updatedProfile;
    localStorage.setItem("mb_profiles", JSON.stringify(profiles));

    this.currentUser = updatedProfile;
    localStorage.setItem("meetbefore_current_user", JSON.stringify(this.currentUser));

    this.closeModal("modal-profile");
    this.renderAuthUI();
    this.showToast("Profile saved successfully! 🎉");

    // If viewing an event, refresh attendee cards
    if (this.activeEventId) {
      this.viewEventDetail(this.activeEventId);
    }
  }

  // ==========================================================================
  // FEATURE 3: EVENTS (Browse, Create, and "I'm Going" Toggle)
  // ==========================================================================
  async loadEvents() {
    if (this.db) {
      try {
        const snapshot = await this.db.collection("events").get();
        if (!snapshot.empty) {
          const loadedEvents = [];
          snapshot.forEach(doc => {
            loadedEvents.push({ id: doc.id, ...doc.data() });
          });
          this.events = loadedEvents;
          this.renderEvents();
          return;
        }
      } catch (err) {
        console.warn("Could not fetch events from Firestore, using local:", err);
      }
    }

    // Local / Demo mode events
    this.events = JSON.parse(localStorage.getItem("mb_events") || "[]");
    if (this.events.length === 0) {
      this.events = [...SEED_EVENTS];
      localStorage.setItem("mb_events", JSON.stringify(this.events));
    }
    this.renderEvents();
  }

  renderEvents() {
    const container = document.getElementById("events-container");
    if (!container) return;

    if (this.events.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🎪</div>
          <div class="empty-state-title">No events yet</div>
          <div class="empty-state-text">Be the first to create an event and invite others!</div>
        </div>
      `;
      return;
    }

    const currentUid = this.currentUser ? (this.currentUser.uid || this.currentUser.id) : null;

    container.innerHTML = this.events.map(event => {
      const attendees = event.attendees || [];
      const isGoing = currentUid && attendees.includes(currentUid);
      const count = attendees.length;

      return `
        <div class="event-card" onclick="app.viewEventDetail('${event.id}')">
          <div>
            <span class="event-badge">EVENT</span>
            <h4 class="event-card-title">${this.escapeHTML(event.name)}</h4>
            <div class="event-meta">
              <div class="event-meta-item">📅 ${this.escapeHTML(event.date)}</div>
              <div class="event-meta-item">📍 ${this.escapeHTML(event.place)}</div>
            </div>
            <p class="event-desc">${this.escapeHTML(event.description)}</p>
          </div>
          <div class="event-card-footer">
            <span class="attendees-pill">👥 ${count} going</span>
            <button class="btn btn-sm ${isGoing ? 'btn-going-active' : 'btn-outline'}" onclick="event.stopPropagation(); app.toggleGoing('${event.id}')">
              ${isGoing ? "✅ You're Going" : "I'm Going"}
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  openCreateEventModal() {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }
    this.openModal("modal-create-event");
  }

  async saveNewEvent(event) {
    event.preventDefault();
    if (!this.currentUser) return;

    const name = document.getElementById("new-event-name").value.trim();
    const date = document.getElementById("new-event-date").value.trim();
    const place = document.getElementById("new-event-place").value.trim();
    const description = document.getElementById("new-event-desc").value.trim();

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const newEvent = {
      id: "evt_" + Date.now(),
      name,
      date,
      place,
      description,
      attendees: [currentUid], // Creator automatically goes!
      createdBy: currentUid,
      createdAt: Date.now()
    };

    if (this.db) {
      try {
        const docRef = await this.db.collection("events").add(newEvent);
        newEvent.id = docRef.id;
      } catch (err) {
        console.error("Error creating event in Firestore:", err);
      }
    }

    this.events.unshift(newEvent);
    localStorage.setItem("mb_events", JSON.stringify(this.events));

    this.closeModal("modal-create-event");
    document.getElementById("new-event-name").value = "";
    document.getElementById("new-event-date").value = "";
    document.getElementById("new-event-place").value = "";
    document.getElementById("new-event-desc").value = "";

    this.renderEvents();
    this.showToast("Event published! You're the first one going! 🚀");
    this.viewEventDetail(newEvent.id);
  }

  async toggleGoing(eventId) {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const targetEvent = this.events.find(e => e.id === eventId);
    if (!targetEvent) return;

    if (!targetEvent.attendees) {
      targetEvent.attendees = [];
    }

    const index = targetEvent.attendees.indexOf(currentUid);
    const isNowGoing = index === -1;

    if (isNowGoing) {
      targetEvent.attendees.push(currentUid);
      this.showToast("Awesome! You're going to this event! 🎉");
    } else {
      targetEvent.attendees.splice(index, 1);
      this.showToast("You left this event.");
    }

    // Save to Firestore if available
    if (this.db) {
      try {
        await this.db.collection("events").doc(eventId).update({
          attendees: targetEvent.attendees
        });
      } catch (e) {
        console.warn("Firestore update note:", e);
      }
    }

    localStorage.setItem("mb_events", JSON.stringify(this.events));
    this.renderEvents();

    if (this.activeEventId === eventId) {
      this.updateEventDetailHeader(targetEvent);
      this.renderAttendees();
    }
  }

  toggleGoingCurrentEvent() {
    if (this.activeEventId) {
      this.toggleGoing(this.activeEventId);
    }
  }

  // ==========================================================================
  // FEATURE 4: ATTENDEES (Inside Event, Filter by Skill & Interest)
  // ==========================================================================
  viewEventDetail(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    this.activeEventId = eventId;
    this.selectedSkillFilter = "ALL";
    this.selectedInterestFilter = "ALL";
    document.getElementById("attendees-search").value = "";

    // Reset filter chips UI
    document.querySelectorAll("#skill-filter-chips .filter-chip").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-skill") === "ALL");
    });
    document.querySelectorAll("#interest-filter-chips .filter-chip").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-interest") === "ALL");
    });

    this.updateEventDetailHeader(event);
    this.renderAttendees();

    // Switch view
    document.getElementById("view-events").style.display = "none";
    document.getElementById("view-connections").style.display = "none";
    document.getElementById("view-chats").style.display = "none";
    document.getElementById("view-event-detail").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  updateEventDetailHeader(event) {
    document.getElementById("event-detail-title").innerText = event.name;
    document.getElementById("event-detail-date").innerText = "📅 " + event.date;
    document.getElementById("event-detail-place").innerText = "📍 " + event.place;
    document.getElementById("event-detail-desc").innerText = event.description;

    const attendees = event.attendees || [];
    document.getElementById("event-detail-count").innerText = `👥 ${attendees.length} people going`;

    const currentUid = this.currentUser ? (this.currentUser.uid || this.currentUser.id) : null;
    const isGoing = currentUid && attendees.includes(currentUid);

    const goingBtn = document.getElementById("btn-toggle-going");
    if (isGoing) {
      goingBtn.innerText = "✅ You're Going (Click to leave)";
      goingBtn.className = "btn btn-going-active";
    } else {
      goingBtn.innerText = "🚀 I'm Going!";
      goingBtn.className = "btn btn-primary";
    }
  }

  setSkillFilter(skill) {
    this.selectedSkillFilter = skill;
    document.querySelectorAll("#skill-filter-chips .filter-chip").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-skill") === skill);
    });
    this.renderAttendees();
  }

  setInterestFilter(interest) {
    this.selectedInterestFilter = interest;
    document.querySelectorAll("#interest-filter-chips .filter-chip").forEach(c => {
      c.classList.toggle("active", c.getAttribute("data-interest") === interest);
    });
    this.renderAttendees();
  }

  filterAttendees() {
    this.renderAttendees();
  }

  getEventAttendeesList(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event || !event.attendees) return [];

    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    const list = [];

    event.attendees.forEach(uid => {
      // Safety rule: skip blocked users!
      if (this.blockedUsers.has(uid)) return;

      const profile = profiles[uid] || SEED_PROFILES[uid];
      if (profile) {
        list.push({ ...profile, id: uid });
      } else {
        list.push({
          id: uid,
          firstName: "Attendee",
          skills: [],
          interests: [],
          goal: "Going to the event!"
        });
      }
    });

    return list;
  }

  renderAttendees() {
    const container = document.getElementById("attendees-container");
    if (!container || !this.activeEventId) return;

    const allAttendees = this.getEventAttendeesList(this.activeEventId);
    const searchVal = document.getElementById("attendees-search").value.toLowerCase().trim();

    // Apply Filters: Skill, Interest, Search Query
    const filtered = allAttendees.filter(attendee => {
      // Skill filter
      if (this.selectedSkillFilter !== "ALL") {
        if (!(attendee.skills || []).includes(this.selectedSkillFilter)) return false;
      }
      // Interest filter
      if (this.selectedInterestFilter !== "ALL") {
        if (!(attendee.interests || []).includes(this.selectedInterestFilter)) return false;
      }
      // Search filter (First name or goal)
      if (searchVal) {
        const nameMatch = (attendee.firstName || "").toLowerCase().includes(searchVal);
        const goalMatch = (attendee.goal || "").toLowerCase().includes(searchVal);
        if (!nameMatch && !goalMatch) return false;
      }
      return true;
    });

    document.getElementById("filtered-count").innerText = `(${filtered.length} shown)`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">No matching attendees</div>
          <div class="empty-state-text">Try adjusting your skill or interest filter to find other people!</div>
        </div>
      `;
      return;
    }

    const currentUid = this.currentUser ? (this.currentUser.uid || this.currentUser.id) : null;

    container.innerHTML = filtered.map(attendee => {
      const isSelf = currentUid && (attendee.id === currentUid);
      const initial = (attendee.firstName || "A")[0].toUpperCase();

      // Determine connection state with this attendee
      const connectionState = this.getConnectionState(attendee.id);

      return `
        <div class="attendee-card">
          <div>
            <div class="attendee-header">
              <div class="attendee-profile-info">
                <div class="attendee-avatar">${initial}</div>
                <div>
                  <div class="attendee-name">
                    ${this.escapeHTML(attendee.firstName)}
                    ${isSelf ? '<span class="attendee-badge-self">You</span>' : ''}
                  </div>
                </div>
              </div>

              <!-- Safety menu: Report / Block -->
              ${!isSelf ? `
                <div class="dropdown-menu-wrapper">
                  <button class="btn-icon" onclick="app.toggleSafetyMenu('${attendee.id}')" title="Safety options">⋮</button>
                  <div class="safety-dropdown" id="safety-dropdown-${attendee.id}">
                    <button class="safety-dropdown-item" onclick="app.openSafetyReport('${attendee.id}')">
                      ⚠️ Report
                    </button>
                    <button class="safety-dropdown-item danger" onclick="app.openSafetyBlock('${attendee.id}', '${this.escapeHTML(attendee.firstName)}')">
                      🚫 Block
                    </button>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- "What I want to do at the event" Quote -->
            ${attendee.goal ? `
              <div class="attendee-goal">“${this.escapeHTML(attendee.goal)}”</div>
            ` : ''}

            <!-- Skills Badges -->
            ${(attendee.skills && attendee.skills.length > 0) ? `
              <div class="tag-list">
                ${attendee.skills.map(s => `<span class="tag-skill">${this.escapeHTML(s)}</span>`).join("")}
              </div>
            ` : ''}

            <!-- Interests Badges -->
            ${(attendee.interests && attendee.interests.length > 0) ? `
              <div class="tag-list">
                ${attendee.interests.map(i => `<span class="tag-interest">🌟 ${this.escapeHTML(i)}</span>`).join("")}
              </div>
            ` : ''}
          </div>

          <!-- Action Buttons -->
          <div class="attendee-actions">
            ${isSelf ? `
              <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="app.openProfileModal()">
                ✏️ Edit My Profile
              </button>
            ` : `
              ${this.renderConnectionActionButton(attendee.id, connectionState)}
              <button class="btn btn-outline btn-sm" onclick="app.openSmartMatchAssistant('icebreakers', '${attendee.id}')" title="Generate friendly icebreaker with Gemma AI">
                💬 Icebreaker
              </button>
              <button class="btn btn-secondary btn-sm" onclick="app.openSmartMatchAssistant('explain', '${attendee.id}')" title="Explain why you two are a good match">
                💡 Match?
              </button>
            `}
          </div>
        </div>
      `;
    }).join("");
  }

  renderConnectionActionButton(targetUid, state) {
    if (state === "CONNECTED") {
      return `
        <button class="btn btn-primary btn-sm" onclick="app.openOneOnOneChat('${targetUid}')">
          💬 Chat
        </button>
      `;
    } else if (state === "SENT_PENDING") {
      return `
        <button class="btn btn-secondary btn-sm" disabled>
          ⏳ Request Sent
        </button>
      `;
    } else if (state === "RECEIVED_PENDING") {
      return `
        <button class="btn btn-accent btn-sm" onclick="app.switchTab('connections')">
          🔔 Respond
        </button>
      `;
    } else {
      // Not connected
      return `
        <button class="btn btn-primary btn-sm" onclick="app.sendSayHiRequest('${targetUid}')">
          Say hi 👋
        </button>
      `;
    }
  }

  // ==========================================================================
  // FEATURE 5: CONNECT REQUESTS ("Say hi", Accept/Decline, Chat Opens ONLY After)
  // ==========================================================================
  getConnectionState(targetUid) {
    if (!this.currentUser) return "NONE";
    const currentUid = this.currentUser.uid || this.currentUser.id;

    // Check existing accepted chats
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const isConnected = chats.some(c => 
      !c.isGroup && c.members.includes(currentUid) && c.members.includes(targetUid)
    );
    if (isConnected) return "CONNECTED";

    // Check requests
    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    
    // Check if I sent request to target
    const sentReq = requests.find(r => r.fromUserId === currentUid && r.toUserId === targetUid && r.status === "pending");
    if (sentReq) return "SENT_PENDING";

    // Check if target sent request to me
    const receivedReq = requests.find(r => r.fromUserId === targetUid && r.toUserId === currentUid && r.status === "pending");
    if (receivedReq) return "RECEIVED_PENDING";

    return "NONE";
  }

  async sendSayHiRequest(targetUid) {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    if (currentUid === targetUid) return;

    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    const targetProfile = profiles[targetUid] || SEED_PROFILES[targetUid] || { firstName: "Attendee" };

    const newRequest = {
      id: "req_" + Date.now(),
      fromUserId: currentUid,
      fromUserName: this.currentUser.firstName,
      toUserId: targetUid,
      toUserName: targetProfile.firstName,
      eventId: this.activeEventId || "general",
      status: "pending",
      createdAt: Date.now()
    };

    // Save to Firestore if available
    if (this.db) {
      try {
        await this.db.collection("requests").add(newRequest);
      } catch (err) {
        console.warn("Firestore request note:", err);
      }
    }

    requests.unshift(newRequest);
    localStorage.setItem("mb_requests", JSON.stringify(requests));

    this.renderAttendees();
    this.updateConnectionsBadge();
    this.showToast(`Say hi request sent to ${targetProfile.firstName}! 👋`);
  }

  async acceptRequest(requestId) {
    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    req.status = "accepted";
    localStorage.setItem("mb_requests", JSON.stringify(requests));

    // Create 1-on-1 Chat room in chats list
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const currentUid = this.currentUser.uid || this.currentUser.id;

    const newChat = {
      id: "chat_" + Date.now(),
      isGroup: false,
      members: [req.fromUserId, req.toUserId],
      memberNames: {
        [req.fromUserId]: req.fromUserName,
        [req.toUserId]: req.toUserName
      },
      lastMessage: "Connected! You can now chat and coordinate walking in together.",
      updatedAt: Date.now()
    };

    // Save to Firestore if live
    if (this.db) {
      try {
        await this.db.collection("chats").doc(newChat.id).set(newChat);
        await this.db.collection("requests").doc(requestId).update({ status: "accepted" });
      } catch (e) {
        console.warn("Firestore chat note:", e);
      }
    }

    chats.unshift(newChat);
    localStorage.setItem("mb_chats", JSON.stringify(chats));

    this.showToast(`Connected with ${req.fromUserName}! Chat unlocked 🎉`);
    this.renderConnections();
    this.updateConnectionsBadge();
  }

  async declineRequest(requestId) {
    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    req.status = "declined";
    localStorage.setItem("mb_requests", JSON.stringify(requests));

    if (this.db) {
      try {
        await this.db.collection("requests").doc(requestId).update({ status: "declined" });
      } catch (e) {}
    }

    this.showToast("Request declined.");
    this.renderConnections();
    this.updateConnectionsBadge();
  }

  updateConnectionsBadge() {
    const badge = document.getElementById("requests-badge");
    if (!badge || !this.currentUser) return;

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    const pendingCount = requests.filter(r => r.toUserId === currentUid && r.status === "pending").length;

    if (pendingCount > 0) {
      badge.style.display = "inline-block";
      badge.innerText = pendingCount;
    } else {
      badge.style.display = "none";
    }
  }

  renderConnections() {
    if (!this.currentUser) {
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const requests = JSON.parse(localStorage.getItem("mb_requests") || "[]");
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");

    // Incoming Pending Requests
    const incomingList = document.getElementById("incoming-requests-list");
    const incoming = requests.filter(r => r.toUserId === currentUid && r.status === "pending" && !this.blockedUsers.has(r.fromUserId));

    if (incoming.length === 0) {
      incomingList.innerHTML = `<div style="font-size: 0.9rem; color: var(--text-muted); padding: 8px 0;">No incoming requests right now.</div>`;
    } else {
      incomingList.innerHTML = incoming.map(req => {
        const profile = profiles[req.fromUserId] || SEED_PROFILES[req.fromUserId] || {};
        return `
          <div class="request-item">
            <div class="request-user-info">
              <div class="user-avatar-circle">${(req.fromUserName || "A")[0].toUpperCase()}</div>
              <div>
                <strong style="font-size: 0.95rem;">${this.escapeHTML(req.fromUserName)}</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">wants to connect before the event</div>
                ${profile.goal ? `<div style="font-size: 0.82rem; font-style: italic; color: var(--primary);">“${this.escapeHTML(profile.goal)}”</div>` : ''}
              </div>
            </div>
            <div class="request-actions">
              <button class="btn btn-secondary btn-sm" onclick="app.declineRequest('${req.id}')">Decline</button>
              <button class="btn btn-primary btn-sm" onclick="app.acceptRequest('${req.id}')">Accept & Chat</button>
            </div>
          </div>
        `;
      }).join("");
    }

    // Sent Pending Requests
    const sentList = document.getElementById("sent-requests-list");
    const sent = requests.filter(r => r.fromUserId === currentUid && r.status === "pending" && !this.blockedUsers.has(r.toUserId));

    if (sent.length === 0) {
      sentList.innerHTML = `<div style="font-size: 0.9rem; color: var(--text-muted); padding: 8px 0;">No pending requests sent.</div>`;
    } else {
      sentList.innerHTML = sent.map(req => `
        <div class="request-item">
          <div class="request-user-info">
            <div class="user-avatar-circle" style="background-color: var(--text-muted);">${(req.toUserName || "A")[0].toUpperCase()}</div>
            <div>
              <strong style="font-size: 0.95rem;">${this.escapeHTML(req.toUserName)}</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Request sent • Waiting for response</div>
            </div>
          </div>
          <div>
            <span style="font-size: 0.82rem; color: var(--text-subtle);">Pending</span>
          </div>
        </div>
      `).join("");
    }

    // Connected Friends
    const friendsList = document.getElementById("connected-friends-list");
    const user1On1Chats = chats.filter(c => !c.isGroup && c.members.includes(currentUid));

    if (user1On1Chats.length === 0) {
      friendsList.innerHTML = `<div style="font-size: 0.9rem; color: var(--text-muted); padding: 8px 0;">No connected friends yet. Click "Say hi" on an event attendee to connect!</div>`;
    } else {
      friendsList.innerHTML = user1On1Chats.map(c => {
        const friendUid = c.members.find(m => m !== currentUid);
        if (this.blockedUsers.has(friendUid)) return '';

        const friendName = (c.memberNames && c.memberNames[friendUid]) || "Friend";
        const profile = profiles[friendUid] || SEED_PROFILES[friendUid] || {};

        return `
          <div class="request-item">
            <div class="request-user-info">
              <div class="user-avatar-circle">${friendName[0].toUpperCase()}</div>
              <div>
                <strong style="font-size: 0.95rem;">${this.escapeHTML(friendName)}</strong>
                ${profile.goal ? `<div style="font-size: 0.8rem; color: var(--text-muted);">“${this.escapeHTML(profile.goal)}”</div>` : ''}
              </div>
            </div>
            <div class="request-actions">
              <button class="btn btn-outline btn-sm" onclick="app.openSafetyReport('${friendUid}')">Report</button>
              <button class="btn btn-primary btn-sm" onclick="app.openChatConversation('${c.id}')">💬 Chat</button>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // ==========================================================================
  // FEATURE 6 & 7: REAL-TIME CHAT (1-on-1 and Group Chats)
  // ==========================================================================
  openOneOnOneChat(targetUid) {
    if (!this.currentUser) return;
    const currentUid = this.currentUser.uid || this.currentUser.id;

    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const existing = chats.find(c => !c.isGroup && c.members.includes(currentUid) && c.members.includes(targetUid));

    if (existing) {
      this.switchTab("chats");
      this.openChatConversation(existing.id);
    } else {
      this.showToast("You need to send a Say Hi request and be accepted first!");
    }
  }

  renderChatsList() {
    const listEl = document.getElementById("chats-conversations-list");
    if (!listEl) return;

    if (!this.currentUser) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 20px 10px;">
          <div class="empty-state-title" style="font-size: 0.95rem;">Sign In to View Chats</div>
          <button class="btn btn-primary btn-sm" style="margin-top: 8px;" onclick="app.openLoginModal()">Sign In</button>
        </div>
      `;
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const myChats = chats.filter(c => c.members.includes(currentUid));

    if (myChats.length === 0) {
      listEl.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px 8px;">
          No active conversations.<br>Connect with attendees to start chatting!
        </div>
      `;
      return;
    }

    listEl.innerHTML = myChats.map(chat => {
      const isActive = chat.id === this.activeChatId;
      let title = "";
      let isGroup = chat.isGroup;

      if (isGroup) {
        title = chat.groupName || "Group Chat";
      } else {
        const otherUid = chat.members.find(m => m !== currentUid);
        title = (chat.memberNames && chat.memberNames[otherUid]) || "Friend";
      }

      const initial = (title || "C")[0].toUpperCase();

      return `
        <div class="chat-item-card ${isActive ? 'active' : ''}" onclick="app.openChatConversation('${chat.id}')">
          <div class="chat-item-avatar ${isGroup ? 'group' : ''}">${isGroup ? '👥' : initial}</div>
          <div class="chat-item-details">
            <div class="chat-item-name">${this.escapeHTML(title)}</div>
            <div class="chat-item-lastmsg">${this.escapeHTML(chat.lastMessage || "Start the conversation!")}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  openChatConversation(chatId) {
    this.activeChatId = chatId;
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const currentUid = this.currentUser.uid || this.currentUser.id;

    let title = "";
    let subtitle = "";
    if (chat.isGroup) {
      title = chat.groupName || "Group Chat";
      subtitle = `Group of ${chat.members.length} people`;
    } else {
      const otherUid = chat.members.find(m => m !== currentUid);
      title = (chat.memberNames && chat.memberNames[otherUid]) || "Friend";
      subtitle = "Connected friend • Walking in together";
    }

    document.getElementById("chat-header-title").innerText = title;
    document.getElementById("chat-header-subtitle").innerText = subtitle;
    document.getElementById("chat-header-actions").style.display = "block";

    this.renderChatsList();
    this.renderMessages(chatId);

    // Scroll chat to bottom
    const msgContainer = document.getElementById("chat-messages-container");
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  renderMessages(chatId) {
    const container = document.getElementById("chat-messages-container");
    const currentUid = this.currentUser ? (this.currentUser.uid || this.currentUser.id) : null;

    const messages = JSON.parse(localStorage.getItem("mb_messages") || "[]");
    const chatMessages = messages.filter(m => m.chatId === chatId);

    if (chatMessages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👋</div>
          <div class="empty-state-title">Break the ice!</div>
          <div class="empty-state-text">Say hello, coordinate where to meet outside, and walk in together!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = chatMessages.map(msg => {
      const isOutgoing = msg.senderId === currentUid;
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
          <div class="message-sender">${this.escapeHTML(msg.senderName || "Friend")}</div>
          <div class="message-text">${this.escapeHTML(msg.text)}</div>
          <div class="message-time">${timeStr}</div>
        </div>
      `;
    }).join("");

    container.scrollTop = container.scrollHeight;
  }

  async sendMessage(event) {
    event.preventDefault();
    if (!this.currentUser) return;
    if (!this.activeChatId) {
      this.showToast("Please select a conversation first.");
      return;
    }

    const input = document.getElementById("chat-input-text");
    const text = input.value.trim();
    if (!text) return;

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const newMsg = {
      id: "msg_" + Date.now(),
      chatId: this.activeChatId,
      senderId: currentUid,
      senderName: this.currentUser.firstName,
      text,
      timestamp: Date.now()
    };

    // Save to Firestore if live
    if (this.db) {
      try {
        await this.db.collection("chats").doc(this.activeChatId).collection("messages").add(newMsg);
        await this.db.collection("chats").doc(this.activeChatId).update({
          lastMessage: text,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn("Firestore send message note:", err);
      }
    }

    // Save locally
    const messages = JSON.parse(localStorage.getItem("mb_messages") || "[]");
    messages.push(newMsg);
    localStorage.setItem("mb_messages", JSON.stringify(messages));

    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const activeChat = chats.find(c => c.id === this.activeChatId);
    if (activeChat) {
      activeChat.lastMessage = text;
      activeChat.updatedAt = Date.now();
      localStorage.setItem("mb_chats", JSON.stringify(chats));
    }

    input.value = "";
    this.renderMessages(this.activeChatId);
    this.renderChatsList();
  }

  // Feature 7: Group Creation (3 or more connected people)
  openCreateGroupModal() {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");

    // Get all 1-on-1 connected friends
    const connectedFriendUids = [];
    chats.filter(c => !c.isGroup && c.members.includes(currentUid)).forEach(c => {
      const friendUid = c.members.find(m => m !== currentUid);
      if (friendUid && !connectedFriendUids.includes(friendUid)) {
        connectedFriendUids.push(friendUid);
      }
    });

    const checkboxContainer = document.getElementById("group-friends-checkbox-list");

    if (connectedFriendUids.length < 2) {
      checkboxContainer.innerHTML = `
        <div style="font-size: 0.88rem; color: #dc2626; padding: 10px; background: #fef2f2; border-radius: var(--radius-sm);">
          ⚠️ You need at least 2 connected friends to create a 3+ person group. Connect with more attendees to assemble your squad!
        </div>
      `;
    } else {
      checkboxContainer.innerHTML = connectedFriendUids.map(uid => {
        const profile = profiles[uid] || SEED_PROFILES[uid] || { firstName: "Friend" };
        return `
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; cursor: pointer; padding: 6px; border-radius: var(--radius-sm); background: var(--bg-muted);">
            <input type="checkbox" name="group-friend-select" value="${uid}">
            <span>${this.escapeHTML(profile.firstName)} (${(profile.skills || []).slice(0, 2).join(", ") || "Attendee"})</span>
          </label>
        `;
      }).join("");
    }

    this.openModal("modal-create-group");
  }

  async saveNewGroup(event) {
    event.preventDefault();
    if (!this.currentUser) return;

    const groupName = document.getElementById("group-name").value.trim();
    const selectedBoxes = document.querySelectorAll('input[name="group-friend-select"]:checked');
    const selectedFriendUids = Array.from(selectedBoxes).map(b => b.value);

    if (selectedFriendUids.length < 2) {
      alert("Please select at least 2 connected friends to create a 3+ person group!");
      return;
    }

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const members = [currentUid, ...selectedFriendUids];
    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");

    const memberNames = { [currentUid]: this.currentUser.firstName };
    selectedFriendUids.forEach(uid => {
      const p = profiles[uid] || SEED_PROFILES[uid] || { firstName: "Friend" };
      memberNames[uid] = p.firstName;
    });

    const newGroupChat = {
      id: "group_" + Date.now(),
      isGroup: true,
      groupName,
      members,
      memberNames,
      lastMessage: `Group created by ${this.currentUser.firstName}!`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (this.db) {
      try {
        await this.db.collection("chats").doc(newGroupChat.id).set(newGroupChat);
      } catch (e) {
        console.warn("Firestore group note:", e);
      }
    }

    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    chats.unshift(newGroupChat);
    localStorage.setItem("mb_chats", JSON.stringify(chats));

    this.closeModal("modal-create-group");
    document.getElementById("group-name").value = "";
    this.showToast(`Group "${groupName}" created! 🎉`);
    this.switchTab("chats");
    this.openChatConversation(newGroupChat.id);
  }

  // ==========================================================================
  // FEATURE 8: SAFETY (First Name Only, Block, Report, Never Show Emails)
  // ==========================================================================
  loadSafetyData() {
    try {
      const blocked = JSON.parse(localStorage.getItem("mb_blocked_users") || "[]");
      this.blockedUsers = new Set(blocked);
    } catch (e) {
      this.blockedUsers = new Set();
    }
  }

  toggleSafetyMenu(uid) {
    const el = document.getElementById(`safety-dropdown-${uid}`);
    if (el) {
      el.classList.toggle("open");
    }
  }

  openSafetyReport(targetUid) {
    document.getElementById("report-target-user-id").value = targetUid;
    document.getElementById("report-details").value = "";
    this.openModal("modal-report");
  }

  openSafetyReportForCurrentChat() {
    if (!this.activeChatId) return;
    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const chat = chats.find(c => c.id === this.activeChatId);
    if (!chat) return;

    const currentUid = this.currentUser.uid || this.currentUser.id;
    const targetUid = chat.members.find(m => m !== currentUid);
    if (targetUid) {
      this.openSafetyReport(targetUid);
    }
  }

  async submitReport(event) {
    event.preventDefault();
    const targetUserId = document.getElementById("report-target-user-id").value;
    const reason = document.getElementById("report-reason").value;
    const details = document.getElementById("report-details").value.trim();

    const reportData = {
      id: "rep_" + Date.now(),
      reportedBy: this.currentUser ? (this.currentUser.uid || this.currentUser.id) : "anonymous",
      reportedUser: targetUserId,
      reason,
      details,
      timestamp: Date.now()
    };

    if (this.db) {
      try {
        await this.db.collection("reports").add(reportData);
      } catch (e) {}
    }

    const reports = JSON.parse(localStorage.getItem("mb_reports") || "[]");
    reports.push(reportData);
    localStorage.setItem("mb_reports", JSON.stringify(reports));

    this.closeModal("modal-report");
    this.showToast("Thank you. Your report has been submitted to moderators. 🛡️");
  }

  openSafetyBlock(targetUid, targetName) {
    document.getElementById("block-target-user-id").value = targetUid;
    document.getElementById("block-target-name").innerText = targetName;
    this.openModal("modal-block");
  }

  confirmBlockUser() {
    const targetUserId = document.getElementById("block-target-user-id").value;
    if (!targetUserId) return;

    this.blockedUsers.add(targetUserId);
    localStorage.setItem("mb_blocked_users", JSON.stringify(Array.from(this.blockedUsers)));

    this.closeModal("modal-block");
    this.showToast("User blocked. They will no longer appear on your attendee list. 🚫");

    // Refresh view
    if (this.activeEventId) {
      this.renderAttendees();
    }
    this.renderConnections();
    this.renderChatsList();
  }

  // ==========================================================================
  // FEATURE 9: SMART MATCH ASSISTANT (POWERED BY GEMMA AI)
  // ==========================================================================
  
  openSmartMatchAssistant(tab = 'connections', targetUid = null) {
    if (!this.currentUser) {
      this.openLoginModal();
      return;
    }

    this.populateAITargetSelectors(targetUid);
    this.openModal("modal-smart-match");
    this.switchAITab(tab);

    if (tab === 'explain' && targetUid) {
      this.runAIExplainMatch();
    } else if (tab === 'icebreakers' && targetUid) {
      this.runAIIcebreakers();
    } else if (tab === 'connections') {
      const resEl = document.getElementById("ai-connections-result");
      if (resEl && (!resEl.innerText || resEl.innerText.trim() === '')) {
        this.runAISmartMatch();
      }
    }
  }

  populateAITargetSelectors(selectedUid = null) {
    const attendees = this.getEventAttendeesList(this.activeEventId);
    const candidates = attendees.filter(a => a.id !== this.currentUser.uid && a.id !== this.currentUser.id);

    const explainSelect = document.getElementById("ai-explain-target-select");
    const icebreakerSelect = document.getElementById("ai-icebreaker-target-select");

    if (candidates.length === 0) {
      const emptyOpt = `<option value="">No other attendees available yet</option>`;
      if (explainSelect) explainSelect.innerHTML = emptyOpt;
      if (icebreakerSelect) icebreakerSelect.innerHTML = emptyOpt;
      return;
    }

    const optionsHtml = candidates.map(c => 
      `<option value="${c.id}" ${c.id === selectedUid ? 'selected' : ''}>${this.escapeHTML(c.firstName)} (${(c.skills || []).slice(0, 2).join(', ') || 'Attendee'})</option>`
    ).join('');

    if (explainSelect) explainSelect.innerHTML = optionsHtml;
    if (icebreakerSelect) icebreakerSelect.innerHTML = optionsHtml;
  }

  switchAITab(tab) {
    // Update tab buttons
    document.querySelectorAll(".ai-tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`ai-tab-${tab}`);
    if (activeBtn) activeBtn.classList.add("active");

    // Hide all AI panels
    document.getElementById("ai-panel-connections").style.display = "none";
    document.getElementById("ai-panel-explain").style.display = "none";
    document.getElementById("ai-panel-icebreakers").style.display = "none";
    document.getElementById("ai-panel-groups").style.display = "none";

    // Show selected panel
    const targetPanel = document.getElementById(`ai-panel-${tab}`);
    if (targetPanel) targetPanel.style.display = "block";
  }

  showAILoading(message) {
    const loader = document.getElementById("ai-global-loading");
    const msg = document.getElementById("ai-loading-message");
    if (loader && msg) {
      msg.innerText = message || "Gemma AI is processing...";
      loader.style.display = "block";
    }
  }

  hideAILoading() {
    const loader = document.getElementById("ai-global-loading");
    if (loader) loader.style.display = "none";
  }

  renderAIError(targetEl, result) {
    if (result.missingKey) {
      targetEl.innerHTML = `
        <div style="color: #b45309; font-weight: 600; line-height: 1.5;">
          ⚠️ <strong>GEMINI_API_KEY Missing on Server</strong><br>
          ${this.escapeHTML(result.error)}
          <div style="margin-top: 10px; font-size: 0.82rem; color: var(--text-muted); font-weight: normal;">
            Create a <code>.env</code> file in your project directory with:<br>
            <code>GEMINI_API_KEY=your_actual_key_here</code>
          </div>
        </div>
      `;
    } else if (result.backendOffline) {
      targetEl.innerHTML = `
        <div style="color: #dc2626; font-weight: 600; line-height: 1.5;">
          📡 <strong>Backend Server Not Detected</strong><br>
          ${this.escapeHTML(result.error)}
          <div style="margin-top: 10px; font-size: 0.82rem; color: var(--text-muted); font-weight: normal;">
            Start the server in your terminal: <code>npm start</code> or <code>node server.js</code>
          </div>
        </div>
      `;
    } else {
      targetEl.innerHTML = `
        <div style="color: #dc2626; font-weight: 600;">
          ❌ AI Error: ${this.escapeHTML(result.error || 'Request failed')}
        </div>
      `;
    }
  }

  // Capability 1: Recommend Potential Connections
  async runAISmartMatch() {
    const resEl = document.getElementById("ai-connections-result");
    resEl.style.display = "none";
    this.showAILoading("Gemma AI is analyzing attendee profiles & finding the best matches...");

    const attendees = this.getEventAttendeesList(this.activeEventId);
    const event = this.events.find(e => e.id === this.activeEventId);
    const eventName = event ? event.name : "Upcoming Meetup";

    const result = await window.MeetBeforeAI.getSmartMatchRecommendations(this.currentUser, attendees, eventName);
    this.hideAILoading();
    resEl.style.display = "block";

    if (result.success) {
      resEl.innerText = result.text;
    } else {
      this.renderAIError(resEl, result);
    }
  }

  // Capability 2: Explain Why Two Attendees Are A Match
  async runAIExplainMatch() {
    const resEl = document.getElementById("ai-explain-result");
    const targetUid = document.getElementById("ai-explain-target-select")?.value;

    if (!targetUid) {
      this.showToast("Please select an attendee first.");
      return;
    }

    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    const targetProfile = profiles[targetUid] || SEED_PROFILES[targetUid];
    if (!targetProfile) return;

    resEl.style.display = "none";
    this.showAILoading(`Gemma AI is explaining your compatibility with ${targetProfile.firstName}...`);

    const event = this.events.find(e => e.id === this.activeEventId);
    const eventName = event ? event.name : "the event";

    const result = await window.MeetBeforeAI.explainMatch(this.currentUser, targetProfile, eventName);
    this.hideAILoading();
    resEl.style.display = "block";

    if (result.success) {
      resEl.innerText = result.text;
    } else {
      this.renderAIError(resEl, result);
    }
  }

  // Capability 3: Suggest Icebreaker Questions
  async runAIIcebreakers() {
    const resEl = document.getElementById("ai-icebreaker-result");
    const copyBtn = document.getElementById("btn-copy-ai-icebreakers");
    const targetUid = document.getElementById("ai-icebreaker-target-select")?.value;

    if (!targetUid) {
      this.showToast("Please select an attendee first.");
      return;
    }

    const profiles = JSON.parse(localStorage.getItem("mb_profiles") || "{}");
    const targetProfile = profiles[targetUid] || SEED_PROFILES[targetUid];
    if (!targetProfile) return;

    resEl.style.display = "none";
    if (copyBtn) copyBtn.style.display = "none";
    this.showAILoading(`Gemma AI is crafting icebreaker questions for ${targetProfile.firstName}...`);

    const event = this.events.find(e => e.id === this.activeEventId);
    const eventName = event ? event.name : "the event";

    const result = await window.MeetBeforeAI.suggestIcebreakers(this.currentUser, targetProfile, eventName);
    this.hideAILoading();
    resEl.style.display = "block";

    if (result.success) {
      resEl.innerText = result.text;
      this.currentIcebreakers = result.text;
      if (copyBtn) copyBtn.style.display = "inline-flex";
    } else {
      this.renderAIError(resEl, result);
    }
  }

  copyAIIcebreakers() {
    if (this.currentIcebreakers) {
      navigator.clipboard.writeText(this.currentIcebreakers).then(() => {
        this.showToast("Icebreaker questions copied to clipboard! 📋");
      }).catch(() => {
        this.showToast("Please select and copy text from the box.");
      });
    }
  }

  // Capability 4: Recommend Suitable Groups
  async runAIRecommendGroups() {
    const resEl = document.getElementById("ai-groups-result");
    resEl.style.display = "none";
    this.showAILoading("Gemma AI is analyzing groups & squads for your interests...");

    const chats = JSON.parse(localStorage.getItem("mb_chats") || "[]");
    const groups = chats.filter(c => c.isGroup);
    const attendees = this.getEventAttendeesList(this.activeEventId);
    const event = this.events.find(e => e.id === this.activeEventId);
    const eventName = event ? event.name : "the event";

    const result = await window.MeetBeforeAI.recommendGroups(this.currentUser, groups, attendees, eventName);
    this.hideAILoading();
    resEl.style.display = "block";

    if (result.success) {
      resEl.innerText = result.text;
    } else {
      this.renderAIError(resEl, result);
    }
  }

  // Backward-compatibility aliases
  triggerAISuggestions() {
    this.openSmartMatchAssistant('connections');
  }

  triggerIcebreaker(targetUid) {
    this.openSmartMatchAssistant('icebreakers', targetUid);
  }

  // ==========================================================================
  // UI NAVIGATION & MODALS
  // ==========================================================================
  switchTab(tabName) {
    // Update tabs
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    const activeTabBtn = document.getElementById(`tab-${tabName}`);
    if (activeTabBtn) activeTabBtn.classList.add("active");

    // Hide all views
    document.getElementById("view-events").style.display = "none";
    document.getElementById("view-event-detail").style.display = "none";
    document.getElementById("view-connections").style.display = "none";
    document.getElementById("view-chats").style.display = "none";

    if (tabName === "events") {
      document.getElementById("view-events").style.display = "block";
      this.loadEvents();
    } else if (tabName === "connections") {
      document.getElementById("view-connections").style.display = "block";
      this.renderConnections();
    } else if (tabName === "chats") {
      document.getElementById("view-chats").style.display = "block";
      this.renderChatsList();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  openLoginModal() {
    this.openModal("modal-login");
  }

  openSettingsModal() {
    const statusEl = document.getElementById("settings-firebase-status");
    if (window.MEETBEFORE_FIREBASE && window.MEETBEFORE_FIREBASE.isLive()) {
      statusEl.innerText = "🔥 Connected to Live Firebase Firestore";
      statusEl.style.color = "#059669";
    } else {
      statusEl.innerText = "⚡ Demo / Mock Mode Active";
      statusEl.style.color = "#b45309";
    }

    const aiKey = window.MeetBeforeAI ? window.MeetBeforeAI.getApiKey() : "";
    document.getElementById("settings-ai-key").value = aiKey || "";

    this.openModal("modal-settings");
  }

  saveSettings() {
    const aiKey = document.getElementById("settings-ai-key").value.trim();
    if (window.MeetBeforeAI) {
      if (aiKey) {
        window.MeetBeforeAI.saveApiKey(aiKey);
      } else {
        window.MeetBeforeAI.clearApiKey();
      }
    }

    const customFirebaseJson = document.getElementById("settings-firebase-json").value.trim();
    if (customFirebaseJson) {
      try {
        const parsed = JSON.parse(customFirebaseJson);
        window.MEETBEFORE_FIREBASE.saveCustomConfig(parsed);
      } catch (e) {
        alert("Invalid JSON format for Firebase configuration.");
        return;
      }
    }

    this.closeModal("modal-settings");
    this.showToast("Settings updated! Reloading...");
    setTimeout(() => window.location.reload(), 600);
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("open");
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("open");
  }

  showToast(message) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-message");
    if (!toast || !msgEl) return;

    msgEl.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Global Application Instance
window.app = new MeetBeforeApp();
