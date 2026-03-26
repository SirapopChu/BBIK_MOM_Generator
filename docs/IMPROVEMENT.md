# Improvement Roadmap: BBIK MOM Generator
**Version:** 1.2.x → 2.0 Planning  
**Last Updated:** 2026-03-26  
**Prepared by:** Kunanan Wongsing

---

## 1. Overview

This document tracks improvement opportunities, known limitations, and the feedback collected from actual use of the BBIK MOM Generator. The primary focus for **Q2 2026 (April)** is **Prompt-Based Optimization** — improving MOM output quality through systematic refinement of the LLM system prompt without requiring code changes.

---

## 2. Feedback Collection Framework

### 2.1 How to Collect Feedback

Feedback on MOM output quality should be collected via a structured form or a dedicated Slack channel. Each piece of feedback must include:

| Field              | Description                                                 |
|--------------------|-------------------------------------------------------------|
| **Meeting Type**   | e.g., Project Kickoff, Weekly Sync, Steering Committee      |
| **Audio Quality**  | Good / Fair / Poor (background noise, multiple speakers)    |
| **Language Mix**   | Thai only / English only / Mixed                            |
| **Issue Category** | Transcription Error / Missing Action Item / Wrong Summary / Formatting / Other |
| **Example**        | Paste the incorrect paragraph + what it should have said    |
| **Severity**       | Low / Medium / High (does it affect usefulness?)            |

### 2.2 Feedback Log (fill during April 2026 trial)

| Date | Reported By | Meeting Type | Issue Category | Description | Severity | Status |
|------|-------------|--------------|----------------|-------------|----------|--------|
| —    | —           | —            | —              | *(to be filled)* | — | — |

---

## 3. Phase 1: Prompt-Based Optimization (April 2026)

This is the **highest-impact, lowest-cost** improvement available. No infrastructure changes are required — only the system prompt in `Backend/src/services/llm.service.js` (the `SYSTEM_PROMPT` constant) needs to be updated.

### 3.1 Known Prompt Weaknesses (Current v1.2)

| # | Issue | Root Cause | Proposed Fix |
|---|-------|------------|--------------|
| 1 | Action items are missed when mentioned casually in conversation | Prompt relies on explicit markers; Thai casual speech is not caught | Add instruction: *"Identify action items even if stated informally. Look for intent words: 'จะทำ', 'ต้องทำ', 'ให้ไป..', 'will do', 'I'll handle'"* |
| 2 | Meeting participant roles are omitted | Transcript rarely states roles explicitly | Add instruction: *"If roles cannot be confirmed from the transcript, use the provided metadata `participants` field as the authoritative source."* |
| 3 | Long meetings (>1 hour) produce lower-quality summaries | Map-Reduce chunking loses cross-chunk context | Improve `CHUNK_PROMPT` to carry a running summary of previously extracted action items into the next chunk |
| 4 | Discussion section is too verbose for short meetings | Prompt always asks for detailed bullet points | Add conditional: *"If the meeting duration is under 30 minutes, keep each discussion point to 2–3 sentences maximum."* |
| 5 | Thai/English formatting breaks for proper nouns and project names | Model translates names that should not be translated | Add instruction: *"Do NOT translate proper nouns, project names, or technical terms. Keep them as-is in both columns."* |
| 6 | `ไม่ระบุ` overused for inferable info | Prompt too strict on marking missing data | Instruct model to make reasonable inferences for location/date when context is available, and only mark `ไม่ระบุ` when truly unknown |

### 3.2 A/B Testing Strategy

Before pushing a new prompt to production, test it against a baseline:

1. **Prepare a test set:** Collect 5 representative recordings from different meeting types.
2. **Run baseline:** Generate MOM with the current prompt. Save outputs.
3. **Run candidate:** Generate MOM with the proposed new prompt. Save outputs.
4. **Evaluate:** Score each output on 5 criteria (1–5 scale):
   - Completeness of action items
   - Accuracy of participant list
   - Discussion summarization quality
   - Bilingual formatting correctness
   - Overall readability
5. **Decision:** Only deploy the new prompt if the average score improves by ≥ 0.5 points.

### 3.3 Prompt Version History

| Version | Date | Change Summary |
|---------|------|----------------|
| v1.0 | 2026-03-01 | Initial prompt — basic bilingual template |
| v1.1 | 2026-03-15 | Added `[ACTION]` block format enforcement |
| v1.2 | 2026-03-25 | Added `ไม่ระบุ` fallback, professional language style instruction |
| v1.3 | *(April 2026)* | *(Planned — based on feedback from this document)* |

---

## 4. Phase 2: Technical Improvements (Q2–Q3 2026)

### 4.1 Speaker Diarization
- **Problem:** Whisper returns a single block of text with no speaker attribution. MOM quality degrades significantly in multi-speaker meetings.
- **Proposed Solution:** Integrate `pyannote/speaker-diarization` (Python microservice) or the AssemblyAI diarization API as a preprocessing step before passing the transcript to Claude.
- **Impact:** High — will dramatically improve the quality of participant attribution in discussion points.
- **Effort:** High — requires a new Python service or paid API integration.

