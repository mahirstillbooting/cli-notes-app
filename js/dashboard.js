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
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { debounce, createDelayedLoader } from "./theme.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const notesList = document.getElementById("notesList");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchKbdHint = document.getElementById("searchKbdHint");
const sortSelect = document.getElementById("sortSelect");
const perPageSelect = document.getElementById("perPageSelect");
const categoryStrip = document.getElementById("categoryStrip");
const resultsMeta = document.getElementById("resultsMeta");
const paginationBar = document.getElementById("paginationBar");
const paginationInfo = document.getElementById("paginationInfo");
const paginationControls = document.getElementById("paginationControls");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");

const VALID_CATEGORIES = ["notes", "work", "lists", "ideas"];
const VALID_TITLE_COLORS = ["none", "oxide", "ochre", "sage", "slate", "plum", "clay"];
const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_DELAY_MS = 300;

const state = {
  userId: null,
  allNotes: [],
  loaded: false,
  searchQuery: "",
  activeCategory: "all",
  sortBy: "newest",
  pageSize: 6,
  currentPage: 1
};

const pendingDeleteTimers = new WeakMap();
let unsubscribeNotes = null;

function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeCategory(raw) {
  const value = String(raw || "notes").toLowerCase().trim();
  return VALID_CATEGORIES.includes(value) ? value : "notes";
}

function normalizeTitleColor(raw) {
  const value = String(raw || "none").toLowerCase().trim();
  return VALID_TITLE_COLORS.includes(value) ? value : "none";
}

function getTimestampMillis(timestamp) {
  if (!timestamp) {
    return 0;
  }
  if (typeof timestamp.toMillis === "function") {
    return timestamp.toMillis();
  }
  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().getTime();
  }
  return 0;
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Just now";
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

function countWords(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function renderSkeletonCards(count = 6) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML = `
      <div class="skeleton-top">
        <div class="skeleton-block skeleton-pill"></div>
        <div class="skeleton-block skeleton-icons"></div>
      </div>
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line short"></div>
      <div class="skeleton-block skeleton-foot"></div>
    `;
    fragment.appendChild(card);
  }
  notesList.innerHTML = "";
  notesList.appendChild(fragment);
  paginationBar.hidden = true;
  resultsMeta.textContent = "Loading notes...";
}

const delayedSkeleton = createDelayedLoader(
  () => {
    if (!state.loaded) {
      renderSkeletonCards(state.pageSize);
    }
  },
  () => {},
  SKELETON_DELAY_MS
);

function updateCategoryCounts() {
  const counts = {
    all: state.allNotes.length,
    notes: 0,
    work: 0,
    lists: 0,
    ideas: 0,
    pinned: 0
  };

  for (const note of state.allNotes) {
    const cat = normalizeCategory(note.category);
    counts[cat] = (counts[cat] || 0) + 1;
    if (note.pinned) {
      counts.pinned += 1;
    }
  }

  categoryStrip.querySelectorAll("[data-count]").forEach((el) => {
    const key = el.getAttribute("data-count");
    el.textContent = String(counts[key] ?? 0);
  });
}

function getFilteredAndSortedNotes() {
  const q = state.searchQuery.trim().toLowerCase();

  const filtered = state.allNotes.filter((note) => {
    const cat = normalizeCategory(note.category);

    if (state.activeCategory === "pinned") {
      if (!note.pinned) return false;
    } else if (state.activeCategory !== "all") {
      if (cat !== state.activeCategory) return false;
    }

    if (q) {
      const title = (note.title || "Untitled Note").toLowerCase();
      return title.includes(q);
    }

    return true;
  });

  filtered.sort((a, b) => {
    // Keep pinned notes first
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) {
      return pinDiff;
    }

    const titleA = (a.title || "Untitled Note").toLowerCase();
    const titleB = (b.title || "Untitled Note").toLowerCase();

    if (state.sortBy === "oldest") {
      return getTimestampMillis(a.updatedAt) - getTimestampMillis(b.updatedAt);
    }
    if (state.sortBy === "title-asc") {
      return titleA.localeCompare(titleB);
    }
    if (state.sortBy === "title-desc") {
      return titleB.localeCompare(titleA);
    }
    // newest default
    return getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt);
  });

  return filtered;
}

function buildPageNumbers(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push("...");
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < total - 1) {
    pages.push("...");
  }

  pages.push(total);
  return pages;
}

