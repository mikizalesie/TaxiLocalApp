import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const loginForm = document.querySelector("#loginForm");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");

function showMessage(message, type = "info") {
  const background =
    type === "success"
      ? "#dcfce7"
      : type === "error"
        ? "#fee2e2"
        : "#eef2f6";

  const color =
    type === "success"
      ? "#15803d"
      : type === "error"
        ? "#b91c1c"
        : "#111827";

  const messageBox = document.createElement("div");

  messageBox.style.padding = "14px";
  messageBox.style.borderRadius = "12px";
  messageBox.style.background = background;
  messageBox.style.color = color;
  messageBox.style.fontWeight = "700";

  messageBox.textContent = message;

  loginMessage.replaceChildren(messageBox);
}

function getRoleLabel(role) {
  const roleLabels = {
    companyAdmin: "Administrator firmy",
    driver: "Kierowca",
    superAdmin: "Administrator platformy"
  };

  return roleLabels[role] || role;
}

async function loadUserProfile(user) {
  try {
    showMessage("Sprawdzanie uprawnień użytkownika...");

    const userReference = doc(db, "users", user.uid);
    const userSnapshot = await getDoc(userReference);

    if (!userSnapshot.exists()) {
      showMessage(
        "Konto istnieje, ale nie ma profilu w bazie Firestore.",
        "error"
      );
      return;
    }

    const profile = userSnapshot.data();

    if (profile.active !== true) {
      showMessage(
        "Konto użytkownika jest nieaktywne.",
        "error"
      );
      return;
    }

    const roleLabel = getRoleLabel(profile.role);

    showMessage(
      `Zalogowano jako ${profile.displayName}. Rola: ${roleLabel}.`,
      "success"
    );

    loginForm.classList.add("hidden");
logoutButton.classList.remove("hidden");

    console.log("Profil użytkownika:", {
      uid: user.uid,
      role: profile.role,
      companyId: profile.companyId,
      active: profile.active
    });
  } catch (error) {
    console.error("Błąd odczytu profilu:", error);

    showMessage(
      "Zalogowano, ale nie udało się odczytać profilu użytkownika.",
      "error"
    );
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document
    .querySelector("#loginEmail")
    .value
    .trim();

  const password = document
    .querySelector("#loginPassword")
    .value;

  loginButton.disabled = true;
  loginButton.textContent = "Logowanie...";

  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
  } catch (error) {
    console.error("Błąd logowania:", error);

    let message = "Nie udało się zalogować.";

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      message = "Nieprawidłowy adres e-mail lub hasło.";
    }

    if (error.code === "auth/too-many-requests") {
      message =
        "Zbyt wiele prób logowania. Spróbuj ponownie później.";
    }

    showMessage(message, "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Zaloguj się";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    return;
  }

  await loadUserProfile(user);
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);

    loginForm.reset();
    loginForm.classList.remove("hidden");
    logoutButton.classList.add("hidden");

    showMessage("Wylogowano prawidłowo.");
  } catch (error) {
    console.error("Błąd wylogowania:", error);

    showMessage(
      "Nie udało się wylogować użytkownika.",
      "error"
    );
  }
});
