// ==================================
// 1. ADD THIS TOAST FUNCTION
// ==================================
/**
 * Displays a toast notification.
 * @param {string} message The message to display.
 * @param {string} type 'success' or 'error'.
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return; // Safety check

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}


document.addEventListener("DOMContentLoaded", () => {
  // Loader functions
  const loadingOverlay = document.getElementById('loadingOverlay');

  function showLoader() {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
  }

  function hideLoader() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }

  // Make showSection globally accessible
  window.showSection = function (sectionId) {
    document.getElementById("addAgentSection").style.display = sectionId === "addAgent" ? "block" : "none";
    document.getElementById("viewAgentsSection").style.display = sectionId === "viewAgents" ? "block" : "none";

    if (sectionId === "viewAgents") loadAgents();
  };

  console.log("✅ admin.js loaded");

  // Submit agent form
  document.getElementById("agentForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const form = e.target;

    showLoader();

    const name = form.name.value.trim();
    const contactPerson = form.contactPerson.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const phone = form.phone.value.trim();
    const password = form.password.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    // ==================================
    // 2. REPLACE alert() WITH showToast()
    // ==================================
    if (!name || !contactPerson || !email || !phone || !password || !confirmPassword) {
      showToast("❌ All fields are required.", "error");
      hideLoader();
      return;
    }

    if (password !== confirmPassword) {
      showToast("❌ Passwords do not match.", "error");
      hideLoader();
      return;
    }

    const agent = {
      name,
      contactPerson,
      email,
      phone,
      password,
      role: "AGENT"
    };

    fetch("/agent/api/agents/add", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent)
    })
      .then(res => res.ok ? res.text() : res.text().then(msg => { throw new Error(msg); }))
      .then(msg => {
        showToast(msg, "success"); // Replaced alert()
        form.reset();
      })
      .catch(err => {
        showToast(err.message, "error"); // Replaced alert()
      })
      .finally(() => {
        hideLoader();
      });
  });

  function loadAgents() {
    showLoader();

    fetch("/agent/api/agents/all", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        const container = document.getElementById("agentList");
        container.innerHTML = "";

        if (!data.length) {
          container.innerHTML = "<p>No agents registered yet.</p>";
          return;
        }

        data.forEach(agent => {
          const card = document.createElement("div");
          card.className = "agent-card";
          card.innerHTML = `
            <h4>${agent.name}</h4>
            <p>Contact Person: ${agent.contactPerson}</p>
            <p>Email: ${agent.email}</p>
            <p>Phone: ${agent.phone}</p>
          `;
          container.appendChild(card);
        });
      })
      .catch(err => {
        // Also show a toast on load error
        showToast(`Error loading agents: ${err.message}`, "error");
        document.getElementById("agentList").innerHTML = `<p>Error loading agents: ${err.message}</p>`;
      })
      .finally(() => {
        hideLoader();
      });
  }
});