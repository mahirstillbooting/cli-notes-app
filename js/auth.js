import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  linkWithCredential,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const currentPage = window.location.pathname.split("/").pop();
const PROTECTED_PAGES = ["dashboard.html", "note.html", "profile.html"];
const LOGGED_OUT_FLAG = "cli-notes-logged-out";

const loginForm = document.getElementById("loginForm");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const loginStatus = document.getElementById("loginStatus");

const googleSignupBtn = document.getElementById("googleSignupBtn");
const signupForm = document.getElementById("signupForm");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupStatus = document.getElementById("signupStatus");

let googleSignupUser = null;
let signupInProgress = false;

function showStatus(element, message, tone = "") {
  if (element) {
    element.textContent = message;
    element.classList.remove("is-success", "is-error");
    if (tone === "success") {
      element.classList.add("is-success");
    } else if (tone === "error") {
      element.classList.add("is-error");
    }
  }
}

document.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-pw-toggle");
    const input = document.getElementById(targetId);
    if (!input) {
      return;
    }
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "Show" : "Hide";
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
});

function cleanFirebaseError(message) {
  return message
    .replace("Firebase: ", "")
    .replace(/\(auth\/.*\)\.?/g, "")
    .trim();
}

async function createOrUpdateUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const userData = {
    fullName: user.displayName || "Unnamed User",
    email: user.email || "",
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp()
  };

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp()
    });
  } else {
    await setDoc(userRef, userData, { merge: true });
  }
}

/* LOGIN PAGE */

async function handleEmailLogin() {
  if (!loginForm) {
    return;
  }

  if (!loginForm.reportValidity()) {
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
    }
    showStatus(loginStatus, "Signing in...");

    await signInWithEmailAndPassword(auth, email, password);

    sessionStorage.removeItem(LOGGED_OUT_FLAG);
    showStatus(loginStatus, "Login successful. Redirecting...", "success");
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Email login error code:", error.code);
    console.error("Email login error message:", error.message);
    showStatus(loginStatus, cleanFirebaseError(error.message), "error");
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
    }
  }
}

if (loginForm) {
  // Prevent browser autofill or implicit form submission from logging in automatically.
  // Login only runs when the user explicitly clicks the Sign In button.
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
  });
}

if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener("click", function (event) {
    if (!event.isTrusted) {
      return;
    }
    handleEmailLogin();
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async function () {
    try {
      showStatus(loginStatus, "Opening Google login...");

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);

        showStatus(
          loginStatus,
          "No account found. Please use the Signup page first.",
          "error"
        );

        return;
      }

      sessionStorage.removeItem(LOGGED_OUT_FLAG);
      showStatus(loginStatus, "Login successful. Redirecting...", "success");
      window.location.replace("dashboard.html");
    } catch (error) {
      console.error("Google login error code:", error.code);
      console.error("Google login error message:", error.message);
      showStatus(loginStatus, cleanFirebaseError(error.message), "error");
    }
  });
}

/* SIGNUP PAGE */

if (googleSignupBtn) {
  googleSignupBtn.addEventListener("click", async function () {
    try {
      signupInProgress = true;

      showStatus(signupStatus, "Opening Google signup...");

      const result = await signInWithPopup(auth, googleProvider);
      googleSignupUser = result.user;

      signupName.value = googleSignupUser.displayName || "";
      signupEmail.value = googleSignupUser.email || "";

      showStatus(signupStatus, "Google account connected. Now set a password.");
    } catch (error) {
      console.error("Google signup error code:", error.code);
      console.error("Google signup error message:", error.message);
      showStatus(signupStatus, cleanFirebaseError(error.message));
    }
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fullName = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;

    if (!googleSignupUser || !email) {
      showStatus(signupStatus, "Please continue with Google first.");
      return;
    }

    if (!fullName) {
      showStatus(signupStatus, "Full name cannot be empty.");
      return;
    }

    if (password.length < 6) {
      showStatus(signupStatus, "Password must be at least 6 characters.");
      return;
    }

    try {
      signupInProgress = true;

      showStatus(signupStatus, "Linking password to your Google account...");

      const credential = EmailAuthProvider.credential(email, password);

      await linkWithCredential(googleSignupUser, credential);

      await updateProfile(googleSignupUser, {
        displayName: fullName
      });

      await createOrUpdateUserDocument({
        ...googleSignupUser,
        displayName: fullName
      });

      signupInProgress = false;

      showStatus(signupStatus, "Signup complete. Redirecting...");
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Signup error code:", error.code);
      console.error("Signup error message:", error.message);

      if (error.code === "auth/provider-already-linked") {
        await updateProfile(googleSignupUser, {
          displayName: fullName
        });

        await createOrUpdateUserDocument({
          ...googleSignupUser,
          displayName: fullName
        });

        signupInProgress = false;

        showStatus(signupStatus, "Account already linked. Redirecting...");
        window.location.href = "dashboard.html";
        return;
      }

      if (error.code === "auth/email-already-in-use") {
        showStatus(
          signupStatus,
          "This email already has an account. Please login instead."
        );
        return;
      }

      if (error.code === "auth/credential-already-in-use") {
        showStatus(
          signupStatus,
          "This password login is already linked to another account."
        );
        return;
      }

      if (error.code === "auth/requires-recent-login") {
        showStatus(
          signupStatus,
          "Please refresh the page and continue with Google again."
        );
        return;
      }

      showStatus(signupStatus, cleanFirebaseError(error.message));
    }
  });
}

