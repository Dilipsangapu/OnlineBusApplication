let selectedBus = null;
let editingBusId = null;
let editingRouteId = null;
let editingStaffId = null;
let editingScheduleId = null;

// ✅ --- Custom Notification Function ---
const notificationContainer = document.getElementById("notification-container");

/**
 * Displays a custom, non-blocking notification at the top right.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True for error style (red), false for success/default (teal).
 */
function showNotification(message, isError = false) {
    if (!notificationContainer) return;

    // Remove existing notifications if too many (optional cleanup)
    if (notificationContainer.children.length > 5) {
        notificationContainer.lastChild.remove();
    }

    const notif = document.createElement("div");
    notif.className = `notification-message ${isError ? 'notification-error' : 'notification-success'}`;
    notif.innerHTML = message;

    notificationContainer.prepend(notif); // Use prepend to show newest at the top

    // 3. Set a timeout to start the removal process (after 4.5 seconds)
    setTimeout(() => {
        // We start the fade out by setting a new class
        // The CSS transition property will handle the smooth fade.
        notif.classList.add('fade-out');

        // 4. Set another timeout to remove it completely after the fade-out duration (e.g., 0.5s)
        setTimeout(() => {
            notif.remove();
        }, 500); // Wait for 500ms (0.5s) for the fade transition to finish

    }, 4500); // Notification stays fully visible for 4.5 seconds
}
// --- End Notification Function ---


// ✅ --- Loader Functions ---
const loader = document.getElementById("loader-overlay");

function showLoader() {
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  if (loader) loader.style.display = "none";
}

/**
 * Shows loader and ensures it's visible for at least 1 second
 * while the provided async operation completes.
 * @param {Promise} operationPromise - The async (fetch) operation.
 */
function runWithLoader(operationPromise) {
  showLoader();

  // Create a minimum 1-second delay promise
  const delayPromise = new Promise(resolve => setTimeout(resolve, 1000));

  // Wait for both the operation AND the delay to finish
  Promise.all([operationPromise, delayPromise])
    .finally(hideLoader);
}
// --- End Loader Functions ---


function showSection(sectionId) {
  document.querySelectorAll(".dashboard-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));

  document.getElementById(sectionId + "Section")?.classList.add("active");
  document.querySelector(`.sidebar li[onclick*="${sectionId}"]`)?.classList.add("active");

  // ✅ Each section load is now an operation wrapped by the loader
  let operationPromise;

  if (sectionId === "dashboard") operationPromise = loadDashboardStats();
  if (sectionId === "buses") operationPromise = fetchBuses();
  if (sectionId === "layout") operationPromise = fetchBusesForLayout();
  if (sectionId === "routes") operationPromise = loadRoutes();
  if (sectionId === "staff") operationPromise = loadStaffSection();
  if (sectionId === "schedule") operationPromise = loadScheduleSection();
  if (sectionId === "bookings") operationPromise = loadBookings();

  if (operationPromise) {
    runWithLoader(operationPromise);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showSection("dashboard");
});

// ✅ REFACTORED: Now returns a promise
function loadDashboardStats() {
  return fetch(`/agent/api/stats`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
    })
    .then(stats => {
      const tripsEl = document.getElementById("totalTrips");
      const revenueEl = document.getElementById("monthlyRevenue");
      const busCountEl = document.getElementById("busCount");
      const routeCountEl = document.getElementById("routeCount");
      const bookingCountEl = document.getElementById("bookingCount");

      if (tripsEl) tripsEl.innerText = stats.totalSchedules;
      if (revenueEl) revenueEl.innerText = "₹" + stats.totalRevenue;
      if (busCountEl) busCountEl.innerText = stats.totalBuses;
      if (routeCountEl) routeCountEl.innerText = stats.totalRoutes;
      if (bookingCountEl) bookingCountEl.innerText = stats.totalBookings;
    })
    .catch(err => {
      console.error("Failed to load real stats:", err);
      showNotification("❌ Could not load dashboard stats.", true);
    });
}



