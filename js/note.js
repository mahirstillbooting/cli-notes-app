import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

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
import { createDelayedLoader } from "./theme.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
let noteId = urlParams.get("id");
const mode = urlParams.get("mode");

const noteTitle = document.getElementById("noteTitle");
const noteContent = document.getElementById("noteContent");
const noteCategory = document.getElementById("noteCategory");
const pinNoteBtn = document.getElementById("pinNoteBtn");
const pinNoteLabel = document.getElementById("pinNoteLabel");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const downloadNoteBtn = document.getElementById("downloadNoteBtn");
const copyNoteBtn = document.getElementById("copyNoteBtn");
const noteStatus = document.getElementById("noteStatus");
const noteModeLabel = document.getElementById("noteModeLabel");
const editorHeading = document.getElementById("editorHeading");
const editorCrumb = document.getElementById("editorCrumb");
const editorStats = document.getElementById("editorStats");
const saveBadge = document.getElementById("saveBadge");
const saveBadgeText = document.getElementById("saveBadgeText");
const editorSkeleton = document.getElementById("editorSkeleton");
const editorShell = document.getElementById("editorShell");
const titleColorPicker = document.getElementById("titleColorPicker");
const editorTitleColorIcon = document.getElementById("editorTitleColorIcon");

const VALID_CATEGORIES = ["notes", "work", "lists", "ideas"];
const VALID_TITLE_COLORS = ["none", "oxide", "ochre", "sage", "slate", "plum", "clay"];

let currentUser = null;
let isExistingNote = Boolean(noteId);
let isPinned = false;
let titleColor = "none";
let isDirty = false;
let isSaving = false;

const delayedEditorSkeleton = createDelayedLoader(
  () => {
    editorShell.hidden = true;
    editorSkeleton.hidden = false;
  },
  () => {
    editorSkeleton.hidden = true;
    editorShell.hidden = false;
  },
  300
);

function hideEditorSkeleton() {
  delayedEditorSkeleton.stop();
  editorSkeleton.hidden = true;
  editorShell.hidden = false;
}

function normalizeTitleColor(raw) {
  const value = String(raw || "none").toLowerCase().trim();
  return VALID_TITLE_COLORS.includes(value) ? value : "none";
}

function syncTitleColorUI() {
  const active = normalizeTitleColor(titleColor);
  titleColor = active;

  if (editorTitleColorIcon) {
    editorTitleColorIcon.dataset.color = active;
    editorTitleColorIcon.hidden = active === "none";
  }

  if (titleColorPicker) {
    titleColorPicker.querySelectorAll(".color-swatch-btn").forEach((btn) => {
      const isSelected = btn.dataset.color === active;
      btn.setAttribute("aria-checked", String(isSelected));
    });
  }
}

function showStatus(message, tone = "") {
  noteStatus.textContent = message;
  noteStatus.classList.remove("is-success", "is-error");
  if (tone === "success") {
    noteStatus.classList.add("is-success");
  } else if (tone === "error") {
    noteStatus.classList.add("is-error");
  }
}

function setDirty(dirty) {
  isDirty = dirty;
  saveBadge.classList.toggle("is-dirty", dirty);
  saveBadgeText.textContent = dirty ? "Unsaved · Ctrl+S" : "Saved · Ctrl+S";
}

function syncPinUI() {
  pinNoteBtn.setAttribute("aria-pressed", String(isPinned));
  pinNoteLabel.textContent = isPinned ? "Pinned" : "Pin";
}

function updateStats() {
  const text = noteContent.value;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const lines = text ? text.split(/\r\n|\r|\n/).length : 1;

  editorStats.innerHTML = `
    <span>${words} word${words === 1 ? "" : "s"}</span>
    <span>${chars} char${chars === 1 ? "" : "s"}</span>
    <span>${lines} line${lines === 1 ? "" : "s"}</span>
  `;
}

function setEditorMode() {
  if (mode === "new" || !noteId) {
    noteModeLabel.textContent = "~/notes/editor/new";
    editorHeading.textContent = "New Note";
    editorCrumb.textContent = "new";
    document.title = "CLI Notes | New Note";
  } else {
    noteModeLabel.textContent = "~/notes/editor/edit";
    editorHeading.textContent = "Edit Note";
    editorCrumb.textContent = "edit";
    document.title = "CLI Notes | Edit Note";
  }
}

