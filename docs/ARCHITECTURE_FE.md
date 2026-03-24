# Architecture: Frontend — BBIK MOM Generator

**Framework:** Next.js 16 (App Router) + React 19 + TypeScript
**Styling:** Tailwind CSS v4 (Modern CSS-first architecture)
**Fonts:** Noto Sans Thai (Primary Thai) + Prompt (Clean English/Thai)
**State Management:** React Context API

---

## 1. Application Core
- **Next.js Root Layout:** Located in `app/layout.tsx`, wraps the app in the `AuthProvider`.
- **Dashboard Layout:** Located in `app/dashboard/layout.tsx`, includes the `LanguageProvider` and a redirection guard for unauthenticated users.

---

## 2. Authentication Flow
- **`AuthContext.tsx`**: Manages user login/register state, token persistence via `js-cookie`, and session status.
- **`api.ts` (Facade):** Automatically attaches the Bearer token to all outgoing requests.
- **Premium UI:** Glassmorphic Login and Register pages using tailwind-compatible CSS for a high-end feel.

---

## 3. Internationalization (i18n)
- **Dictionaries:** `dicts/en.ts` and `dicts/th.ts` provide 100% parity across all UI strings.
- **Consumer:** Every component uses the `useI18n` hook to access localized content.

---

## 4. Professional Recording Dashboard
The `MeetingRecord.tsx` component is the most complex frontend module. It leverages several specialized hooks:
- **`useAudioRecorder.ts`**: Orchestrates `AudioContext` to mix system and mic streams. It supports "hot-swapping" the mic during tracking by rebuilding the source node chains.
- **`useCompressedUpload.ts`**: Implements FFmpeg WASM for client-side audio compression to reduce server load.
- **`useTranscription.ts`**: Handles audio upload and the subsequent real-time polling flow.

---

## 5. Design System
The frontend follows a "Premium Blue" palette:
- **Primary:** indigo-600 / blue-600
- **Background:** slate-900 / slate-950
- **Accent:** glassmorphic borders and blur effects.

---

## 6. Next Steps for Frontend
Refer to the **[Task Roadmap](file:///Users/khempz/.gemini/antigravity/brain/721904e5-f7c5-4be8-b94d-17b2abf264cf/task.md)** for details on UI template customization and role-based dashboard views.