// ---------------- BUS HANDLING ---------------- //
// ✅ REFACTORED: Now returns a promise
function fetchBuses() {
  const agentId = document.body.getAttribute("data-email");
  return fetch(`/buses/api/by-operator/${agentId}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(buses => {
      const tableBody = document.getElementById("busTableBody");
      tableBody.innerHTML = "";
      buses.forEach(bus => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${bus.busName}</td>
          <td>${bus.busNumber}</td>
          <td>${bus.busType}</td>
          <td>${bus.totalSeats}</td>
          <td><button onclick="editBus('${bus.id}')" class="btn-edit">✏️</button></td>
        `;
        tableBody.appendChild(row);
      });
    })
    .catch(err => {
        console.error("Failed to fetch buses:", err);
        showNotification("❌ Failed to fetch buses.", true);
    });
}

// NOTE: Since the HTML button for edit uses a link href, I've added a dummy editBus function
// to simulate the editing process which you'd normally implement.
function editBus(busId) {
    // In a real application, this would fetch bus data and populate the form
    // For now, let's just show a notification that editing is simulated
    showNotification(`Simulating edit for Bus ID: ${busId}. Populate form and submit to update.`, false);
    editingBusId = busId; // Set editing ID
}

// ✅ REFACTORED: Uses runWithLoader
document.getElementById("busForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;

  const isEditing = !!editingBusId;

  const bus = {
    operatorId: document.body.getAttribute("data-email"),
    operatorName: document.body.getAttribute("data-name"),
    busName: form.busName.value.trim(),
    busNumber: form.busNumber.value.trim(),
    busType: form.busType.value,
    deckType: form.deckType.value,
    sleeperCount: parseInt(form.sleeperSeats.value || 0),
    seaterCount: parseInt(form.seaterSeats.value || 0),
    totalSeats: (parseInt(form.sleeperSeats.value || 0) + parseInt(form.seaterSeats.value || 0)),
    hasUpperDeck: form.deckType.value.includes("Upper"),
    hasLowerDeck: true
  };

  const method = isEditing ? "PUT" : "POST";
  const url = isEditing ? `/buses/api/update/${editingBusId}` : "/buses/api/add";

  const operation = fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bus)
  })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    })
    .then(msg => {
      // 🚨 EXPLICIT SUCCESS MESSAGE
      const successMsg = isEditing ? `✅ Bus **${bus.busName}** updated successfully!` : `✅ Bus **${bus.busName}** added successfully!`;
      showNotification(successMsg);
      form.reset();
      editingBusId = null;
      return fetchBuses();
    })
    .catch(err => {
      console.error("Error saving bus:", err);
      showNotification("❌ Failed to save/update bus.", true);
    });

  runWithLoader(operation);
});

// ---------------- ROUTE HANDLING ---------------- //
// ✅ REFACTORED: Now returns a promise
function loadRoutes() {
  const email = document.body.getAttribute("data-email");
  return fetch(`/buses/api/by-operator/${email}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(buses => {
      const select = document.getElementById("busSelect");
      select.innerHTML = '<option value="">Select Bus</option>';
      buses.forEach(bus => {
        const option = document.createElement("option");
        option.value = bus.id;
        option.textContent = `${bus.busName} (${bus.busNumber})`;
        select.appendChild(option);
      });

      select.addEventListener("change", () => {
        const selectedId = select.value;
        selectedBus = buses.find(b => b.id === selectedId);
      });

      return loadSavedRoutes(buses); // ✅ Chain the next operation
    })
    .catch(err => {
      console.error("Error loading buses for routes:", err);
    });
}

// ✅ REFACTORED: Now returns a promise
function loadSavedRoutes(buses) {
  const routeList = document.getElementById("routeList");
  routeList.innerHTML = "";

  if (buses.length === 0) {
    return Promise.resolve(); // Return an empty promise
  }

  const promises = buses.map(bus => {
    return fetch(`/api/routes/by-bus/${bus.id}`)
      .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
      })
      .then(routes => {
        if (routes.length === 0) return;

        const section = document.createElement("div");
        section.innerHTML = `<h4>🚌 ${bus.busName}</h4>`;
        const table = document.createElement("table");
        table.className = "route-table";
        table.innerHTML = `<thead><tr><th>From</th><th>To</th><th>Stops</th><th>Timings</th><th>Actions</th></tr></thead>`;
        const tbody = document.createElement("tbody");
        routes.forEach(route => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${route.from}</td>
            <td>${route.to}</td>
            <td>${route.stops.join(", ")}</td>
            <td>${route.timings}</td>
            <td>
              <button onclick='editRoute(${JSON.stringify(route)})'>✏️</button>
              <button onclick='deleteRoute("${route.id}", "${route.from} to ${route.to}")'>🗑️</button>
            </td>
          `;
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        routeList.appendChild(section);
      });
  });

  return Promise.all(promises) // ✅ Return the promise
    .catch(err => console.error("Error loading saved routes:", err));
}

