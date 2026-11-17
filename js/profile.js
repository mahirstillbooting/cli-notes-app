import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { createDelayedLoader } from "./theme.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const profileForm = document.getElementById("profileForm");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileStatus = document.getElementById("profileStatus");
const profileAvatar = document.getElementById("profileAvatar");
const profileBannerName = document.getElementById("profileBannerName");
const profileBannerEmail = document.getElementById("profileBannerEmail");
const profileBanner = document.getElementById("profileBanner");
const profileSkeleton = document.getElementById("profileSkeleton");

let currentUser = null;

const delayedProfileSkeleton = createDelayedLoader(
  () => {
    profileBanner.hidden = true;
    profileSkeleton.hidden = false;
  },
  () => {
    profileSkeleton.hidden = true;
    profileBanner.hidden = false;
  },
  300
);

function showStatus(message, tone = "") {
  profileStatus.textContent = message;
  profileStatus.classList.remove("is-success", "is-error");
  if (tone === "success") {
    profileStatus.classList.add("is-success");
  } else if (tone === "error") {
    profileStatus.classList.add("is-error");
  }
}

function updateBanner(name, email) {
  const displayName = (name || "User").trim();
  const displayEmail = (email || "").trim();
  profileBannerName.textContent = displayName;
  profileBannerEmail.textContent = displayEmail;
  profileAvatar.textContent = displayName.charAt(0).toUpperCase() || "U";
}

async function loadProfile(user) {
  currentUser = user;
  delayedProfileSkeleton.start();

  const initialName = user.displayName || "";
  const email = user.email || "";

  profileEmail.value = email;
  profileName.value = initialName;
  updateBanner(initialName, email);

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const resolvedName = userData.fullName || user.displayName || "";
      profileName.value = resolvedName;
      updateBanner(resolvedName, email);
    }
  } catch (error) {
    showStatus("Could not load profile: " + error.message, "error");
  } finally {
    delayedProfileSkeleton.stop();
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    showStatus("You must be logged in.", "error");
    return;
  }

  const newName = profileName.value.trim();

  if (!newName) {
    showStatus("Name cannot be empty.", "error");
    return;
  }

  try {
    showStatus("Saving profile...");

    await updateProfile(currentUser, {
      displayName: newName
    });

    const userRef = doc(db, "users", currentUser.uid);

    await setDoc(
      userRef,
      {
        fullName: newName,
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    updateBanner(newName, currentUser.email || "");
    showStatus("Profile saved.", "success");
  } catch (error) {
    showStatus("Could not save profile: " + error.message, "error");
  }
});

delayedProfileSkeleton.start();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    delayedProfileSkeleton.stop();
    return;
  }

  loadProfile(user);
});
