# Voxa User Journey Map (aligned to current diagram)

This version mirrors the information architecture you sketched: login → login page → dashboard → two inputs → status badge → VAPI → handoff back to user → live text stream → call history → memory. It also includes the feedback loop from memory into database and optimizations that inform the next call.

---

## Swimlanes

**Frontstage UI**: login page, dashboard, inputs, status badge, live text stream, history.

**Backstage assistant**: state tracker, IVR mapping, VAPI orchestration, bridging.

**Support systems**: database, call history, optimizations, long term memory (Yellowpages).

---

## Stage by stage

### 1) Login → Login page → Dashboard

* User clicks Login and authenticates on a simple login page.
* On success, the app routes to **Dashboard** with state = Idle.

### 2) Inputs on Dashboard

* Two fields visible side by side:

  * **\[INPUT] Phone number**
  * **\[INPUT] Goal of call**
* Start Call button becomes active when both inputs validate.
* A thin baseline connection from the inputs to the stream is always present so events can start printing immediately after Start.

### 3) Status badge (top of dashboard)

* Single compact badge that flips through these states:

  * **Dialing**
  * **Mapping** (IVR detection and menu navigation)
  * **Bridged** (user is connected to a human)
  * **Ended** or **Failed** when complete

### 4) VAPI orchestration

* On Start, the assistant creates the business leg and begins ASR.
* IVR prompts are classified and mapped. Actions are chosen: press digits, speak a short phrase, wait.
* VAPI emits events that feed the stream and update the status badge.

### 5) Handoff back to user (decision diamond)

* Triggered when a human is detected.
* The assistant says a one line intro, then **bridges** the user and mutes.
* The UI flips badge to **Bridged** and the stream continues to log high value moments.

### 6) Live text stream from agent call and user call

* Single scrollable panel that shows time stamped lines from start to finish:

  * menu heard, action pressed, short phrases spoken
  * detected transfer, bridged state, key fields captured
  * final summary
* The baseline from inputs to stream indicates that the stream is the persistent narrative for the call.

### 7) Call history

* When the call ends, a compact card is created in **Call history** with:

  * destination number and goal
  * outcome and duration
  * link to open the full stream transcript

### 8) AI remembers your conversations (Yellowpages)

* A lightweight memory that stores per company IVR paths and phrases that reliably lead to a human.
* Populated from call history and stream extractions.
* This block is consumer facing in name only. All logic lives backstage.

### 9) Database, history, call optimizations (gray box)

* Central store that aggregates:

  * transcripts and extracted fields
  * success paths and failure modes
  * timing stats for each IVR step
* Feeds **VAPI** before each new call so the assistant can skip known branches and go straight to working paths.
* The **red loop** in the diagram represents this memory → database → VAPI feedback cycle.

---

## Event flow summary (what the stream shows)

1. Calling business number
2. Menu detected
3. Pressed 2
4. Waiting 3 s
5. Said "operator"
6. Human detected
7. Bridging you now
8. You are live with a representative
9. Summary and next steps

---

## Data flow summary

* Inputs → metadata for the call
* VAPI events → live stream + status badge
* End of call → call history card + transcript
* History + transcripts → Yellowpages memory
* Memory → database optimizations → VAPI preload for the next call

---

## Success checkpoints

* Inputs validated and Start Call enabled
* Status badge advances through Dialing → Mapping → Bridged
* Handoff fires automatically when human detected
* Stream contains a concise end summary
* History card created and memory updated for future optimizations

---

## Edge cases to show in the stream

* Busy or unreachable number
* Infinite IVR loop detected, switching to operator path
* Business closed announcement
* Voicemail detected, ending call

---

This captures the exact nodes and arrows from the diagram and keeps the same naming: **status badge**, **VAPI**, **HANDOFF back to user**, **stream of text**, **call history**, and **ai remembers your conversations (Yellowpages)** with the feedback loop into **database/history/call optimizations**.

