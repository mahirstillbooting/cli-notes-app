import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const notesList = document.getElementById("notesList");

function formatDate(timestamp) {
  if (!timestamp) {
    return "No date";
  }

  const date = timestamp.toDate();

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderEmptyState() {
  notesList.innerHTML = `
    <p class="empty-state">
      No notes found. Click <strong>Create Note</strong> to write your first note.
    </p>
  `;
}

function renderNotes(notes, userId) {
  notesList.innerHTML = "";

  if (notes.length === 0) {
    renderEmptyState();
    return;
  }

  notes.forEach(function (note) {
    const noteCard = document.createElement("a");
    noteCard.href = `note.html?id=${note.id}`;
    noteCard.className = "note-card";

    const safeTitle = note.title && note.title.trim()
      ? note.title
      : "Untitled Note";

    noteCard.innerHTML = `
      <div class="note-card-title">${escapeHTML(safeTitle)}</div>
      <div class="note-card-meta">
        Last updated: ${formatDate(note.updatedAt)}
      </div>

      <button type="button" class="note-delete-btn" title="Delete note">
        DEL
      </button>
    `;

    const deleteButton = noteCard.querySelector(".note-delete-btn");

    deleteButton.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const confirmed = confirm(`Delete "${safeTitle}"?`);

      if (!confirmed) {
        return;
      }

      try {
        await deleteDoc(doc(db, "users", userId, "notes", note.id));
      } catch (error) {
        alert("Could not delete note: " + error.message);
      }
    });

    notesList.appendChild(noteCard);
  });
}

onAuthStateChanged(auth, function (user) {
  if (!user) {
    return;
  }

  const notesRef = collection(db, "users", user.uid, "notes");

  const notesQuery = query(
    notesRef,
    orderBy("updatedAt", "desc")
  );

  /*
    onSnapshot gives real-time updates.

    This means:
    - new notes appear automatically
    - edited notes move to the top automatically
    - deleted notes disappear automatically

    No manual browser refresh needed.
  */

  onSnapshot(notesQuery, function (snapshot) {
    const notes = [];

    snapshot.forEach(function (docSnap) {
      notes.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    renderNotes(notes, user.uid);
  }, function (error) {
    notesList.innerHTML = `
      <p class="empty-state">
        Could not load notes: ${escapeHTML(error.message)}
      </p>
    `;
  });
});

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}