# CLI Notes

**Live App:** [https://mahirstillbooting.github.io/cli-notes-app/](https://mahirstillbooting.github.io/cli-notes-app/)

A lightweight, terminal-inspired cloud note-taking web app blending **CLI minimalism** with **muted Neo-Brutalist UI**, built with plain HTML, CSS, vanilla JavaScript, Firebase Authentication, and Cloud Firestore.

## Features

- **Muted Light & Dark Themes** — One-click theme toggle (`Alt+T`) persisted in `localStorage` with zero flash on load
- **Terminal × Neo-Brutalist UI** — Crisp ink borders, tactile offset shadows, subtle dot-matrix texture, and mobile-first performance (zero frameworks or heavy blur effects)
- **Authentication** — Google Sign-In and Email/Password login via Firebase Auth
- **Debounced Title Search** — Waits 250ms after typing stops before running the search (`/` shortcut to focus, `Esc` to clear)
- **Pagination** — Client-side pagination (`6 / 12 / 24` notes per page) with Prev/Next and numbered page controls
- **Delayed Skeleton Loader** — Subtle CSS opacity-pulse skeletons appear only when an async load takes longer than `300ms`
- **Categories, Pinning & Title Color Markers** — Organize notes into `Notes`, `Work`, `Lists`, or `Ideas`, pin important notes to the top, and tag note titles with preset muted color bookmark icons (`Oxide`, `Ochre`, `Sage`, `Slate`, `Plum`, `Clay`) for quick visual recall
- **Real-Time Cloud Sync** — Live updates via Cloud Firestore `onSnapshot`
- **Note Editor Utilities** — Live word/character/line counter, `Ctrl+S` save shortcut, clipboard copy, and `.txt` export
- **Two-Step Inline Delete** — Safe mobile-friendly delete (`DEL` → `OK?`) without browser popups
- **Profile Management** — Update your display name synced to Firebase Auth & Firestore

## Tech Stack

- HTML5
- CSS3 (Custom Properties, Grid, Flexbox — zero build step)
- Vanilla JavaScript (ES Modules)
- Firebase Authentication & Cloud Firestore

## Preview Locally

Because this app uses ES Modules (`type="module"`), serve it over `localhost` instead of opening HTML files directly via `file://`:

```bash
python -m http.server 5500
```

Then open [http://localhost:5500](http://localhost:5500) in your browser.

> **Note:** Make sure `localhost` and your deployment domain (e.g. `mahirstillbooting.github.io`) are added under **Firebase Console → Authentication → Settings → Authorized domains**.

## Firebase Configuration

Use `js/firebase-config.example.js` as a template for `js/firebase-config.js` and configure Firestore Security Rules so each signed-in user can only access their own documents under `/users/{userId}` and `/users/{userId}/notes/{noteId}`.
