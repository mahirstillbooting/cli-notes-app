import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
let noteId = urlParams.get("id");
const mode = urlParams.get("mode");

const noteTitle = document.getElementById("noteTitle");
const noteContent = document.getElementById("noteContent");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const downloadNoteBtn = document.getElementById("downloadNoteBtn");
const noteStatus = document.getElementById("noteStatus");
const noteModeLabel = document.getElementById("noteModeLabel");

let currentUser = null;
let isExistingNote = Boolean(noteId);

function showStatus(message) {
  noteStatus.textContent = message;
}

function setEditorMode() {
  if (mode === "new" || !noteId) {
    noteModeLabel.textContent = "~/notes/editor/new";
    document.title = "CLI Notes | New Note";
  } else {
    noteModeLabel.textContent = "~/notes/editor/edit";
    document.title = "CLI Notes | Edit Note";
  }
}

async function loadExistingNote() {
  if (!currentUser || !noteId) {
    return;
  }

  try {
    showStatus("Loading note...");

    const noteRef = doc(db, "users", currentUser.uid, "notes", noteId);
    const noteSnap = await getDoc(noteRef);

    if (!noteSnap.exists()) {
      showStatus("Note not found.");
      return;
    }

    const noteData = noteSnap.data();

    noteTitle.value = noteData.title || "";
    noteContent.value = noteData.content || "";

    showStatus("Note loaded. Make changes and click Save.");
  } catch (error) {
    showStatus("Could not load note: " + error.message);
  }
}

async function saveNote() {
  if (!currentUser) {
    showStatus("You must be logged in.");
    return;
  }

  const title = noteTitle.value.trim() || "Untitled Note";
  const content = noteContent.value;

  try {
    showStatus("Saving...");

    if (isExistingNote && noteId) {
      const noteRef = doc(db, "users", currentUser.uid, "notes", noteId);

      await setDoc(noteRef, {
        title: title,
        content: content,
        updatedAt: serverTimestamp()
      }, { merge: true });

      showStatus("Saved.");
    } else {
      const notesRef = collection(db, "users", currentUser.uid, "notes");

      const newNoteRef = await addDoc(notesRef, {
        title: title,
        content: content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      noteId = newNoteRef.id;
      isExistingNote = true;

      window.history.replaceState(null, "", `note.html?id=${noteId}`);
      setEditorMode();

      showStatus("Saved.");
    }
  } catch (error) {
    showStatus("Could not save note: " + error.message);
  }
}

function downloadNoteAsTxt() {
  const title = noteTitle.value.trim() || "Untitled Note";
  const content = noteContent.value;

  const safeFileName = title
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .slice(0, 60) || "note";

  const fileText = `${title}\n\n${content}`;
  const blob = new Blob([fileText], { type: "text/plain;charset=utf-8" });

  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = `${safeFileName}.txt`;

  document.body.appendChild(downloadLink);
  downloadLink.click();

  URL.revokeObjectURL(downloadLink.href);
  downloadLink.remove();

  showStatus("Downloaded as .txt.");
}

saveNoteBtn.addEventListener("click", saveNote);
downloadNoteBtn.addEventListener("click", downloadNoteAsTxt);

onAuthStateChanged(auth, async function (user) {
  if (!user) {
    return;
  }

  currentUser = user;
  setEditorMode();

  if (noteId) {
    await loadExistingNote();
  } else {
    showStatus("New note. Write something and click Save.");
  }
});