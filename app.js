import { auth, db } from "./firebase-config.js";

console.log("Firebase połączony:", auth.app.options.projectId);

(() => {
  "use strict";

  const STORAGE_KEY = "taxiWhiteLabelPwaStateV1";
  const STATUS_LABELS = {
    pending: "Oczekuje",
    accepted: "Zaakceptowany",
    on_way: "Kierowca w drodze",
    arrived: "Kierowca na miejscu",
    in_progress: "Kurs trwa",
    completed: "Zakończony",
    cancelled: "Anulowany"
  };

  const DEFAULT_STATE = {
    version: 1,
    company: {
      id: "taxi-andrzej-pelka",
      name: "Taxi Andrzej Pełka",
      slogan: "Taxi Tomaszów Mazowiecki i okolice",
      phone: "+48 500 000 000",
      serviceArea: "Tomaszów Mazowiecki i okolice",
      slug: "andrzej-pelka",
      primaryColor: "#f5c400"
    },
    drivers: [
      { id: "drv-andrzej", name: "Andrzej Pełka", phone: "+48 500 000 001", active: true, available: false, activeVehicleId: "veh-mercedes" },
      { id: "drv-piotr", name: "Kierowca 2", phone: "+48 500 000 002", active: true, available: false, activeVehicleId: "veh-toyota" }
    ],
    vehicles: [
      { id: "veh-mercedes", label: "Biały Mercedes", registration: "ETM 00001", active: true },
      { id: "veh-toyota", label: "Toyota", registration: "ETM 00002", active: true }
    ],
    bookings: [],
    notifications: [],
    ui: {
      selectedDriverId: "drv-andrzej"
    }
  };

  let state = loadState();
  let deferredInstallPrompt = null;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      return { ...cloneDefaultState(), ...parsed };
    } catch (error) {
      console.error("Nie udało się odczytać danych:", error);
      return cloneDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("taxi-state-changed"));
  }

  function normalizePhone(phone = "") {
    return phone.replace(/\D/g, "");
  }

  function safeText(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  function id(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function bookingCode() {
    return `TAP-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  function formatDateTime(iso) {
    if (!iso) return "Jak najszybciej";
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  }

  function scheduledIsoFromForm(formData) {
    if (formData.get("bookingType") !== "scheduled") return new Date().toISOString();
    const date = formData.get("scheduledDate");
    const time = formData.get("scheduledTime");
    if (!date || !time) throw new Error("Wybierz datę i godzinę rezerwacji.");
    const scheduled = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduled.getTime())) throw new Error("Nieprawidłowa data rezerwacji.");
    if (scheduled.getTime() < Date.now() + 5 * 60 * 1000) {
      throw new Error("Rezerwacja musi być co najmniej 5 minut w przyszłości.");
    }
    return scheduled.toISOString();
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    $("#toastContainer").appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
  }

  function applyBranding() {
    const company = state.company;
    document.documentElement.style.setProperty("--primary", company.primaryColor || "#f5c400");
    document.title = company.name;
    $("#companyNameHeader").textContent = company.name;
    $("#companySloganHeader").textContent = company.slogan;
    $("#heroTitle").textContent = `Zamów taxi: ${company.serviceArea}`;
    $("#heroDescription").textContent = "Wyślij zgłoszenie. Pierwszy dostępny kierowca potwierdzi kurs.";
    $("#callNowBtn").href = `tel:${normalizePhone(company.phone)}`;
  }

  function setView(viewId) {
    $$(".view").forEach(view => view.classList.toggle("active-view", view.id === viewId));
    $$(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewId));
    if (viewId === "driverView") renderDriverPanel();
    if (viewId === "companyView") renderCompanyPanel();
  }

  function updateConnectionBadge() {
    const online = navigator.onLine;
    const badge = $("#connectionBadge");
    badge.textContent = online ? "Online" : "Offline";
    badge.classList.toggle("offline", !online);
  }

  function bookingStatusHtml(status) {
    return `<span class="status-chip ${safeText(status)}">${safeText(STATUS_LABELS[status] || status)}</span>`;
  }

  function bookingRouteHtml(booking) {
    return `
      <div class="booking-route">
        <div class="route-point">
          <span class="route-dot"></span>
          <div><small class="muted">Odbiór</small><br><strong>${safeText(booking.pickup)}</strong></div>
        </div>
        <div class="route-point">
          <span class="route-dot destination"></span>
          <div><small class="muted">Cel</small><br><strong>${safeText(booking.destination)}</strong></div>
        </div>
      </div>
    `;
  }

  function createBookingCard(booking, mode = "client") {
    const driver = state.drivers.find(item => item.id === booking.assignedDriverId);
    const vehicle = state.vehicles.find(item => item.id === booking.assignedVehicleId);
    const isAssigned = Boolean(driver);
    const canProgress = mode === "driver" && booking.status !== "completed" && booking.status !== "cancelled";
    const nextActions = {
      accepted: ["on_way", "Jadę do klienta"],
      on_way: ["arrived", "Jestem na miejscu"],
      arrived: ["in_progress", "Rozpocznij kurs"],
      in_progress: ["completed", "Zakończ kurs"]
    };
    const next = nextActions[booking.status];

    return `
      <article class="booking-card" data-booking-id="${safeText(booking.id)}">
        <div class="booking-head">
          <div>
            <strong>${safeText(booking.code)}</strong>
            <div class="small muted">${formatDateTime(booking.scheduledAt)}</div>
          </div>
          ${bookingStatusHtml(booking.status)}
        </div>
        ${bookingRouteHtml(booking)}
        <div class="meta">
          <span>${safeText(booking.customerName)}</span>
          <span>${safeText(booking.customerPhone)}</span>
          <span>${safeText(booking.passengers)} os.</span>
          ${booking.extra ? `<span>${safeText(booking.extra)}</span>` : ""}
        </div>
        ${booking.notes ? `<p class="small"><strong>Uwagi:</strong> ${safeText(booking.notes)}</p>` : ""}
        ${isAssigned ? `
          <p class="small">
            <strong>Kierowca:</strong> ${safeText(driver.name)}<br>
            <strong>Samochód:</strong> ${safeText(vehicle?.label || "Nie przypisano")} ${vehicle?.registration ? `(${safeText(vehicle.registration)})` : ""}
          </p>
        ` : ""}
        ${mode === "driver" && booking.status === "pending" ? `
          <div class="booking-actions">
            <button class="btn btn-primary accept-booking" type="button">Akceptuję kurs</button>
          </div>
        ` : ""}
        ${canProgress && next ? `
          <div class="booking-actions">
            <a class="btn btn-secondary" target="_blank" rel="noopener"
              href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(booking.pickup)}&destination=${encodeURIComponent(booking.destination)}">
              Nawigacja
            </a>
            <button class="btn btn-primary progress-booking" data-next-status="${next[0]}" type="button">${next[1]}</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderLatestBooking(booking) {
    const card = $("#latestBookingCard");
    card.classList.remove("hidden");
    card.innerHTML = `
      <span class="eyebrow">Zgłoszenie wysłane</span>
      <h2>Dziękujemy</h2>
      <p>Zapisz kod rezerwacji: <strong>${safeText(booking.code)}</strong></p>
      ${createBookingCard(booking, "client")}
    `;
  }

  function renderLookupResult(booking) {
    $("#lookupResult").innerHTML = booking
      ? `<div style="margin-top:14px">${createBookingCard(booking, "client")}</div>`
      : `<p class="muted" style="margin-top:14px">Nie znaleziono rezerwacji dla podanych danych.</p>`;
  }

  function currentDriver() {
    return state.drivers.find(driver => driver.id === state.ui.selectedDriverId) || state.drivers[0];
  }

  function renderDriverSelectors() {
    const driver = currentDriver();
    $("#driverSelect").innerHTML = state.drivers
      .filter(item => item.active)
      .map(item => `<option value="${safeText(item.id)}" ${item.id === driver.id ? "selected" : ""}>${safeText(item.name)}</option>`)
      .join("");

    $("#vehicleSelect").innerHTML = state.vehicles
      .filter(item => item.active)
      .map(item => `<option value="${safeText(item.id)}" ${item.id === driver.activeVehicleId ? "selected" : ""}>${safeText(item.label)}</option>`)
      .join("");

    $("#availabilityToggle").checked = Boolean(driver.available);
    $("#availabilityText").textContent = driver.available ? "Dostępny" : "Niedostępny";
  }

  function renderDriverPanel() {
    renderDriverSelectors();
    const driver = currentDriver();
    if (!driver) return;

    const notifications = (state.notifications || [])
      .filter(notification => notification.driverId === driver.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    const notificationsCard = $("#driverNotificationsCard");
    notificationsCard.classList.toggle("hidden", notifications.length === 0);
    $("#driverNotifications").innerHTML = notifications.map(notification => `
      <div class="booking-card">
        <strong>${safeText(notification.title)}</strong>
        <p class="small muted" style="margin:6px 0 0">${safeText(notification.message)}</p>
      </div>
    `).join("");

    const pending = state.bookings
      .filter(booking => booking.status === "pending")
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const assigned = state.bookings
      .filter(booking => booking.assignedDriverId === driver.id && !["cancelled"].includes(booking.status))
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    $("#pendingCount").textContent = pending.length;
    $("#pendingBookings").innerHTML = !driver.available
      ? `<p class="muted">Ustaw status „Dostępny”, aby przyjmować zgłoszenia.</p>`
      : pending.length
        ? pending.map(booking => createBookingCard(booking, "driver")).join("")
        : `<p class="muted">Brak nowych zgłoszeń.</p>`;

    $("#assignedBookings").innerHTML = assigned.length
      ? assigned.map(booking => createBookingCard(booking, "driver")).join("")
      : `<p class="muted">Brak przypisanych kursów.</p>`;

    const completed = assigned.filter(item => item.status === "completed").length;
    const active = assigned.filter(item => !["completed", "cancelled"].includes(item.status)).length;
    $("#driverSummary").innerHTML = `
      <div class="stat"><strong>${active}</strong><span>Aktywne kursy</span></div>
      <div class="stat"><strong>${completed}</strong><span>Zakończone</span></div>
    `;
  }

  function renderCompanyPanel() {
    const form = $("#companyForm");
    Object.entries(state.company).forEach(([key, value]) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = value ?? "";
    });

    $("#driversList").innerHTML = state.drivers.map(driver => `
      <div class="data-row">
        <div>
          <strong>${safeText(driver.name)}</strong><br>
          <small>${safeText(driver.phone || "Brak telefonu")}</small>
        </div>
        <span class="status-chip ${driver.available ? "completed" : "cancelled"}">${driver.available ? "Dostępny" : "Offline"}</span>
      </div>
    `).join("");

    $("#vehiclesList").innerHTML = state.vehicles.map(vehicle => `
      <div class="data-row">
        <div>
          <strong>${safeText(vehicle.label)}</strong><br>
          <small>${safeText(vehicle.registration || "Brak numeru rejestracyjnego")}</small>
        </div>
        <span class="status-chip ${vehicle.active ? "completed" : "cancelled"}">${vehicle.active ? "Aktywny" : "Nieaktywny"}</span>
      </div>
    `).join("");
  }

  function acceptBooking(bookingId) {
    state = loadState();
    const driver = currentDriver();
    const booking = state.bookings.find(item => item.id === bookingId);

    if (!driver?.available) {
      showToast("Najpierw ustaw status kierowcy na „Dostępny”.");
      return;
    }
    if (!driver.activeVehicleId) {
      showToast("Wybierz aktywny samochód.");
      return;
    }
    if (!booking || booking.status !== "pending") {
      showToast("Ten kurs został już przyjęty przez innego kierowcę.");
      renderDriverPanel();
      return;
    }

    booking.status = "accepted";
    booking.assignedDriverId = driver.id;
    booking.assignedVehicleId = driver.activeVehicleId;
    booking.acceptedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();

    state.notifications = state.notifications || [];
    state.drivers
      .filter(otherDriver => otherDriver.id !== driver.id && otherDriver.active)
      .forEach(otherDriver => {
        state.notifications.unshift({
          id: id("notification"),
          driverId: otherDriver.id,
          title: "Zgłoszenie zostało przyjęte",
          message: `Kurs ${booking.code} został zaakceptowany przez ${driver.name}.`,
          bookingId: booking.id,
          createdAt: new Date().toISOString()
        });
      });

    saveState();
    showToast(`Kurs ${booking.code} przypisano do ${driver.name}.`);
    renderDriverPanel();
  }

  function progressBooking(bookingId, nextStatus) {
    const booking = state.bookings.find(item => item.id === bookingId);
    const driver = currentDriver();
    if (!booking || booking.assignedDriverId !== driver.id) return;

    booking.status = nextStatus;
    booking.updatedAt = new Date().toISOString();
    saveState();
    showToast(`Status kursu: ${STATUS_LABELS[nextStatus]}.`);
    renderDriverPanel();
  }

  function registerEvents() {
    $$(".nav-btn").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));

    $$(".segment").forEach(btn => btn.addEventListener("click", () => {
      $$(".segment").forEach(item => item.classList.remove("active"));
      btn.classList.add("active");
      $("#bookingType").value = btn.dataset.bookingType;
      $("#scheduledFields").classList.toggle("hidden", btn.dataset.bookingType !== "scheduled");
    }));

    $("#bookingForm").addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);

      try {
        const scheduledAt = scheduledIsoFromForm(data);
        const booking = {
          id: id("book"),
          tenantId: state.company.id,
          code: bookingCode(),
          bookingType: data.get("bookingType"),
          pickup: String(data.get("pickup") || "").trim(),
          destination: String(data.get("destination") || "").trim(),
          customerName: String(data.get("customerName") || "").trim(),
          customerPhone: String(data.get("customerPhone") || "").trim(),
          passengers: Number(data.get("passengers") || 1),
          extra: String(data.get("extra") || ""),
          notes: String(data.get("notes") || "").trim(),
          scheduledAt,
          status: "pending",
          assignedDriverId: null,
          assignedVehicleId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        state.bookings.unshift(booking);
        saveState();
        renderLatestBooking(booking);
        form.reset();
        $("#bookingType").value = "now";
        $("#scheduledFields").classList.add("hidden");
        $$(".segment").forEach(item => item.classList.toggle("active", item.dataset.bookingType === "now"));
        showToast("Zgłoszenie zostało przekazane dostępnym kierowcom.");
      } catch (error) {
        showToast(error.message || "Nie udało się wysłać zgłoszenia.");
      }
    });

    $("#lookupForm").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const code = String(data.get("bookingCode") || "").trim().toUpperCase();
      const phone = normalizePhone(String(data.get("phone") || ""));
      const booking = state.bookings.find(item =>
        item.code.toUpperCase() === code && normalizePhone(item.customerPhone) === phone
      );
      renderLookupResult(booking);
    });

    $("#driverSelect").addEventListener("change", event => {
      state.ui.selectedDriverId = event.target.value;
      saveState();
      renderDriverPanel();
    });

    $("#vehicleSelect").addEventListener("change", event => {
      const driver = currentDriver();
      if (!driver) return;
      driver.activeVehicleId = event.target.value;
      saveState();
      renderDriverPanel();
      showToast("Aktywny samochód został zmieniony.");
    });

    $("#availabilityToggle").addEventListener("change", event => {
      const driver = currentDriver();
      if (!driver) return;
      driver.available = event.target.checked;
      saveState();
      renderDriverPanel();
      showToast(driver.available ? "Kierowca jest dostępny." : "Kierowca jest niedostępny.");
    });

    $("#pendingBookings").addEventListener("click", event => {
      const button = event.target.closest(".accept-booking");
      if (!button) return;
      const card = button.closest("[data-booking-id]");
      acceptBooking(card.dataset.bookingId);
    });

    $("#assignedBookings").addEventListener("click", event => {
      const button = event.target.closest(".progress-booking");
      if (!button) return;
      const card = button.closest("[data-booking-id]");
      progressBooking(card.dataset.bookingId, button.dataset.nextStatus);
    });

    $("#companyForm").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state.company = {
        ...state.company,
        name: String(data.get("name") || "").trim(),
        slogan: String(data.get("slogan") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        serviceArea: String(data.get("serviceArea") || "").trim(),
        primaryColor: String(data.get("primaryColor") || "#f5c400"),
        slug: String(data.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      };
      saveState();
      applyBranding();
      showToast("Konfiguracja firmy została zapisana.");
    });

    $("#addDriverForm").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const newDriver = {
        id: id("drv"),
        name: String(data.get("name") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        active: true,
        available: false,
        activeVehicleId: state.vehicles[0]?.id || null
      };
      state.drivers.push(newDriver);
      saveState();
      event.currentTarget.reset();
      renderCompanyPanel();
      showToast("Dodano kierowcę.");
    });

    $("#addVehicleForm").addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const newVehicle = {
        id: id("veh"),
        label: String(data.get("label") || "").trim(),
        registration: String(data.get("registration") || "").trim(),
        active: true
      };
      state.vehicles.push(newVehicle);
      saveState();
      event.currentTarget.reset();
      renderCompanyPanel();
      showToast("Dodano samochód.");
    });

    $("#resetDemoBtn").addEventListener("click", () => {
      if (!confirm("Czy na pewno przywrócić dane początkowe?")) return;
      state = cloneDefaultState();
      saveState();
      applyBranding();
      renderCompanyPanel();
      renderDriverPanel();
      $("#latestBookingCard").classList.add("hidden");
      $("#lookupResult").innerHTML = "";
      showToast("Przywrócono dane początkowe.");
    });

    window.addEventListener("online", updateConnectionBadge);
    window.addEventListener("offline", updateConnectionBadge);
    window.addEventListener("storage", () => {
      state = loadState();
      applyBranding();
      renderDriverPanel();
      if ($("#companyView").classList.contains("active-view")) renderCompanyPanel();
    });
    window.addEventListener("taxi-state-changed", () => {
      state = loadState();
    });

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $("#installBtn").classList.remove("hidden");
    });

    $("#installBtn").addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      $("#installBtn").classList.add("hidden");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.error("Service worker error:", error);
      });
    }
  }

  function init() {
    applyBranding();
    updateConnectionBadge();
    registerEvents();
    renderDriverPanel();
    renderCompanyPanel();
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
