# Architecture: Frontend — BBIK MOM Generator

**Framework:** Next.js 16 (App Router) + React 19 + TypeScript
**Styling:** Tailwind CSS v4 (Modern CSS-first architecture)
**Fonts:** Noto Sans Thai (Primary Thai font) + Prompt (Secondary font)
**State Management:** React Context API

---

## 1. Core Principles
The frontend is designed for **High-Performance Media Handling** and **Bilingual Accessibility (TH/EN)**. It minimizes server load by performing heavy audio operations (mixing and compression) on the client side using the Web Audio API and WebAssembly.

---

## 2. Component Hierarchy & Layouts
- **`app/layout.tsx` (Root):** 
    - Injects `AuthProvider` for session management.
    - Loads `Noto Sans Thai` and `Prompt` via `next/font`.
    - Defines global CSS variables for typography (`--font-noto-th`, `--font-prompt`).
- **`app/dashboard/layout.tsx`:** 
    - Wraps children in a `DashboardLayout` component.
    - Implements route protection logic (redirects to `/` if no JWT is found).
- **`DashboardLayout.tsx`:**
    - Provides a persistent sidebar and footer.
    - Manages the mobile overlay state and responsive navigation.

---

## 3. Media Processing Pipeline (Client-Side)

### 3.1 Audio Capture & Mixing (`useAudioRecorder.ts`)
The recording engine uses a professional `AudioContext` node graph to combine multiple sources into a single track:
1. **Inputs:** `micSource` (from `getUserMedia`) and `systemSource` (from `getDisplayMedia`).
2. **Mixing:** Both sources connect to a `MediaStreamAudioDestinationNode`.
3. **Hot-Swapping:** When a user changes the microphone device:
    - The hook calls `getUserMedia` for the new ID.
    - It disconnects the old `micSource` from the `destination`.
    - It connects the new `micSource` to the existing `destination`.
    - This allows for seamless mic switching without pausing the `MediaRecorder`.

### 3.2 Client-Side Compression (`useCompressedUpload.ts`)
To handle meetings > 1 hour, we use **FFmpeg.WASM**:
- **Triggers:** After the user stops recording and confirms the file name.
- **Workflow:** 
    1. The raw `.webm` / `.wav` data is written to the FFmpeg virtual filesystem.
    2. FFmpeg executes a conversion to `.mp3` with variable bitrate.
    3. The compressed blob is returned for upload, typically reducing file size by 80-90% compared to raw PCM.

---

## 4. Internationalization (i18n)
- **Architecture:** Dictionary-based matching using `dicts/en.ts` and `dicts/th.ts`.
- **Implementation:** The `MeetingRecord` component (and others) uses the `dict` object fetched from the context to render strings.
- **Support:** 100% Thai support across all tooltips, labels, and success/error notifications.

---

## 5. Design System (Tailwind v4)
We leverage the **modern CSS-first configuration** of Tailwind v4:
- **`@theme inline`**: Custom colors and fonts are defined directly in `globals.css`.
- **Custom Classes:** Standardizes "Card", "Badge", and "Button" styles across `MeetingRecord.module.css` and `NewMeetingSetup.module.css` to maintain BBIK brand consistency.

---

## 6. Authentication & Persistence
- **Auth Provider:** Stores JWT and user metadata.
- **Token Shielding:** All API calls are routed through a `services/api.ts` facade that injects the Authorization header automatically.
- **Client Persistence:** Securely stores session tokens in HttpOnly-lite cookies (`js-cookie`).

---
**Document updated on 2026-03-25 by Kunanan Wongsing*