async function loadExistingNote() {
  if (!currentUser || !noteId) {
    hideEditorSkeleton();
    return;
  }

  try {
    const noteRef = doc(db, "users", currentUser.uid, "notes", noteId);
    const noteSnap = await getDoc(noteRef);

    hideEditorSkeleton();

    if (!noteSnap.exists()) {
      showStatus("Note not found.", "error");
      return;
    }

    const noteData = noteSnap.data();

    noteTitle.value = noteData.title || "";
    noteContent.value = noteData.content || "";
    const cat = String(noteData.category || "notes").toLowerCase();
    noteCategory.value = VALID_CATEGORIES.includes(cat) ? cat : "notes";
    isPinned = Boolean(noteData.pinned);
    titleColor = normalizeTitleColor(noteData.titleColor);
    syncPinUI();
    syncTitleColorUI();
    updateStats();
    setDirty(false);

    showStatus("Note loaded.", "success");
  } catch (error) {
    hideEditorSkeleton();
    showStatus("Could not load note: " + error.message, "error");
  }
}

async function saveNote() {
  if (!currentUser) {
    showStatus("You must be logged in.", "error");
    return;
  }
  if (isSaving) {
    return;
  }

  const title = noteTitle.value.trim() || "Untitled Note";
  const content = noteContent.value;
  const category = VALID_CATEGORIES.includes(noteCategory.value)
    ? noteCategory.value
    : "notes";
  const colorMarker = normalizeTitleColor(titleColor);

  isSaving = true;
  saveNoteBtn.disabled = true;
  showStatus("Saving...");

  try {
    if (isExistingNote && noteId) {
      const noteRef = doc(db, "users", currentUser.uid, "notes", noteId);

      await setDoc(
        noteRef,
        {
          title,
          content,
          category,
          pinned: isPinned,
          titleColor: colorMarker,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } else {
      const notesRef = collection(db, "users", currentUser.uid, "notes");

      const newNoteRef = await addDoc(notesRef, {
        title,
        content,
        category,
        pinned: isPinned,
        titleColor: colorMarker,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      noteId = newNoteRef.id;
      isExistingNote = true;

      window.history.replaceState(null, "", `note.html?id=${encodeURIComponent(noteId)}`);
      setEditorMode();
    }

    setDirty(false);
    showStatus("Saved to cloud.", "success");
  } catch (error) {
    showStatus("Could not save note: " + error.message, "error");
  } finally {
    isSaving = false;
    saveNoteBtn.disabled = false;
  }
}

async function copyNoteToClipboard() {
  const title = noteTitle.value.trim() || "Untitled Note";
  const content = noteContent.value;
  const combined = content ? `${title}\n\n${content}` : title;

  try {
    await navigator.clipboard.writeText(combined);
    showStatus("Copied note to clipboard.", "success");
  } catch {
    showStatus("Clipboard copy blocked by browser.", "error");
  }
}

function downloadNoteAsTxt() {
  const title = noteTitle.value.trim() || "Untitled Note";
  const content = noteContent.value;

  const safeFileName =
    title
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

  showStatus("Downloaded as .txt.", "success");
}

noteTitle.addEventListener("input", () => setDirty(true));
noteContent.addEventListener("input", () => {
  updateStats();
  setDirty(true);
});
noteCategory.addEventListener("change", () => setDirty(true));

pinNoteBtn.addEventListener("click", () => {
  isPinned = !isPinned;
  syncPinUI();
  setDirty(true);
});

if (titleColorPicker) {
  titleColorPicker.addEventListener("click", (event) => {
    const swatch = event.target.closest(".color-swatch-btn");
    if (!swatch) return;
    titleColor = normalizeTitleColor(swatch.dataset.color);
    syncTitleColorUI();
    setDirty(true);
  });
}

saveNoteBtn.addEventListener("click", saveNote);
copyNoteBtn.addEventListener("click", copyNoteToClipboard);
downloadNoteBtn.addEventListener("click", downloadNoteAsTxt);

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNote();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (isDirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

setEditorMode();
syncPinUI();
syncTitleColorUI();
updateStats();
hideEditorSkeleton();

if (noteId) {
  delayedEditorSkeleton.start();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    hideEditorSkeleton();
    return;
  }

  currentUser = user;
  setEditorMode();

  if (noteId) {
    await loadExistingNote();
  } else {
    hideEditorSkeleton();
    setDirty(false);
    showStatus("Ready. Press Ctrl+S or click Save anytime.");
  }
});
