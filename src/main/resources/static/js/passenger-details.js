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
    notif.className = `notification-message ${isError ?  'notification-error' : 'notification-success'}`;
    notif.innerHTML = message;

    notificationContainer. prepend(notif);

    setTimeout(() => {
        notif.classList.add('fade-out');

        setTimeout(() => {
            notif. remove();
        }, 500);

    }, 4500);
}

/**
 * Displays a blocking alert modal for important messages
 */
function showAlertModal(title, message, isSuccess = true) {
    // Remove existing modal if any
    const existingModal = document.getElementById('custom-alert-modal');
    if (existingModal) {
        existingModal. remove();
    }

    const modalHtml = `
        <div id="custom-alert-modal" class="alert-modal-overlay">
            <div class="alert-modal-content ${isSuccess ? 'alert-success' : 'alert-error'}">
                <div class="alert-icon">
                    ${isSuccess ? '✅' : '❌'}
                </div>
                <h2 class="alert-title">${title}</h2>
                <p class="alert-message">${message}</p>
                <button class="alert-close-btn" onclick="closeAlertModal()">OK</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAlertModal() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) {
        modal.classList. add('fade-out');
        setTimeout(() => modal.remove(), 300);
    }
}
// --- End Notification Function ---


// ✅ --- Loader Functions (COPIED from Agent/User Dashboard) ---

function showLoader() {
  // Use global variable initialized in DOMContentLoaded
  if (globalLoaderElement) {
    // 🚨 Using setProperty to guarantee display:  flex ! important
    globalLoaderElement.style. setProperty('display', 'flex', 'important');
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
    globalLoaderElement. className = 'loader-overlay';
    globalLoaderElement. innerHTML = '<div class="loader-spinner"></div>';
    document.body.appendChild(globalLoaderElement);

    // 2. Add alert modal styles
    const alertStyles = document.createElement('style');
    alertStyles. textContent = `
        .alert-modal-overlay {
            position: fixed;
            top: 0;
            left:  0;
            width: 100%;
            height: 100%;
            background:  rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index:  10000;
            animation: fadeIn 0.3s ease;
        }
        . alert-modal-overlay.fade-out {
            animation: fadeOut 0.3s ease forwards;
        }
        .alert-modal-content {
            background: white;
            padding: 30px 40px;
            border-radius: 12px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }
        .alert-modal-content.alert-success {
            border-top: 5px solid #28a745;
        }
        .alert-modal-content. alert-error {
            border-top:  5px solid #dc3545;
        }
        . alert-icon {
            font-size:  48px;
            margin-bottom: 15px;
        }
        .alert-title {
            margin:  0 0 10px 0;
            color: #333;
            font-size: 1.5rem;
        }
        .alert-message {
            color: #666;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .alert-close-btn {
            background: #008c7a;
            color: white;
            border: none;
            padding:  12px 40px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: background 0.3s;
        }
        .alert-close-btn: hover {
            background: #006b5a;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(alertStyles);

    // 3. Wrap the initial page setup in a promise to ensure the loader runs
    const initialLoadPromise = new Promise((resolve) => {
        const dataString = sessionStorage.getItem('bookingDetails');
        if (! dataString) {
            showNotification("Booking details not found!  Redirecting to dashboard.", true);
            window.location.href = '/user/dashboard';
            return;
        }
        bookingData = JSON.parse(dataString);

        if (! bookingData.routeStops || bookingData.routeStops.length === 0) {
             showNotification("Route details are missing! Redirecting.", true);
             window.location.href = '/user/dashboard';
             return;
        }

        // Initialize dynamicFare if not set (from dashboard load)
        bookingData.seats. forEach(seat => {
            seat.passengerFrom = bookingData.routeStops[0];
            seat.passengerTo = bookingData.routeStops[bookingData.routeStops.length - 1];
            // Recalculate fare as the default stops on this page might differ from the search page selection
            seat.dynamicFare = calculateDynamicFare(seat. price, bookingData.routeStops[0], bookingData.routeStops[bookingData. routeStops. length - 1]);
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
        <p><strong>Bus: </strong> ${bookingData.busName}</p>
        <p><strong>Date:</strong> ${bookingData.travelDate}</p>
        <p><strong>Seats:</strong> ${bookingData.seats.map(s => s.number).join(', ')}</p>
    `;
    const form = document.getElementById("passengerDetailsForm");
    form.innerHTML = "";

    const uniqueRouteStops = [... new Set(bookingData.routeStops)];

    bookingData.seats. forEach((seat, i) => {
        // Use initial passengerFrom/To if available, otherwise default to full route
        const initialFrom = seat.passengerFrom || uniqueRouteStops[0];
        const initialTo = seat.passengerTo || uniqueRouteStops[uniqueRouteStops. length - 1];

        const fromOptions = uniqueRouteStops.map(stop => `<option value="${stop}" ${stop === initialFrom ? 'selected' : ''}>${stop. charAt(0).toUpperCase() + stop.slice(1)}</option>`).join("");
        const toOptions = uniqueRouteStops. map(stop => `<option value="${stop}" ${stop === initialTo ? 'selected' : ''}>${stop.charAt(0).toUpperCase() + stop.slice(1)}</option>`).join("");

        form.innerHTML += `
        <div class="passenger-input-block">
          <h4>Passenger for Seat ${seat.number}</h4>
          <div class="input-group"><label>Name:  <input type="text" name="name${i}" required></label></div>
          <div class="input-group"><label>Age: <input type="number" name="age${i}" min="1" required></label></div>
          <div class="input-group"><label>Mobile: <input type="tel" name="mobile${i}" required></label></div>
          <div class="input-group"><label>Email: <input type="email" name="email${i}" value="${bookingData. userEmail || ''}" required></label></div>
          <div class="input-group"><label>From: <select name="from${i}" onchange="updateFareForSeat(${i})">${fromOptions}</select></label></div>
          <div class="input-group"><label>To: <select name="to${i}" onchange="updateFareForSeat(${i})">${toOptions}</select></label></div>
          <p>Fare: ₹<span id="fare${i}">${parseFloat(seat.dynamicFare).toFixed(2)}</span></p>
        </div>`;
    });
    updateTotalDisplay();
}

function calculateDynamicFare(basePrice, from, to) {
    const stops = bookingData.routeStops;

    if (! stops || stops.length < 2 || !from || ! to) {
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
    if (! isPageLoaded) return;

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
    document.getElementById(`fare${i}`).textContent = seat.dynamicFare. toFixed(2);
    updateTotalDisplay();
}

function updateTotalDisplay() {
    const total = bookingData. seats.reduce((sum, s) => sum + (s.dynamicFare || 0), 0);
    document.getElementById("finalFare").innerHTML = `<strong>Total Fare:</strong> ₹${total.toFixed(2)}`;
}

// =======================================================
// --- CONFIRM BOOKING / PAYMENT (UPDATED WITH ALERTS) ---
// =======================================================
function confirmBooking() {
    const form = document.getElementById("passengerDetailsForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        showNotification("❗ Please fill out all required passenger fields.", true);
        return;
    }

    const formData = new FormData(form);
    const passengers = bookingData.seats. map((seat, i) => ({
        seatNumber: seat. number,
        fare: seat.dynamicFare,
        passengerFrom: seat.passengerFrom,
        passengerTo:  seat.passengerTo,
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
        return res. json();
    })
    .then(order => {
        if (! order || !order.id) {
            throw new Error("Invalid order response from server.");
        }

        // Hide loader temporarily to allow Razorpay dialog to open
        hideLoader();

        const options = {
            key: "rzp_test_38I5IEufjhiOFj",
            amount: order.amount,
            currency: order.currency,
            name: "Online Bus Booking",
            description:  `Payment for ${passengers.length} seat(s)`,
            order_id: order. id,
            handler: function(response) {
                // ✅ PAYMENT SUCCESSFUL - Now proceed with booking and email
                showLoader();

                const bookingPromises = passengers.map(p => fetch("/user/api/bookings/book", {
                    method: "POST",
                    headers:  { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        busId: bookingData.busId,
                        travelDate: bookingData. travelDate,
                        customerEmail: bookingData. userEmail,
                        seatNumber: p.seatNumber,
                        fare: p.fare,
                        passengerName: p.name,
                        passengerAge: p.age,
                        passengerMobile: p.mobile,
                        passengerFrom: p.passengerFrom,
                        passengerTo: p.passengerTo,
                        passengerEmail: p.email,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId:  response.razorpay_order_id,
                    })
                }));

                Promise.all(bookingPromises)
                    . then(responses => {
                        const allOk = responses. every(res => res.ok);
                        if (! allOk) {
                            throw new Error("One or more bookings failed on the server.");
                        }

                        // ✅ BOOKING SUCCESSFUL - Now send email (only after payment success)
                        return fetch("/user/api/finalize-booking", {
                            method:  "POST",
                            headers: { "Content-Type": "application/json" },
                            body:  JSON.stringify({
                                email: bookingData.userEmail,
                                busId: bookingData.busId,
                                travelDate: bookingData. travelDate,
                                seatNumbers: passengers.map(p => p.seatNumber)
                            })
                        })
                        .then(res => res. text())
                        .then(message => {
                            console.log("Finalize response:", message);
                            hideLoader();

                            if (message.includes("successfully")) {
                                // ✅ SUCCESS ALERT:  Booking successful + Mail sent
                                sessionStorage.setItem('emailStatus', 'sent');
                                showAlertModal(
                                    "Booking Successful!  🎉",
                                    "Your booking has been confirmed and a confirmation email has been sent to your registered email address.",
                                    true
                                );
                            } else {
                                // ⚠️ Booking successful but email failed
                                sessionStorage.setItem('emailStatus', 'failed');
                                showAlertModal(
                                    "Booking Successful!  🎉",
                                    "Your booking has been confirmed!  However, we couldn't send the confirmation email. Please check your bookings in the dashboard.",
                                    true
                                );
                            }

                            // Set the flag for the dashboard to read
                            sessionStorage.setItem('bookingStatus', 'success');
                            sessionStorage.removeItem('bookingDetails');

                            // Redirect after user clicks OK on the alert
                            setTimeout(() => {
                                const modal = document.getElementById('custom-alert-modal');
                                if (modal) {
                                    modal. querySelector('.alert-close-btn').addEventListener('click', () => {
                                        window.location.href = '/user/dashboard';
                                    });
                                }
                            }, 100);

                            // Auto redirect after 5 seconds if user doesn't click
                            setTimeout(() => {
                                window.location.href = '/user/dashboard';
                            }, 5000);
                        })
                        .catch(err => {
                            console.error("Email sending failed:", err);
                            hideLoader();
                            sessionStorage.setItem('emailStatus', 'failed');

                            // ⚠️ Booking successful but email failed
                            showAlertModal(
                                "Booking Successful! 🎉",
                                "Your booking has been confirmed!  However, we couldn't send the confirmation email.  Please check your bookings in the dashboard.",
                                true
                            );

                            sessionStorage.setItem('bookingStatus', 'success');
                            sessionStorage.removeItem('bookingDetails');

                            setTimeout(() => {
                                window.location.href = '/user/dashboard';
                            }, 5000);
                        });

                    }).catch(err => {
                        console.error("Booking Finalization Error:", err);
                        hideLoader();

                        // ❌ Payment successful but booking save failed
                        showAlertModal(
                            "Booking Error ⚠️",
                            `Payment was successful, but there was an error saving your booking. Please contact support with Order ID: ${response. razorpay_order_id}`,
                            false
                        );
                    });
            },
            prefill: {
                name: bookingData. userName || '',
                email: bookingData.userEmail || '',
            },
            theme: { color:  "#008c7a" },
            modal: {
                ondismiss: function() {
                    // User closed the payment modal without completing payment
                    showNotification("⚠️ Payment cancelled.  Please try again to complete your booking.", true);
                }
            }
        };
        const rzp = new Razorpay(options);

        // ❌ PAYMENT FAILED HANDLER
        rzp.on('payment.failed', function (response){
            console.error("Payment Failed:", response);

            // ❌ FAILURE ALERT:  Payment failed, booking unsuccessful
            // Email is NOT sent because payment failed
            showAlertModal(
                "Payment Failed ❌",
                `Your payment could not be processed.  Reason: ${response. error. description || 'Unknown error'}. No booking has been made and no email will be sent.  Please try again.`,
                false
            );
        });

        rzp.open();

        // Return a promise that prevents runWithLoader from immediately completing
        return new Promise(() => {});
    })
    .catch(err => {
        console. error("Payment Initiation Error:", err);

        // ❌ FAILURE ALERT: Could not initiate payment
        showAlertModal(
            "Payment Error ❌",
            `Could not initiate payment.  ${err.message}. Please try again later.`,
            false
        );

        // Throw to let runWithLoader handle final hideLoader
        throw err;
    });

    // Run the initial payment order creation with the loader
    runWithLoader(paymentOperation);
}