function editRoute(route) {
  // ... (this is synchronous, no change needed)
  editingRouteId = route.id;
  const form = document.getElementById("routeForm");
  form.from.value = route.from;
  form.to.value = route.to;
  form.stops.value = route.stops.join(", ");
  form.timings.value = route.timings;
  document.getElementById("busSelect").value = route.busId;
  selectedBus = { id: route.busId };
  showNotification(`✏️ Ready to edit route from **${route.from}** to **${route.to}**.`);
}

// ✅ REFACTORED: Uses runWithLoader
function deleteRoute(routeId, routeName) {
    // 🚨 Confirmation before delete
    if (!confirm(`Are you sure you want to delete the route: ${routeName}?`)) {
        return;
    }

  const operation = fetch(`/api/routes/delete/${routeId}`, { method: "DELETE" })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 🚨 EXPLICIT SUCCESS MESSAGE
        showNotification(`🗑️ Route **${routeName}** deleted successfully!`);
    })
    .then(() => loadRoutes()) // ✅ Chain the next operation
    .catch(err => {
      console.error("Error deleting route:", err);
      showNotification("❌ Error deleting route.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
}

// ✅ REFACTORED: Uses runWithLoader
document.getElementById("routeForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;

  const isEditing = !!editingRouteId;
  const from = form.from.value;
  const to = form.to.value;

  if (!selectedBus || !selectedBus.id) {
    showNotification("Please select a bus for the route.", true);
    return;
  }

  const route = {
    busId: selectedBus.id,
    from: from,
    to: to,
    stops: form.stops.value.split(",").map(s => s.trim()),
    timings: form.timings.value
  };

  const method = isEditing ? "PUT" : "POST";
  const url = isEditing ? `/api/routes/update/${editingRouteId}` : "/api/routes/add";

  const operation = fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(route)
  })
    .then(async res => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} – ${text}`);
      }
      return res.text();
    })
    .then(() => {
      // 🚨 EXPLICIT SUCCESS MESSAGE
      const successMsg = isEditing ? `✅ Route **${from} to ${to}** updated successfully!` : `✅ New Route **${from} to ${to}** added!`;
      showNotification(successMsg);
      form.reset();
      editingRouteId = null;
      return loadRoutes();
    })
    .catch(err => {
        console.error("Error saving route:", err);
        showNotification("❌ Error saving route.", true);
    });

  runWithLoader(operation);
});

// ---------------- LAYOUT ---------------- //
// ✅ REFACTORED: Now returns a promise
function fetchBusesForLayout() {
  const email = document.body.getAttribute("data-email");
  return fetch(`/buses/api/by-operator/${email}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(buses => {
      const container = document.getElementById("seatLayoutBusCards");
      container.innerHTML = "";
      buses.forEach(bus => {

        const card = document.createElement("div");
        card.className = "bus-card";
        card.innerHTML = `
          <h4>${bus.busName}</h4>
          <p>${bus.busNumber} | ${bus.busType}</p>
          <p>Deck: ${bus.deckType}</p>
          <p>Seats: ${bus.totalSeats} (S: ${bus.sleeperCount}, T: ${bus.seaterCount})</p>
          <button class="configure-btn">Configure Seats</button>
        `;
        card.querySelector(".configure-btn").addEventListener("click", () => {
          selectedBus = bus;
          renderRedbusLayout(bus);
          showNotification(`✏️ Configuring layout for **${bus.busName}**. Adjust prices and save.`);
        });
        container.appendChild(card);
      });
    })
    .catch(err => {
        console.error("Error fetching buses for layout:", err);
        showNotification("❌ Error fetching buses for layout.", true);
    });
}