function renderPagination(totalItems, totalPages, startIdx, endIdx) {
  if (totalItems === 0) {
    paginationBar.hidden = true;
    return;
  }

  paginationBar.hidden = false;
  paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalItems} · Page ${state.currentPage} / ${totalPages}`;
  paginationControls.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "page-btn";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = state.currentPage <= 1;
  prevBtn.addEventListener("click", () => goToPage(state.currentPage - 1));
  paginationControls.appendChild(prevBtn);

  const pages = buildPageNumbers(state.currentPage, totalPages);
  pages.forEach((item) => {
    if (item === "...") {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "...";
      paginationControls.appendChild(span);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `page-btn${item === state.currentPage ? " is-active" : ""}`;
    btn.textContent = String(item);
    btn.setAttribute("aria-label", `Page ${item}`);
    if (item === state.currentPage) {
      btn.setAttribute("aria-current", "page");
    }
    btn.addEventListener("click", () => goToPage(item));
    paginationControls.appendChild(btn);
  });

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "page-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = state.currentPage >= totalPages;
  nextBtn.addEventListener("click", () => goToPage(state.currentPage + 1));
  paginationControls.appendChild(nextBtn);
}

function goToPage(page) {
  state.currentPage = page;
  renderDashboard();
  notesList.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderEmptyState(hasAnyNotes) {
  paginationBar.hidden = true;
  notesList.innerHTML = "";

  const box = document.createElement("div");
  box.className = "empty-box";

  if (!hasAnyNotes) {
    box.innerHTML = `
      <h2 class="empty-box-title">No notes yet.</h2>
      <p class="empty-box-text">
        Your cloud workspace is empty. Create your first note and it will sync automatically.
      </p>
      <a href="note.html?mode=new" class="btn btn-primary">Create First Note</a>
    `;
  } else {
    const queryNote = state.searchQuery
      ? ` matching "${escapeHTML(state.searchQuery)}"`
      : "";
    box.innerHTML = `
      <h2 class="empty-box-title">No matching notes found.</h2>
      <p class="empty-box-text">
        Nothing in this view${queryNote}. Try clearing your search or switching category.
      </p>
      <button type="button" id="resetFiltersBtn" class="btn">Reset Filters</button>
    `;

    box.querySelector("#resetFiltersBtn").addEventListener("click", () => {
      state.searchQuery = "";
      state.activeCategory = "all";
      state.currentPage = 1;
      searchInput.value = "";
      syncSearchClearUI();
      syncCategoryButtons();
      renderDashboard();
    });
  }

  notesList.appendChild(box);
}

function createNoteCard(note) {
  const safeTitle = note.title && note.title.trim() ? note.title.trim() : "Untitled Note";
  const rawContent = String(note.content || "").trim();
  const snippet = rawContent
    ? rawContent.slice(0, 180)
    : "Empty note — click to open editor.";
  const category = normalizeCategory(note.category);
  const titleColor = normalizeTitleColor(note.titleColor);
  const words = countWords(rawContent);
  const isPinned = Boolean(note.pinned);

  const colorMarkerHTML =
    titleColor !== "none"
      ? `<span class="title-color-icon" data-color="${titleColor}" title="Marker: ${titleColor}" aria-hidden="true">
           <svg viewBox="0 0 16 16" fill="currentColor" stroke="var(--border-ink)" stroke-width="1.4">
             <path d="M3 1.5h10v13L8 11.2 3 14.5z"></path>
           </svg>
         </span>`
      : "";

  const card = document.createElement("a");
  card.href = `note.html?id=${encodeURIComponent(note.id)}`;
  card.className = `note-card${isPinned ? " is-pinned" : ""}`;

  card.innerHTML = `
    <div class="note-card-top">
      <span class="note-tag">${escapeHTML(isPinned ? `PIN · ${category}` : category)}</span>
      <div class="note-card-actions">
        <button
          type="button"
          class="card-action-btn${isPinned ? " is-pinned" : ""}"
          data-action="pin"
          aria-label="${isPinned ? "Unpin note" : "Pin note"}"
          title="${isPinned ? "Unpin note" : "Pin note"}"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
            <path d="M12 17v5"></path>
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76z"></path>
          </svg>
        </button>
        <button
          type="button"
          class="card-action-btn is-danger"
          data-action="delete"
          aria-label="Delete ${escapeHTML(safeTitle)}"
          title="Delete note"
        >
          DEL
        </button>
      </div>
    </div>

    <div class="note-card-title-row">
      ${colorMarkerHTML}
      <h2 class="note-card-title">${escapeHTML(safeTitle)}</h2>
    </div>
    <p class="note-card-snippet${rawContent ? "" : " is-empty"}">${escapeHTML(snippet)}</p>

    <div class="note-card-foot">
      <span>${escapeHTML(formatDate(note.updatedAt))} · ${words}w</span>
      <span class="note-card-dot" aria-hidden="true"></span>
    </div>
  `;

  const pinBtn = card.querySelector('[data-action="pin"]');
  pinBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!state.userId) return;
    pinBtn.disabled = true;

    try {
      await updateDoc(doc(db, "users", state.userId, "notes", note.id), {
        pinned: !isPinned
      });
    } catch (error) {
      resultsMeta.textContent = `Pin failed: ${error.message}`;
      pinBtn.disabled = false;
    }
  });

  const deleteBtn = card.querySelector('[data-action="delete"]');
  deleteBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!state.userId) return;

    if (!deleteBtn.classList.contains("is-confirming")) {
      deleteBtn.classList.add("is-confirming");
      deleteBtn.textContent = "OK?";
      deleteBtn.setAttribute("aria-label", `Confirm delete ${safeTitle}`);

      const timer = setTimeout(() => {
        deleteBtn.classList.remove("is-confirming");
        deleteBtn.textContent = "DEL";
        deleteBtn.setAttribute("aria-label", `Delete ${safeTitle}`);
        pendingDeleteTimers.delete(deleteBtn);
      }, 3000);

      pendingDeleteTimers.set(deleteBtn, timer);
      return;
    }

    const existingTimer = pendingDeleteTimers.get(deleteBtn);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingDeleteTimers.delete(deleteBtn);
    }

    deleteBtn.disabled = true;
    deleteBtn.textContent = "...";

    try {
      await deleteDoc(doc(db, "users", state.userId, "notes", note.id));
    } catch (error) {
      resultsMeta.textContent = `Could not delete note: ${error.message}`;
      deleteBtn.disabled = false;
      deleteBtn.classList.remove("is-confirming");
      deleteBtn.textContent = "DEL";
    }
  });

  return card;
}

function renderDashboard() {
  if (!state.loaded) {
    return;
  }

  updateCategoryCounts();

  const filtered = getFilteredAndSortedNotes();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  if (state.searchQuery.trim()) {
    resultsMeta.textContent = `${totalItems} match${totalItems === 1 ? "" : "es"} for "${state.searchQuery.trim()}"`;
  } else {
    resultsMeta.textContent = `${totalItems} note${totalItems === 1 ? "" : "s"}`;
  }

  if (totalItems === 0) {
    renderEmptyState(state.allNotes.length > 0);
    return;
  }

  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, totalItems);
  const pageItems = filtered.slice(startIdx, endIdx);

  const fragment = document.createDocumentFragment();
  pageItems.forEach((note) => {
    fragment.appendChild(createNoteCard(note));
  });

  notesList.innerHTML = "";
  notesList.appendChild(fragment);

  renderPagination(totalItems, totalPages, startIdx, endIdx);
}

function syncSearchClearUI() {
  const hasValue = Boolean(searchInput.value.length);
  clearSearchBtn.hidden = !hasValue;
  if (searchKbdHint) {
    searchKbdHint.hidden = hasValue;
  }
}

function syncCategoryButtons() {
  categoryStrip.querySelectorAll(".filter-pill").forEach((btn) => {
    const active = btn.dataset.category === state.activeCategory;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

/* Debounced title search (250ms wait after typing stops) */
const handleDebouncedSearch = debounce((rawValue) => {
  state.searchQuery = rawValue;
  state.currentPage = 1;
  renderDashboard();
}, SEARCH_DEBOUNCE_MS);

searchInput.addEventListener("input", (event) => {
  syncSearchClearUI();
  handleDebouncedSearch(event.target.value);
});

clearSearchBtn.addEventListener("click", () => {
  handleDebouncedSearch.cancel();
  searchInput.value = "";
  state.searchQuery = "";
  state.currentPage = 1;
  syncSearchClearUI();
  renderDashboard();
  searchInput.focus();
});

window.addEventListener("keydown", (event) => {
  const targetTag = document.activeElement?.tagName;
  const isTyping = targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT";

  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    searchInput.focus();
  } else if (event.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
    clearSearchBtn.click();
  }
});

sortSelect.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  state.currentPage = 1;
  renderDashboard();
});

perPageSelect.addEventListener("change", (event) => {
  const parsed = Number.parseInt(event.target.value, 10);
  state.pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
  state.currentPage = 1;
  renderDashboard();
});

categoryStrip.addEventListener("click", (event) => {
  const btn = event.target.closest(".filter-pill");
  if (!btn) return;

  state.activeCategory = btn.dataset.category || "all";
  state.currentPage = 1;
  syncCategoryButtons();
  renderDashboard();
});

/* Start delayed skeleton timer immediately so slow auth/Firestore loads show skeletons after 300ms */
delayedSkeleton.start();

onAuthStateChanged(auth, (user) => {
  if (unsubscribeNotes) {
    unsubscribeNotes();
    unsubscribeNotes = null;
  }

  if (!user) {
    delayedSkeleton.stop();
    return;
  }

  state.userId = user.uid;
  if (dashboardSubtitle && user.displayName) {
    dashboardSubtitle.textContent = `Signed in as ${user.displayName} · private cloud notes`;
  }

  const notesRef = collection(db, "users", user.uid, "notes");
  const notesQuery = query(notesRef, orderBy("updatedAt", "desc"));

  unsubscribeNotes = onSnapshot(
    notesQuery,
    (snapshot) => {
      const notes = [];
      snapshot.forEach((docSnap) => {
        notes.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      state.allNotes = notes;
      state.loaded = true;
      delayedSkeleton.stop();
      renderDashboard();
    },
    (error) => {
      state.loaded = true;
      delayedSkeleton.stop();
      paginationBar.hidden = true;
      notesList.innerHTML = `
        <div class="empty-box">
          <h2 class="empty-box-title">Could not load notes.</h2>
          <p class="empty-box-text">${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  );
});
