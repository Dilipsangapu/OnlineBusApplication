document.addEventListener("DOMContentLoaded", () => {
  const fromInput = document.querySelector('input[placeholder="Enter departure city"]');
  const toInput = document.querySelector('input[placeholder="Enter destination city"]');
  const dateInput = document.querySelector('input[type="date"]');
  const searchBtn = document.querySelector(".search-btn");
  const form = document.querySelector(".search-form");
  const resultDiv = document.getElementById("searchResults");

  searchBtn.disabled = true;

  function validateInputs() {
    searchBtn.disabled = !(fromInput.value && toInput.value && dateInput.value);
  }

  fromInput.addEventListener("input", validateInputs);
  toInput.addEventListener("input", validateInputs);
  dateInput.addEventListener("change", validateInputs);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const from = fromInput.value.trim().toLowerCase();
    const to = toInput.value.trim().toLowerCase();
    const date = dateInput.value;

    if (!from || !to || !date) return;

    resultDiv.innerHTML = "<p>🔄 Searching buses...</p>";

    try {
      const res = await fetch(`/user/api/search-buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch buses");

      const buses = await res.json();
      resultDiv.innerHTML = "";

      if (buses.length === 0) {
        resultDiv.innerHTML = "<p>🚫 No buses found for the selected route and date.</p>";
        return;
      }

      for (const bus of buses) {
        const stops = await getStops(bus.busId);
        const estimatedFare = await estimateFare(bus.busId, from, to, stops);

        const card = document.createElement("div");
        card.className = "bus-card";

        card.innerHTML = `
          <h3>${bus.busName} (${bus.busType})</h3>
          <p><strong>Bus Number:</strong> ${bus.busNumber}</p>
          <p><strong>From:</strong> ${capitalize(from)} → <strong>To:</strong> ${capitalize(to)}</p>
          <p><strong>Estimated Fare:</strong> ₹${estimatedFare}</p>
          <p><strong>Departure:</strong> ${bus.departureTime} | <strong>Arrival:</strong> ${bus.arrivalTime}</p>
          <button class="book-btn" onclick="redirectToBooking('${bus.busId}', '${date}')">Book Now</button>
        `;

        resultDiv.appendChild(card);
      }
    } catch (err) {
      console.error("Error:", err);
      resultDiv.innerHTML = "<p>❌ Could not load bus data. Please try again later.</p>";
    }
  });
});

async function getStops(busId) {
  try {
    const res = await fetch(`/user/api/route/stops/${busId}`);
    return await res.json(); // already lowercase
  } catch (err) {
    console.error("Failed to fetch route stops:", err);
    return [];
  }
}

async function estimateFare(busId, from, to, stops) {
  const fromIndex = stops.indexOf(from);
  const toIndex = stops.indexOf(to);

  if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) return "N/A";

  const segmentRatio = (toIndex - fromIndex) / (stops.length - 1);

  try {
    const res = await fetch(`/api/seats/by-bus/${busId}`);
    const seatLayout = await res.json();
    const seats = seatLayout.seats || [];

    let minFare = Infinity;

    for (const seat of seats) {
      const price = seat.price || 0;
      const dynamicFare = Math.round(price * segmentRatio * 100) / 100;
      if (dynamicFare > 0) {
        minFare = Math.min(minFare, dynamicFare);
      }
    }

    return isFinite(minFare) ? minFare : "N/A";
  } catch (err) {
    console.error("Error estimating fare:", err);
    return "Error";
  }
}

function redirectToBooking(busId, date) {
  window.location.href = `/user/dashboard?busId=${busId}&date=${date}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
