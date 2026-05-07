# CLI Notes

A lightweight terminal-themed cloud note-taking web app built with HTML, CSS, JavaScript, Firebase Authentication, and Cloud Firestore.

## Features

- Google Authentication
- Private user dashboard
- Cloud-saved notes
- Real-time dashboard updates
- Manual save button
- Delete confirmation
- Download individual notes as `.txt`
- Profile name update
- CLI-inspired dark theme
- JetBrains Mono font

## Tech Stack

- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore

## Security

This project uses Firestore Security Rules so users can only access their own notes.

The real Firebase config file is ignored from GitHub:

```txt
js/firebase-config.js
```

Use this as a template:

```txt
js/firebase-config.example.js
```