### 4.2 Meeting Metadata Pre-fill (UI)
- **Problem:** Users often forget to fill in meeting name, location, and participants before recording. The MOM then has many `ไม่ระบุ` fields.
- **Proposed Solution:** Add a mandatory pre-recording form step in `NewMeetingSetup` that blocks recording start until key fields are filled.
- **Impact:** Medium — reduces `ไม่ระบุ` occurrences and improves document quality.
- **Effort:** Low — frontend-only change.

### 4.3 MOM Edit & Review Screen
- **Problem:** There is currently no way to review or correct the generated MOM within the application. Users must edit the downloaded DOCX manually.
- **Proposed Solution:** Add a markdown-based review screen after processing completes, allowing users to edit the MOM text before downloading the final DOCX.
- **Impact:** High — significantly improves user satisfaction and document quality.
- **Effort:** Medium — requires a new frontend page and a DOCX re-generation API endpoint.

### 4.4 Chunk Processing Optimization (Long Meetings)
- **Problem:** The current Map-Reduce strategy for transcripts exceeding `25,000` characters loses cross-chunk context (action items from chunk 1 may not appear in the chunk 2 summary).
- **Proposed Solution:**
  - After each chunk summary, extract only action items into a persistent `running_action_log`.
  - Pass the `running_action_log` into the next chunk's prompt as context.
  - In the final Reduce step, merge all action items explicitly before synthesizing.
- **Impact:** Medium — improves accuracy for meetings > 1 hour.
- **Effort:** Medium — backend change to `llm.service.js`.

### 4.5 Token Cost Monitoring
- **Problem:** There is no visibility into API usage costs per task.
- **Proposed Solution:** Store `usage.input_tokens` and `usage.output_tokens` from every LLM call in the `tasks` table. Add a simple cost dashboard for the admin.
- **Impact:** Low (functional) / High (financial) — prevents surprise billing.
- **Effort:** Low — already captured in logs; just needs persistence and display.

---

## 5. Non-Functional Improvements

### 5.1 HTTPS / TLS
- **Current state:** Application runs on HTTP. TLS is not terminated at the application level.
- **Action:** Configure a reverse proxy (Nginx + Certbot/Let's Encrypt) in front of the Docker stack.

### 5.2 Automated Database Backups
- **Current state:** No backup strategy for the PostgreSQL `postgres_data` Docker volume.
- **Action:** Add a `pg_dump` cron job or use a managed database service (e.g., AWS RDS) for production.

### 5.3 Rate Limiting
- **Current state:** No rate limiting on API endpoints.
- **Action:** Add `express-rate-limit` middleware to `/api/minutes/process-audio` to prevent abuse.

### 5.4 Structured Logging
- **Current state:** `console.log` throughout the backend.
- **Action:** Migrate to `pino` or `winston` for structured JSON logging, making it easier to query logs in production.

---

## 6. Priority Matrix

| Improvement | Impact | Effort | Priority | Target Quarter |
|-------------|--------|--------|----------|----------------|
| Prompt v1.3 (feedback-driven) | High | Low | 🔴 P0 | April 2026 |
| Metadata Pre-fill UI | Medium | Low | 🟠 P1 | April 2026 |
| Token Cost Monitoring | High | Low | 🟠 P1 | April 2026 |
| Chunk Processing Optimization | Medium | Medium | 🟡 P2 | Q2 2026 |
| MOM Edit & Review Screen | High | Medium | 🟡 P2 | Q2 2026 |
| Rate Limiting | High | Low | 🟡 P2 | Q2 2026 |
| HTTPS / TLS Setup | High | Low | 🔴 P0 | Immediate |
| Automated DB Backups | High | Medium | 🟠 P1 | April 2026 |
| Structured Logging | Medium | Medium | 🟢 P3 | Q3 2026 |
| Speaker Diarization | High | High | 🟢 P3 | Q3 2026 |

---

## 7. Prompt Optimization Worksheet (April 2026)

Use this section to draft and discuss prompt changes before testing.

### Current System Prompt (v1.2)
> Located in: `Backend/src/services/llm.service.js` → `SYSTEM_PROMPT` constant.

### Proposed Changes for v1.3

```
[Draft your changes here after collecting feedback]

Example:
- ADD to INSTRUCTIONS section:
  "8. Identify action items even when stated informally in Thai. 
      Look for intent indicators: 'จะทำ', 'ต้องทำ', 'ให้ไป', 'will do', 
      'I'll handle', 'follow up on'. Do NOT miss these."

- ADD to INSTRUCTIONS section:
  "9. Do NOT translate proper nouns, project names, or system names. 
      Keep them verbatim in both Thai and English columns."

- MODIFY instruction 5:
  "Mark truly unknown info as 'ไม่ระบุ'. If the information can be 
   reasonably inferred from context (e.g., today's date implied by 
   'yesterday's meeting'), use the inference and note it in parentheses."
```

---

*This document is a living document. Update the Feedback Log weekly during the April 2026 trial period.*