/* REDIRECT LOGIC & MOBILE BACK-BUTTON (BFCACHE) PROTECTION */

function redirectToLoginClean() {
  document.documentElement.style.visibility = "hidden";
  sessionStorage.removeItem("cli-notes-user-name");
  const sensitiveIds = ["notesList", "noteTitle", "noteContent", "profileName", "profileEmail"];
  sensitiveIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) {
      el.value = "";
    } else {
      el.innerHTML = "";
    }
  });
  window.location.replace("index.html");
}

onAuthStateChanged(auth, function (user) {
  if (currentPage === "signup.html" && signupInProgress) {
    return;
  }

  if (user) {
    sessionStorage.removeItem(LOGGED_OUT_FLAG);
    if (currentPage === "index.html" || currentPage === "") {
      window.location.replace("dashboard.html");
    }
    return;
  }

  if (PROTECTED_PAGES.includes(currentPage)) {
    redirectToLoginClean();
  }
});

window.addEventListener("pageshow", async function (event) {
  if (!PROTECTED_PAGES.includes(currentPage)) {
    return;
  }

  if (sessionStorage.getItem(LOGGED_OUT_FLAG) === "1") {
    redirectToLoginClean();
    return;
  }

  if (event.persisted) {
    await auth.authStateReady();
    if (!auth.currentUser) {
      redirectToLoginClean();
    }
  }
});

/* LOGOUT HELPER WITH CONFIRMATION MODAL */

function getOrCreateLogoutDialog() {
  let dialog = document.getElementById("logoutDialog");
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.id = "logoutDialog";
  dialog.className = "confirm-dialog";
  dialog.setAttribute("aria-labelledby", "logoutDialogTitle");
  dialog.setAttribute("aria-describedby", "logoutDialogDesc");

  dialog.innerHTML = `
    <div class="confirm-dialog-bar">
      <span class="confirm-dialog-path">~/session/logout</span>
      <button type="button" class="dialog-close-btn" data-logout-close aria-label="Close logout confirmation">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">
          <line x1="3" y1="3" x2="13" y2="13"></line>
          <line x1="13" y1="3" x2="3" y2="13"></line>
        </svg>
      </button>
    </div>

    <div class="confirm-dialog-body">
      <div class="confirm-dialog-content">
        <svg class="cute-exit-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
          <path d="M14 5H6v22h8"></path>
          <g class="exit-arrow">
            <polyline points="20 11 26 16 20 21"></polyline>
            <line x1="25" y1="16" x2="12" y2="16"></line>
          </g>
        </svg>

        <div class="confirm-dialog-copy">
          <h2 id="logoutDialogTitle" class="confirm-dialog-title">Sign out now?</h2>
          <p id="logoutDialogDesc" class="confirm-dialog-text">
            You will end this session and return to the login screen.
          </p>
          <p class="confirm-dialog-hint">Your saved notes stay safely synced in the cloud.</p>
        </div>
      </div>

      <p class="status-message is-error" data-logout-error role="alert" hidden></p>

      <div class="confirm-dialog-actions">
        <button type="button" class="btn" data-logout-cancel>Stay</button>
        <button type="button" class="btn btn-danger-solid" data-logout-confirm>Sign Out</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const cancelBtn = dialog.querySelector("[data-logout-cancel]");
  const closeBtn = dialog.querySelector("[data-logout-close]");
  const confirmBtn = dialog.querySelector("[data-logout-confirm]");
  const errorEl = dialog.querySelector("[data-logout-error]");

  function closeModal() {
    if (dialog.open) {
      dialog.close();
    }
  }

  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeModal();
    }
  });

  confirmBtn.addEventListener("click", async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "Signing out...";
    errorEl.hidden = true;

    try {
      sessionStorage.setItem(LOGGED_OUT_FLAG, "1");
      await signOut(auth);
      closeModal();
      redirectToLoginClean();
    } catch (error) {
      sessionStorage.removeItem(LOGGED_OUT_FLAG);
      errorEl.textContent = `Could not sign out: ${cleanFirebaseError(error.message)}`;
      errorEl.hidden = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = "Sign Out";
    }
  });

  return dialog;
}

window.logoutUser = function () {
  const dialog = getOrCreateLogoutDialog();
  const cancelBtn = dialog.querySelector("[data-logout-cancel]");
  const confirmBtn = dialog.querySelector("[data-logout-confirm]");
  const errorEl = dialog.querySelector("[data-logout-error]");

  errorEl.hidden = true;
  errorEl.textContent = "";
  confirmBtn.disabled = false;
  cancelBtn.disabled = false;
  confirmBtn.textContent = "Sign Out";

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    cancelBtn.focus();
  } else if (window.confirm("Sign out of CLI Notes? Your saved notes stay safe in the cloud.")) {
    sessionStorage.setItem(LOGGED_OUT_FLAG, "1");
    signOut(auth).then(() => {
      redirectToLoginClean();
    });
  }
};