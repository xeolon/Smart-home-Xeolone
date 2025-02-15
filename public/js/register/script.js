document.addEventListener("DOMContentLoaded", function() {
  // Toggle hiển thị mật khẩu
  const togglePasswordBtn = document.querySelector(".toggle-password");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", function() {
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

function sendVerification() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  })
  .then(response => response.json())
  .then(data => {
    showNotification(data.message, data.message.includes("đã được gửi") ? "success" : "error");
    if (data.message.includes("Mã xác minh đã được gửi")) {
      document.getElementById("verification-section").style.display = "block";
    }
  });
}

function verifyCode() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const code = document.getElementById("verification-code").value;

  fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, code })
  })
  .then(response => response.json())
  .then(data => {
    showNotification(data.message, data.message.includes("thành công") ? "success" : "error");
    if (data.message.includes("Tạo tài khoản thành công")) {
      window.location.href = "/login";
    }
  });
}

