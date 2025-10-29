// Global variables
let selectedSeats = [];
let currentSeatLayout = [];
let selectedBusId = null;
let selectedTravelDate = null;
let selectedRouteStops = [];
let userEmail = document.body.getAttribute("data-email");
let userName = document.body.getAttribute("data-name");

// ✅ --- Custom Notification Function (No Change) ---
const notificationContainer = document.getElementById("notification-container");

/**
 * Displays a custom, non-blocking notification at the top right.
 */
function showNotification(message, isError = false, isEmail = false) {
    if (!notificationContainer) return;

    if (notificationContainer.children.length > 5) {
        notificationContainer.lastChild.remove();
    }

    const notif = document.createElement("div");
    let className = 'notification-message ';
    if (isEmail) {
        className += 'notification-email';
    } else if (isError) {
        className += 'notification-error';
    } else {
        className += 'notification-success';
    }
    
    notif.className = className;
    notif.innerHTML = message;

    notificationContainer.prepend(notif);

    setTimeout(() => {
        notif.classList.add('fade-out');

        setTimeout(() => {
            notif.remove();
        }, 500);

    }, 4500);
}
// --- End Notification Function ---


// ✅ --- Loader Functions (FINAL FINAL FAILSAFE VERSION) ---

function showLoader() {
  const loader = document.getElementById("loader-overlay"); // 🚨 GETTING ELEMENT INSIDE FUNCTION
  if (loader) {
    // 🚨 Using setProperty to guarantee display: flex !important
    loader.style.setProperty('display', 'flex', 'important');
  }
}

function hideLoader() {
  const loader = document.getElementById("loader-overlay"); // 🚨 GETTING ELEMENT INSIDE FUNCTION
  if (loader) {
    loader.style.setProperty('display', 'none', 'important');
  }
}

