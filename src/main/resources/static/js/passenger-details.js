let bookingData = {};
let isPageLoaded = false;
let globalLoaderElement = null; // Variable to hold the loader element reference

// ✅ --- Custom Notification Function (No Change) ---
const notificationContainer = document.getElementById("notification-container");

/**
 * Displays a custom, non-blocking notification at the top right.
 */
function showNotification(message, isError = false) {
    if (!notificationContainer) return;

    if (notificationContainer.children.length > 5) {
        notificationContainer.lastChild.remove();
    }

    const notif = document.createElement("div");
    notif.className = `notification-message ${isError ? 'notification-error' : 'notification-success'}`;
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


// ✅ --- Loader Functions (COPIED from Agent/User Dashboard) ---

function showLoader() {
  // Use global variable initialized in DOMContentLoaded
  if (globalLoaderElement) {
    // 🚨 Using setProperty to guarantee display: flex !important
    globalLoaderElement.style.setProperty('display', 'flex', 'important');
  }
}

function hideLoader() {
  if (globalLoaderElement) {
    globalLoaderElement.style.setProperty('display', 'none', 'important');
  }
}

/**
 * Shows loader and ensures it's visible for at least 1 second
 * while the provided async operation completes.
 * NOTE: Since this page only loads static content + session data, we'll use a dummy promise
 * to enforce the 1-second delay for visual consistency.
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


document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize the global loader element immediately
    globalLoaderElement = document.createElement('div');
    globalLoaderElement.id = 'loader-overlay';
    globalLoaderElement.className = 'loader-overlay';
    globalLoaderElement.innerHTML = '<div class="loader-spinner"></div>';
    document.body.appendChild(globalLoaderElement);

    // 2. Wrap the initial page setup in a promise to ensure the loader runs
    const initialLoadPromise = new Promise((resolve) => {
        const dataString = sessionStorage.getItem('bookingDetails');
        if (!dataString) {
            showNotification("Booking details not found! Redirecting to dashboard.", true);
            window.location.href = '/user/dashboard';
            return;
        }
        bookingData = JSON.parse(dataString);

        if (!bookingData.routeStops || bookingData.routeStops.length === 0) {
             showNotification("Route details are missing! Redirecting.", true);
             window.location.href = '/user/dashboard';
             return;
        }

        // Initialize dynamicFare if not set (from dashboard load)
        bookingData.seats.forEach(seat => {
            seat.passengerFrom = bookingData.routeStops[0];
            seat.passengerTo = bookingData.routeStops[bookingData.routeStops.length - 1];
            // Recalculate fare as the default stops on this page might differ from the search page selection
            seat.dynamicFare = calculateDynamicFare(seat.price, bookingData.routeStops[0], bookingData.routeStops[bookingData.routeStops.length - 1]);
        });

        renderPage();

        document.getElementById("confirmBookingBtn").addEventListener("click", confirmBooking);

        // This marks the static content ready
        setTimeout(() => {
            isPageLoaded = true;
            resolve();
        }, 10);
    });

    // Run the initial load logic with the loader
    runWithLoader(initialLoadPromise);
});

function renderPage() {
    const summaryDiv = document.getElementById("bookingSummary");
    summaryDiv.innerHTML = `
        <p><strong>Bus:</strong> ${bookingData.busName}</p>
        <p><strong>Date:</strong> ${bookingData.travelDate}</p>
        <p><strong>Seats:</strong> ${bookingData.seats.map(s => s.number).join(', ')}</p>
    `;
    const form = document.getElementById("passengerDetailsForm");
    form.innerHTML = "";

    const uniqueRouteStops = [...new Set(bookingData.routeStops)];

    bookingData.seats.forEach((seat, i) => {
        // Use initial passengerFrom/To if available, otherwise default to full route
        const initialFrom = seat.passengerFrom || uniqueRouteStops[0];
        const initialTo = seat.passengerTo || uniqueRouteStops[uniqueRouteStops.length - 1];

        const fromOptions = uniqueRouteStops.map(stop => `<option value="${stop}" ${stop === initialFrom ? 'selected' : ''}>${stop.charAt(0).toUpperCase() + stop.slice(1)}</option>`).join("");
        const toOptions = uniqueRouteStops.map(stop => `<option value="${stop}" ${stop === initialTo ? 'selected' : ''}>${stop.charAt(0).toUpperCase() + stop.slice(1)}</option>`).join("");

        form.innerHTML += `
        <div class="passenger-input-block">
          <h4>Passenger for Seat ${seat.number}</h4>
          <div class="input-group"><label>Name: <input type="text" name="name${i}" required></label></div>
          <div class="input-group"><label>Age: <input type="number" name="age${i}" min="1" required></label></div>
          <div class="input-group"><label>Mobile: <input type="tel" name="mobile${i}" required></label></div>
          <div class="input-group"><label>Email: <input type="email" name="email${i}" value="${bookingData.userEmail || ''}" required></label></div>
          <div class="input-group"><label>From: <select name="from${i}" onchange="updateFareForSeat(${i})">${fromOptions}</select></label></div>
          <div class="input-group"><label>To: <select name="to${i}" onchange="updateFareForSeat(${i})">${toOptions}</select></label></div>
          <p>Fare: ₹<span id="fare${i}">${parseFloat(seat.dynamicFare).toFixed(2)}</span></p>
        </div>`;
    });
    updateTotalDisplay();
}

function calculateDynamicFare(basePrice, from, to) {
    const stops = bookingData.routeStops;

    if (!stops || stops.length < 2 || !from || !to) {
        return basePrice;
    }

    const fromCity = from.toLowerCase();
    const toCity = to.toLowerCase();

    let newFare = 0;
    const fromIdx = stops.map(s => s.toLowerCase()).indexOf(fromCity);
    const toIdx = stops.map(s => s.toLowerCase()).lastIndexOf(toCity);

    if (fromIdx >= 0 && toIdx > fromIdx) {
        const totalSegments = stops.length - 1;
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


function updateFareForSeat(i) {
    if (!isPageLoaded) return;

    const form = document.getElementById("passengerDetailsForm");
    const from = form.querySelector(`[name="from${i}"]`).value;
    const to = form.querySelector(`[name="to${i}"]`).value;
    const seat = bookingData.seats[i];
    const basePrice = parseFloat(seat.price);
    if (isNaN(basePrice)) return;

    let newFare = 0;
    const fromIdx = bookingData.routeStops.map(s => s.toLowerCase()).indexOf(from.toLowerCase());
    const toIdx = bookingData.routeStops.map(s => s.toLowerCase()).lastIndexOf(to.toLowerCase());

    if (fromIdx >= 0 && toIdx > fromIdx) {
        const totalSegments = bookingData.routeStops.length - 1;
        if (totalSegments > 0) {
            const traveledSegments = toIdx - fromIdx;
            const ratio = traveledSegments / totalSegments;
            let calculatedFare = basePrice * ratio;

            calculatedFare = Math.round(calculatedFare * 100) / 100;
            newFare = Math.max(50, calculatedFare); // Minimum fare
        }
    } else if (fromIdx >= toIdx) {
        newFare = 0;
        showNotification("⚠️ Invalid route selected (Destination before Origin). Fare set to ₹0.", true);
    }

    seat.dynamicFare = newFare;
    seat.passengerFrom = from;
    seat.passengerTo = to;
    document.getElementById(`fare${i}`).textContent = seat.dynamicFare.toFixed(2);
    updateTotalDisplay();
}

function updateTotalDisplay() {
    const total = bookingData.seats.reduce((sum, s) => sum + (s.dynamicFare || 0), 0);
    document.getElementById("finalFare").innerHTML = `<strong>Total Fare:</strong> ₹${total.toFixed(2)}`;
}

// =======================================================
// --- CONFIRM BOOKING / PAYMENT (UPDATED) ---
// =======================================================
function confirmBooking() {
    const form = document.getElementById("passengerDetailsForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        showNotification("❗ Please fill out all required passenger fields.", true);
        return;
    }

    const formData = new FormData(form);
    const passengers = bookingData.seats.map((seat, i) => ({
        seatNumber: seat.number,
        fare: seat.dynamicFare,
        passengerFrom: seat.passengerFrom,
        passengerTo: seat.passengerTo,
        name: formData.get(`name${i}`),
        age: formData.get(`age${i}`),
        mobile: formData.get(`mobile${i}`),
        email: formData.get(`email${i}`) || bookingData.userEmail
    }));

    const totalAmountInPaise = passengers.reduce((sum, p) => sum + p.fare, 0) * 100;

    if (totalAmountInPaise <= 0) {
        showNotification("Total fare must be greater than 0. Please select a valid route.", true);
        return;
    }

    // Start the whole payment process with the loader
    const paymentOperation = fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `amount=${totalAmountInPaise}&currency=INR`
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to create payment order.");
        return res.json();
    })
    .then(order => {
        if (!order || !order.id) {
            throw new Error("Invalid order response from server.");
        }

        // Hide loader temporarily to allow Razorpay dialog to open
        hideLoader();

        const options = {
            key: "rzp_test_38I5IEufjhiOFj",
            amount: order.amount,
            currency: order.currency,
            name: "Online Bus Booking",
            description: `Payment for ${passengers.length} seat(s)`,
            order_id: order.id,
            handler: function(response) {
                // Show loader immediately after payment success, before server calls begin
                showLoader();

                const bookingPromises = passengers.map(p => fetch("/user/api/bookings/book", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        busId: bookingData.busId,
                        travelDate: bookingData.travelDate,
                        customerEmail: bookingData.userEmail,
                        seatNumber: p.seatNumber,
                        fare: p.fare,
                        passengerName: p.name,
                        passengerAge: p.age,
                        passengerMobile: p.mobile,
                        passengerFrom: p.passengerFrom,
                        passengerTo: p.passengerTo,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id,
                    })
                }));

                Promise.all(bookingPromises)
                    .then(responses => {
                        const allOk = responses.every(res => res.ok);
                        if (!allOk) {
                            throw new Error("One or more bookings failed on the server.");
                        }

                        // 1. Show Success Notification Immediately (before final background tasks)
                        showNotification("🎉 Booking & Payment Successful! Redirecting...", false);

                        // 2. "Fire and Forget" the email/ticket generation.
                        fetch("/user/api/finalize-booking", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                email: bookingData.userEmail,
                                busId: bookingData.busId,
                                travelDate: bookingData.travelDate,
                                seatNumbers: passengers.map(p => p.seatNumber)
                            })
                        })
                        .then(res => res.text())
                        .then(message => {
                            console.log("Finalize response:", message);
                            if (message.includes("successfully")) {
                                sessionStorage.setItem('emailStatus', 'sent');
                            } else {
                                sessionStorage.setItem('emailStatus', 'failed');
                            }
                        })
                        .catch(err => {
                            console.error("Email sending failed:", err);
                            sessionStorage.setItem('emailStatus', 'failed');
                        });


                        // Set the flag for the dashboard to read
                        sessionStorage.setItem('bookingStatus', 'success');

                        // 3. Clear session and redirect.
                        sessionStorage.removeItem('bookingDetails');
                        // Use a short delay to ensure loader shows for a moment after success
                        setTimeout(() => {
                            window.location.href = '/user/dashboard';
                        }, 500);

                    }).catch(err => {
                        console.error("Booking Finalization Error:", err);
                        showNotification("❌ Payment was successful, but there was an error saving your booking. Contact support. Order ID: ".concat(response.razorpay_order_id), true);
                    }).finally(hideLoader); // Ensure loader hides if booking fails
            },
            prefill: {
                name: bookingData.userName || '',
                email: bookingData.userEmail || '',
            },
            theme: { color: "#008c7a" }
        };
        const rzp = new Razorpay(options);

        rzp.on('payment.failed', function (response){
            console.error("Payment Failed:", response);
            showNotification(`❌ Payment Failed: ${response.error.description || 'Unknown error'}. Please try again.`, true);
        });

        rzp.open();

        // Return a promise that prevents runWithLoader from immediately completing
        return new Promise(() => {});
    })
    .catch(err => {
        console.error("Payment Initiation Error:", err);
        showNotification("❌ Could not initiate payment. Please try again. ".concat(err.message), true);
        // Throw to let runWithLoader handle final hideLoader
        throw err;
    });

    // Run the initial payment order creation with the loader
    runWithLoader(paymentOperation);
}