# Voxa User Journey Map (aligned to current diagram)

This version mirrors the information architecture you sketched: login → login page → dashboard → two inputs → status badge → VAPI → handoff back to user → live text stream → call history → memory. It also includes the feedback loop from memory into database and optimizations that inform the next call.

---

## Swimlanes

**Frontstage UI**: login page, dashboard, inputs, status badge, live text stream, history.

**Backstage assistant**: state tracker, IVR mapping, VAPI orchestration, bridging.

**Support systems**: database, call history, optimizations, long term memory (Yellowpages).

---

## Stage by stage

### 1) Login → Login page → Dashboard

* User clicks Login and authenticates on a simple login page.
* On success, the app routes to **Dashboard** with state = Idle.

### 2) Inputs on Dashboard

* Two fields visible side by side:

  * **\[INPUT] Phone number**
  * **\[INPUT] Goal of call**
* Start Call button becomes active when both inputs validate.
* A thin baseline connection from the inputs to the stream is always present so events can start printing immediately after Start.

### 3) Status badge (top of dashboard)

* Single compact badge that flips through these states:

  * **Dialing**
  * **Mapping** (IVR detection and menu navigation)
  * **Bridged** (user is connected to a human)
  * **Ended** or **Failed** when complete

### 4) VAPI orchestration

* On Start, the assistant creates the business leg and begins ASR.
* IVR prompts are classified and mapped. Actions are chosen: press digits, speak a short phrase, wait.
* VAPI emits events that feed the stream and update the status badge.

### 5) Handoff back to user (decision diamond)

* Triggered when a human is detected.
* The assistant says a one line intro, then **bridges** the user and mutes.
* The UI flips badge to **Bridged** and the stream continues to log high value moments.

### 6) Live text stream from agent call and user call

* Single scrollable panel that shows time stamped lines from start to finish:

  * menu heard, action pressed, short phrases spoken
  * detected transfer, bridged state, key fields captured
  * final summary
* The baseline from inputs to stream indicates that the stream is the persistent narrative for the call.

### 7) Call history

* When the call ends, a compact card is created in **Call history** with:

  * destination number and goal
  * outcome and duration
  * link to open the full stream transcript

### 8) AI remembers your conversations (Yellowpages)

* A lightweight memory that stores per company IVR paths and phrases that reliably lead to a human.
* Populated from call history and stream extractions.
* This block is consumer facing in name only. All logic lives backstage.

### 9) Database, history, call optimizations (gray box)

* Central store that aggregates:

  * transcripts and extracted fields
  * success paths and failure modes
  * timing stats for each IVR step
* Feeds **VAPI** before each new call so the assistant can skip known branches and go straight to working paths.
* The **red loop** in the diagram represents this memory → database → VAPI feedback cycle.

---

## Event flow summary (what the stream shows)

1. Calling business number
2. Menu detected
3. Pressed 2
4. Waiting 3 s
5. Said "operator"
6. Human detected
7. Bridging you now
8. You are live with a representative
9. Summary and next steps

---

## Data flow summary

* Inputs → metadata for the call
* VAPI events → live stream + status badge
* End of call → call history card + transcript
* History + transcripts → Yellowpages memory
* Memory → database optimizations → VAPI preload for the next call

---

## Success checkpoints

* Inputs validated and Start Call enabled
* Status badge advances through Dialing → Mapping → Bridged
* Handoff fires automatically when human detected
* Stream contains a concise end summary
* History card created and memory updated for future optimizations

---

## Edge cases to show in the stream

* Busy or unreachable number
* Infinite IVR loop detected, switching to operator path
* Business closed announcement
* Voicemail detected, ending call

---

This captures the exact nodes and arrows from the diagram and keeps the same naming: **status badge**, **VAPI**, **HANDOFF back to user**, **stream of text**, **call history**, and **ai remembers your conversations (Yellowpages)** with the feedback loop into **database/history/call optimizations**.
