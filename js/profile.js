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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const profileForm = document.getElementById("profileForm");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileStatus = document.getElementById("profileStatus");

let currentUser = null;

function showStatus(message) {
  profileStatus.textContent = message;
}

async function loadProfile(user) {
  currentUser = user;

  profileEmail.value = user.email || "";
  profileName.value = user.displayName || "";

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      profileName.value = userData.fullName || user.displayName || "";
    }
  } catch (error) {
    showStatus("Could not load profile: " + error.message);
  }
}

profileForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!currentUser) {
    showStatus("You must be logged in.");
    return;
  }

  const newName = profileName.value.trim();

  if (!newName) {
    showStatus("Name cannot be empty.");
    return;
  }

  try {
    showStatus("Saving profile...");

    await updateProfile(currentUser, {
      displayName: newName
    });

    const userRef = doc(db, "users", currentUser.uid);

    await setDoc(userRef, {
      fullName: newName,
      email: currentUser.email || "",
      photoURL: currentUser.photoURL || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    showStatus("Profile saved.");
  } catch (error) {
    showStatus("Could not save profile: " + error.message);
  }
});

onAuthStateChanged(auth, function (user) {
  if (!user) {
    return;
  }

  loadProfile(user);
});