/**
 * Shows loader and ensures it's visible for at least 1 second
 * while the provided async operation completes.
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


// --------- INITIALIZATION ---------
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('travelDate').setAttribute('min', today);

  const bookingStatus = sessionStorage.getItem('bookingStatus');
  const emailStatus = sessionStorage.getItem('emailStatus');
  
  if (bookingStatus === 'success') {
    if (emailStatus === 'sent') {
      showNotification("📧🎉 Booking Successful! Your ticket has been sent to your email. Check your inbox for the confirmation email with PDF attachment.", false, true);
    } else if (emailStatus === 'failed') {
      showNotification("⚠️✅ Booking Successful! However, there was an issue sending the email. You can download your ticket from the 'My Bookings' section.", true);
    } else {
      showNotification("📧🎉 Booking Successful! Your ticket is being processed and will be sent to your email shortly.", false, true);
    }
    sessionStorage.removeItem('bookingStatus');
    sessionStorage.removeItem('emailStatus');
  }

  showUserSection("search");
});

// --------- SECTION NAVIGATION ---------
function showUserSection(sectionId) {
  document.querySelectorAll(".user-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
  document.getElementById(sectionId + "Section").classList.add("active");
  const li = document.querySelector(`.sidebar li[onclick*="${sectionId}"]`);
  if (li) li.classList.add("active");

  // ✅ Wrap loadUserBookings with the loader
  if (sectionId === "bookings") runWithLoader(loadUserBookings());
}

// --------- BUS SEARCH (UPDATED) ---------
document.getElementById("searchForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const from = document.getElementById("fromCity").value.trim();
  const to = document.getElementById("toCity").value.trim();
  const date = document.getElementById("travelDate").value;
  if (!from || !to || !date) {
    showNotification("❗ Please fill all fields.", true);
    return;
  }
  selectedTravelDate = date;

  document.getElementById("seatLayoutContainer").style.display = "none";

  // ✅ Define the fetch operation
  const searchOperation = fetch(`/user/api/search-buses?from=${from}&to=${to}&date=${date}`)
    .then(res => res.json())
    .then(buses => {
      const resultDiv = document.getElementById("searchResults");
      resultDiv.innerHTML = buses.length === 0 ?
        "<p>❌ No buses found for the selected route and date.</p>" :
        buses.map(bus => `
          <div class="bus-card">
            <h4>${bus.busName} (${bus.busNumber})</h4>
            <p><strong>Type:</strong> ${bus.busType}</p>
            <p><strong>Departure:</strong> ${bus.departureTime} | <strong>Arrival:</strong> ${bus.arrivalTime}</p>
            <p><strong>Estimated Fare:</strong> ₹${bus.estimatedFare ? bus.estimatedFare.toFixed(2) : 'N/A'}</p>
            <button onclick='loadSeatLayout("${bus.id}", "${bus.busName}", "${date}")'>🪑 View & Book Seats</button>
          </div>`).join("");

      if(buses.length > 0) {
        showNotification(`✅ Found ${buses.length} buses for ${from} to ${to}!`);
      }
    })
    .catch(err => {
      console.error("Search error:", err);
      showNotification("❌ Failed to fetch buses. Please check the route and date.", true);
    });

  // ✅ Run the search operation with the loader
  runWithLoader(searchOperation);
});

// --------- SEAT LAYOUT (UPDATED) ---------
function loadSeatLayout(busId, busName, date) {
  selectedBusId = busId;
  selectedTravelDate = date;
  selectedSeats = [];
  window.selectedBusName = busName;

  // ✅ Define the fetch operation
  const loadLayoutOperation = Promise.all([
    fetch(`/api/seats/by-bus/${busId}`).then(res => res.json().catch(() => ({}))),
    fetch(`/user/api/booked-seats?busId=${busId}&date=${date}`).then(res => res.json().catch(() => ([]))),
    fetch(`/user/api/route/stops/${busId}`).then(res => res.json().catch(() => ([])))
  ]).then(([seatData, booked, stops]) => {
    currentSeatLayout = seatData?.seats || [];
    window.bookedSeatNumbers = booked || [];
    selectedRouteStops = Array.isArray(stops) ? stops : [];

    if (currentSeatLayout.length === 0) {
      showNotification("⚠️ No seat information available for this bus.", true);
      document.getElementById("seatLayoutContainer").style.display = "none";
      return;
    }

    if (selectedRouteStops.length < 2) {
      console.warn("Route stops not loaded or insufficient. Using default stops.");
      const fromCity = document.getElementById("fromCity").value.trim();
      const toCity = document.getElementById("toCity").value.trim();
      selectedRouteStops = [fromCity, toCity].filter(s => s);
    }

    document.getElementById("seatLayoutContainer").style.display = "block";

    // Update route information display
    const fromCity = document.getElementById("fromCity").value.trim();
    const toCity = document.getElementById("toCity").value.trim();
    document.getElementById("routeFromTo").textContent = `${fromCity} → ${toCity}`;
    document.getElementById("travelDateDisplay").textContent = date;

    const hasSeater = currentSeatLayout.some(s => s.type === 'seater');
    renderSeatLayout(hasSeater ? "seater" : "sleeper");
    showNotification(`🪑 Seats loaded for **${busName}**. Start selecting!`);
  }).catch(err => {
    console.error("Seat layout error:", err);
    showNotification("❌ Could not load seat layout or route information.", true);
  });

  // ✅ Run the load layout operation with the loader
  runWithLoader(loadLayoutOperation);
}

function renderSeatLayout(type) {
  const layoutDiv = document.getElementById("seatLayout");
  layoutDiv.innerHTML = "";

  document.querySelectorAll('.seat-type-selector').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`${type}Btn`).classList.add('active');

  const seaterLegend = document.getElementById('seaterLegend');
  const sleeperLegend = document.getElementById('sleeperLegend');

  if (type === 'seater') {
      seaterLegend.classList.add('active');
      sleeperLegend.classList.remove('active');
  } else {
      seaterLegend.classList.remove('active');
      sleeperLegend.classList.add('active');
  }

  const filtered = currentSeatLayout.filter(seat => seat.type === type);
  const lower = filtered.filter(seat => seat.deck === "lower");
  const upper = filtered.filter(seat => seat.deck === "upper");

  function renderDeck(deckName, deckSeats) {
    if (deckSeats.length === 0) {
      if (lower.length === 0 && upper.length === 0) {
        layoutDiv.innerHTML = `<p>No ${type} seats available on this bus.</p>`;
      }
      return;
    };
    layoutDiv.innerHTML += `<div class="deck-title">${deckName.charAt(0).toUpperCase() + deckName.slice(1)} Deck</div>`;
    const container = document.createElement("div");
    container.className = "seat-deck";

    deckSeats.forEach(seat => {
      const btn = document.createElement("button");
      btn.className = "seat-btn";
      btn.classList.add(seat.type);

      const isBooked = window.bookedSeatNumbers.includes(seat.number);
      const isSelected = selectedSeats.some(s => s.number === seat.number);

      if (isBooked) {
        btn.disabled = true;
        btn.classList.add("booked");
      } else {
        btn.onclick = () => toggleSeat(seat);
        if (isSelected) btn.classList.add("selected");
        else btn.classList.add("available");
      }

      // Calculate estimated fare for display
      const estimatedFare = calculateDynamicFare(seat.price);
      btn.innerHTML = `<div class="seat-info">${seat.number}<br/>₹${estimatedFare.toFixed(0)}</div>`;
      container.appendChild(btn);
    });
    layoutDiv.appendChild(container);
  }

  renderDeck("lower", lower);
  renderDeck("upper", upper);
  updateSelectionDisplay();
}

function toggleSeat(seat) {
  const index = selectedSeats.findIndex(s => s.number === seat.number);
  if (index > -1) {
    selectedSeats.splice(index, 1);
    showNotification(`Seat **${seat.number}** removed. Total Seats: ${selectedSeats.length}`);
  } else {
    if (selectedSeats.length >= 6) {
        showNotification("You can select a maximum of 6 seats per booking.", true);
        return;
    }

    // Calculate dynamic fare based on route segment
    const dynamicFare = calculateDynamicFare(seat.price);

    selectedSeats.push({
      number: seat.number,
      price: seat.price,
      dynamicFare: dynamicFare,
      type: seat.type
    });
    showNotification(`Seat **${seat.number}** selected (₹${dynamicFare.toFixed(2)}). Total Seats: ${selectedSeats.length}`);
  }
  renderSeatLayout(seat.type);
}

function calculateDynamicFare(basePrice) {
  if (!Array.isArray(selectedRouteStops) || selectedRouteStops.length < 2) {
    return basePrice; // Fallback to base price if route info is not available
  }

  const fromCity = document.getElementById("fromCity").value.trim().toLowerCase();
  const toCity = document.getElementById("toCity").value.trim().toLowerCase();

  if (!fromCity || !toCity) {
    return basePrice; // Fallback to base price if search cities are not available
  }

  // Use the exact same logic as passenger-details.js
  let newFare = 0;
  const fromIdx = selectedRouteStops.map(s => s.toLowerCase()).indexOf(fromCity);
  const toIdx = selectedRouteStops.map(s => s.toLowerCase()).lastIndexOf(toCity);

  if (fromIdx >= 0 && toIdx > fromIdx) {
    const totalSegments = selectedRouteStops.length - 1;
    if (totalSegments > 0) {
      const traveledSegments = toIdx - fromIdx;
      const ratio = traveledSegments / totalSegments;
      let calculatedFare = basePrice * ratio;

      calculatedFare = Math.round(calculatedFare * 100) / 100;
      newFare = Math.max(50, calculatedFare); // Minimum fare
    }
  }

  return newFare > 0 ? newFare : basePrice;
}

function updateSelectionDisplay() {
  const selectedList = selectedSeats.map(seat => seat.number).join(", ") || "None";
  const total = selectedSeats.reduce((sum, s) => sum + (s.dynamicFare || s.price), 0);

  document.getElementById("selectedSeatsDisplay").textContent = selectedList;
  document.getElementById("totalFare").textContent = total.toFixed(2);
  document.getElementById("proceedBtn").disabled = selectedSeats.length === 0;
}

// --------- NAVIGATION TO DETAILS PAGE (MODIFIED) ---------
function proceedToDetailsPage() {
  if (selectedSeats.length === 0) {
    showNotification("Please select at least one seat.", true);
    return;
  }

  if (!selectedBusId || !selectedTravelDate) {
      showNotification("Booking context data is missing. Please restart the search.", true);
      return;
  }

  if (!Array.isArray(selectedRouteStops) || selectedRouteStops.length < 2) {
      showNotification("Route stop information is incomplete. Cannot proceed.", true);
      console.error("Missing/Invalid selectedRouteStops:", selectedRouteStops);
      return;
  }

  const bookingData = {
    seats: selectedSeats,
    busId: selectedBusId,
    busName: window.selectedBusName || "Bus",
    travelDate: selectedTravelDate,
    routeStops: selectedRouteStops,
    userEmail: userEmail,
    userName: userName
  };

  try {
      sessionStorage.setItem('bookingDetails', JSON.stringify(bookingData));
      window.location.href = '/user/passenger-details.html';
  } catch (error) {
      console.error("Failed to store booking data in session storage:", error);
      showNotification("❌ An unexpected error occurred while preparing your booking. Check console for details.", true);
  }
}

// --------- USER BOOKINGS (UPDATED) ---------
function loadUserBookings() {
  // Return the promise so it can be wrapped by runWithLoader
  return fetch(`/user/api/bookings/by-user/${userEmail}`)
    .then(res => res.json())
    .then(bookings => {
        const container = document.getElementById("bookingList");
        if (!bookings || bookings.length === 0) {
            container.innerHTML = "<p>You have no bookings yet.</p>";
            return;
        }

        const table = `
        <div class="table-container">
          <table class="booking-table">
            <thead>
              <tr>
                <th>Bus</th><th>Date</th><th>Seat</th>
                <th>From</th><th>To</th><th>Fare</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td>${b.busName || "-"}</td>
                  <td>${b.travelDate}</td>
                  <td>${b.seatNumber}</td>
                  <td>${b.routeFrom}</td>
                  <td>${b.routeTo}</td>
                  <td>₹${b.fare.toFixed(2)}</td>
                  <td>${b.status}</td>
                  <td>${b.status === 'CONFIRMED' ? `<button onclick="downloadTicket('${b.id}')">📥 Ticket</button>` : '-'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
        container.innerHTML = table;
    });
}

function downloadTicket(bookingId) {
    // ✅ Define download operation
    const downloadOperation = fetch(`/user/api/bookings/download-ticket/${bookingId}`)
        .then(res => {
            if (!res.ok) throw new Error("Ticket not found or server error.");
            return res.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `ticket_${bookingId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            // 🚨 SUCCESS NOTIFICATION FOR MAIL/DOWNLOAD
            showNotification(`✅ Ticket sent successfully to your email and download started!`);
        })
        .catch(err => {
            console.error("Ticket download failed:", err);
            showNotification("❌ Download failed. Please try again later.", true);
        });

    runWithLoader(downloadOperation);
}