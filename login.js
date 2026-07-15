import { auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const loginForm = document.querySelector("#loginForm");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");

function showMessage(message, type = "info") {
  const background =
    type === "success" ? "#dcfce7" :
    type === "error" ? "#fee2e2" :
    "#eef2f6";

  const color =
    type === "success" ? "#15803d" :
    type === "error" ? "#b91c1c" :
    "#111827";

  loginMessage.innerHTML = `
    <div style="
      padding: 14px;
      border-radius: 12px;
      background: ${background};
      color: ${color};
      font-weight: 700;
    ">
      ${message}
    </div>
  `;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;

  loginButton.disabled = true;
  loginButton.textContent = "Logowanie...";

  try {
    await signInWithEmailAndPassword(auth, email, password);

    showMessage(
      "Logowanie zakończone pomyślnie. Konto Firebase działa.",
      "success"
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
      message = "Zbyt wiele prób logowania. Spróbuj ponownie później.";
    }

    showMessage(message, "error");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Zaloguj się";
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  showMessage(
    `Zalogowano jako: ${user.email}`,
    "success"
  );
});
