document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();
    if (response.ok) {
      document.cookie = `auth=${result.token}; path=/`;
      window.location.href = "/";
    } else {
      showNotification(result.message, "error");
    }
  });

  // Toggle hiển thị mật khẩu
  const togglePasswordBtn = document.querySelector(".toggle-password");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", function () {
      const passwordInput = document.getElementById("password");
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        this.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        passwordInput.type = "password";
        this.innerHTML = '<i class="fas fa-eye"></i>';
      }
    });
  }
});

function showNotification(message, type = "error") {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = message;
  messageDiv.className = "notification " + type + " show";
  setTimeout(() => {
    messageDiv.classList.remove("show");
  }, 3000);
}