// ... (renderRedbusLayout and switchDeck are synchronous, no changes) ...
function renderRedbusLayout(bus) { /* ... */ }
function switchDeck(deck) { /* ... */ }


// ✅ REFACTORED: Uses runWithLoader
function saveSeatLayout() {
  if (!selectedBus || !selectedBus.id) {
    showNotification("Please select a bus to save seat layout.", true);
    return;
  }

  const busName = selectedBus.busName; // Capture bus name for notification

  const layout = {
    busId: selectedBus.id,
    seats: []
  };
  const seatElements = document.querySelectorAll(".seat");
  seatElements.forEach(seat => {
    const number = seat.innerText.split(" ")[1];
    const type = seat.classList.contains("sleeper") ? "sleeper" : "seater";
    const deck = seat.parentElement.id === "upperDeck" ? "upper" : "lower";
    const priceInput = seat.querySelector("input");
    const price = parseInt(priceInput.value || 0);
    layout.seats.push({ number, type, deck, price });
  });


  const operation = fetch("/api/seats/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout)
  })
    .then(res => {
      if (!res.ok) throw new Error(`Failed with HTTP status ${res.status}`);
      return res.json();
    })
    // 🚨 EXPLICIT SUCCESS MESSAGE
    .then(() => showNotification(`✅ Seat layout and pricing saved for **${busName}**!`))
    .catch(err => {
      console.error("Error saving seat layout:", err);
      showNotification("❌ Failed to save seat layout. See console.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
}

// --------- STAFF FEATURE ---------
// ✅ REFACTORED: Now returns a promise
function loadStaffSection() {
  const agentId = document.body.getAttribute("data-email");
  return fetch(`/buses/api/by-operator/${agentId}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(buses => {
      const select = document.getElementById("staffBusSelect");
      select.innerHTML = '<option value="">Select Bus</option>';
      buses.forEach(bus => {
        const option = document.createElement("option");
        option.value = bus.id;
        option.textContent = `${bus.busName} (${bus.busNumber})`;
        select.appendChild(option);
      });

      const container = document.getElementById("staffList");
      container.innerHTML = "";

      if (buses.length === 0) {
        return Promise.resolve();
      }

      const promises = buses.map(bus => {
        return fetch(`/api/staff/by-bus/${bus.id}`)
          .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
          })
          .then(staffList => {
            if (staffList.length === 0) return;

            const section = document.createElement("div");
            section.innerHTML = `<h4>🚌 ${bus.busName}</h4>`;
            const table = document.createElement("table");
            table.className = "route-table";
            table.innerHTML = `
              <thead>
                <tr><th>Driver</th><th>Conductor</th><th>Actions</th></tr>
              </thead>
            `;
            const tbody = document.createElement("tbody");
            staffList.forEach(staff => {
              const row = document.createElement("tr");
              row.innerHTML = `
                <td>${staff.driverName} <br/>📞 ${staff.driverContact}</td>
                <td>${staff.conductorName || '-'} <br/>📞 ${staff.conductorContact || '-'}</td>
                <td>
                  <button onclick='editStaff(${JSON.stringify(staff)})'>✏️</button>
                  <button onclick='deleteStaff("${staff.id}", "${staff.driverName}")'>🗑️</button>
                </td>
              `;
              tbody.appendChild(row);
            });
            table.appendChild(tbody);
            section.appendChild(table);
            container.appendChild(section);
          });
      });

      return Promise.all(promises); // ✅ Return the promise
    })
    .catch(err => {
        console.error("Error loading buses for staff:", err);
        showNotification("❌ Error loading staff.", true);
    });
}

function editStaff(staff) {

  editingStaffId = staff.id;
  const form = document.getElementById("staffForm");
  form.driverName.value = staff.driverName;
  form.driverContact.value = staff.driverContact;
  form.conductorName.value = staff.conductorName || "";
  form.conductorContact.value = staff.conductorContact || "";
  document.getElementById("staffBusSelect").value = staff.busId;
  showNotification(`✏️ Ready to edit staff for **${staff.driverName}**.`);
}

// ✅ REFACTORED: Uses runWithLoader
function deleteStaff(id, driverName) {
    // 🚨 Confirmation before delete
    if (!confirm(`Are you sure you want to delete staff details for: ${driverName}?`)) {
        return;
    }

  const operation = fetch(`/api/staff/delete/${id}`, { method: "DELETE" })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 🚨 EXPLICIT SUCCESS MESSAGE
        showNotification(`🗑️ Staff details for **${driverName}** deleted!`);
    })
    .then(() => loadStaffSection()) // ✅ Chain the next operation
    .catch(err => {
      console.error("Error deleting staff:", err);
      showNotification("❌ Error deleting staff.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
}

// ✅ REFACTORED: Uses runWithLoader
document.getElementById("staffForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;

  const isEditing = !!editingStaffId;

  const staff = {
    busId: document.getElementById("staffBusSelect").value,
    driverName: form.driverName.value,
    driverContact: form.driverContact.value,
    conductorName: form.conductorName.value,
    conductorContact: form.conductorContact.value
  };

  if (!staff.busId) {
    showNotification("Please select a bus", true);
    return;
  }

  const url = isEditing ? `/api/staff/update/${editingStaffId}` : "/api/staff/add";
  const method = isEditing ? "PUT" : "POST";


  const operation = fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staff)
    })
    .then(async (res) => { // Make this async to await text()
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.text(); // Or res.json()
    })
    .then(() => {
        // 🚨 EXPLICIT SUCCESS MESSAGE
        const successMsg = isEditing ? `✅ Staff details for **${staff.driverName}** updated!` : `✅ Staff details for **${staff.driverName}** saved!`;
        showNotification(successMsg);
        form.reset();
        editingStaffId = null;
        return loadStaffSection(); // ✅ Chain the next operation
    })
    .catch(err => {
        console.error("Error saving staff:", err);
        showNotification("❌ Failed to save staff. See console.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
});

// --------- SCHEDULE FEATURE ---------
// ✅ REFACTORED: Now returns a promise
function loadScheduleSection() {
  const agentId = document.body.getAttribute("data-email");
  return fetch(`/buses/api/by-operator/${agentId}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(buses => {
      const select = document.getElementById("scheduleBusSelect");
      select.innerHTML = '<option value="">Select Bus</option>';
      buses.forEach(bus => {
        const option = document.createElement("option");
        option.value = bus.id;
        option.textContent = `${bus.busName} (${bus.busNumber})`;
        select.appendChild(option);
      });
      return loadScheduleList(buses); // ✅ Chain the next operation
    })
    .catch(err => {
      console.error("Error loading buses for schedule:", err);
      showNotification("❌ Error loading schedule section.", true);
    });
}

// ✅ REFACTORED: Now returns a promise
function loadScheduleList(buses) {
  const container = document.getElementById("tripScheduleList");
  container.innerHTML = "";

  if (buses.length === 0) {
    return Promise.resolve();
  }

  const promises = buses.map(bus => {
    return fetch(`/api/schedule/by-bus/${bus.id}`)
      .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
      })
      .then(schedules => {
        if (schedules.length === 0) return;

        const section = document.createElement("div");
        section.innerHTML = `<h4>🚌 ${bus.busName}</h4>`;
        const table = document.createElement("table");
        table.className = "route-table";
        table.innerHTML = `
          <thead><tr><th>Date</th><th>Departure</th><th>Arrival</th><th>Actions</th></tr></thead>
        `;
        const tbody = document.createElement("tbody");
        schedules.forEach(sch => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${sch.date}</td>
            <td>${sch.departureTime}</td>
            <td>${sch.arrivalTime}</td>
            <td>
              <button onclick='editSchedule(${JSON.stringify(sch)})'>✏️</button>
              <button onclick='deleteSchedule("${sch.id}", "${bus.busName}", "${sch.date}")'>🗑️</button>
            </td>
          `;
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        container.appendChild(section);
      });
  });

  return Promise.all(promises) // ✅ Return the promise
    .catch(err => console.error("Error loading schedule list:", err));
}

function editSchedule(schedule) {

  editingScheduleId = schedule.id;
  document.getElementById("scheduleDate").value = schedule.date;
  document.getElementById("departureTime").value = schedule.departureTime;
  document.getElementById("arrivalTime").value = schedule.arrivalTime;
  document.getElementById("scheduleBusSelect").value = schedule.busId;
  showNotification(`✏️ Ready to edit schedule for **${schedule.date}**.`);
}

// ✅ REFACTORED: Uses runWithLoader
function deleteSchedule(id, busName, date) {
    // 🚨 Confirmation before delete
    if (!confirm(`Are you sure you want to delete the trip for ${busName} on ${date}?`)) {
        return;
    }

  const operation = fetch(`/api/schedule/delete/${id}`, { method: "DELETE" })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 🚨 EXPLICIT SUCCESS MESSAGE
        showNotification(`🗑️ Trip for **${busName}** on **${date}** deleted!`);
    })
    .then(() => loadScheduleSection()) // ✅ Chain the next operation
    .catch(err => {
      console.error("Error deleting schedule:", err);
      showNotification("❌ Error deleting schedule.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
}

// ✅ REFACTORED: Uses runWithLoader
document.getElementById("saveScheduleBtn")?.addEventListener("click", async () => {

  const isEditing = !!editingScheduleId;

  const schedule = {
    busId: document.getElementById("scheduleBusSelect").value,
    date: document.getElementById("scheduleDate").value,
    departureTime: document.getElementById("departureTime").value,
    arrivalTime: document.getElementById("arrivalTime").value
  };

  if (!schedule.busId || !schedule.date || !schedule.departureTime || !schedule.arrivalTime) {
    showNotification("Please fill in all schedule fields", true);
    return;
  }

  const url = isEditing ? `/api/schedule/update/${editingScheduleId}` : "/api/schedule/add";
  const method = isEditing ? "PUT" : "POST";

  const operation = fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule)
    })
    .then(async (res) => { // Make async to await text()
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.text();
    })
    .then(() => {
        // 🚨 EXPLICIT SUCCESS MESSAGE
        const busSelect = document.getElementById("scheduleBusSelect");
        const busName = busSelect.options[busSelect.selectedIndex].textContent.split('(')[0].trim();
        const successMsg = isEditing ? `✅ Trip on **${schedule.date}** updated!` : `✅ New trip added for **${busName}** on **${schedule.date}**!`;
        showNotification(successMsg);

        document.getElementById("scheduleDate").value = "";
        document.getElementById("departureTime").value = "";
        document.getElementById("arrivalTime").value = "";
        editingScheduleId = null;
        return loadScheduleSection(); // ✅ Chain the next operation
    })
    .catch(err => {
        console.error("Error saving schedule:", err);
        showNotification("❌ Failed to save schedule. See console.", true);
    });

  runWithLoader(operation); // ✅ Wrap the operation
});

// --------- BOOKINGS FEATURE ---------
// ✅ REFACTORED: Now returns a promise
function loadBookings() {
  return fetch(`/agent/api/bookings`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(bookings => {
      const container = document.getElementById("bookingList");
      container.innerHTML = "";

      if (bookings.length === 0) {
        container.innerHTML = "<p>No bookings found for your buses.</p>";
        return;
      }

      const table = document.createElement("table");
      table.className = "route-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Passenger</th><th>Email</th><th>Mobile</th>
            <th>From</th><th>To</th>
            <th>Seat</th><th>Fare</th><th>Status</th><th>Date</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement("tbody");
      bookings.forEach(b => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${b.passengerName}</td>
          <td>${b.email}</td>
          <td>${b.passengerMobile}</td>
          <td>${b.routeFrom}</td>
          <td>${b.routeTo}</td>
          <td>${b.seatNumber}</td>
          <td>₹${b.fare}</td>
          <td>${b.status}</td>
          <td>${b.travelDate}</td>
        `;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    })
    .catch(err => {
        console.error("Error loading bookings:", err);
        showNotification("❌ Could not load bookings.", true);
    });
}