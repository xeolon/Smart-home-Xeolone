// services/Login_and_Register.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const uploadPost = multer({ dest: "public/uploads/posts/" });

require("dotenv").config();

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Route: POST /api/auth/verify
router.post("/verify", async (req, res) => {
  try {
    const { username, email, password, code } = req.body;
    const pid = uuidv4(); // Tạo pid duy nhất

    // Kiểm tra mã xác minh
    let conn = await db.getConnection();
    const rows = await conn.query(
      "SELECT * FROM verification_codes WHERE email = ?",
      [email]
    );
    conn.release();

    if (!rows[0] || rows[0].code !== code) {
      return res
        .status(400)
        .json({ message: "Mã xác minh không hợp lệ hoặc đã hết hạn" });
    }

    // Xóa mã OTP sau khi sử dụng
    conn = await db.getConnection();
    await conn.query("DELETE FROM verification_codes WHERE email = ?", [email]);
    conn.release();

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Thêm user mới vào database
    conn = await db.getConnection();
    await conn.query(
      "INSERT INTO users (pid, username, email, password) VALUES (?, ?, ?, ?)",
      [pid, username, email, hashedPassword]
    );
    conn.release();

    res.status(201).json({ message: "Tạo tài khoản thành công!" });
  } catch (error) {
    console.error("Lỗi trong /verify:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Route: POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Kiểm tra xem email đã tồn tại chưa
    let conn = await db.getConnection();
    const existingUser = await conn.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    conn.release();

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // Tạo mã xác minh ngẫu nhiên (6 chữ số)
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    // Lưu mã xác minh vào database với thời gian hết hạn (10 phút)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    conn = await db.getConnection();
    const verificationRow = await conn.query(
      "SELECT * FROM verification_codes WHERE email = ?",
      [email]
    );
    if (verificationRow.length > 0) {
      await conn.query(
        "UPDATE verification_codes SET code = ?, expires_at = ? WHERE email = ?",
        [verificationCode, expiresAt, email]
      );
    } else {
      await conn.query(
        "INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)",
        [email, verificationCode, expiresAt]
      );
    }
    conn.release();

    // Gửi email chứa mã xác minh với giao diện đẹp
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Xác thực đăng ký tài khoản</title>
  <style>
    body {
      font-family: 'Poppins', sans-serif;
      background-color: #f8f9fa;
      margin: 0;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .header img {
      width: 80px;
      margin-bottom: 10px;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }
    .content {
      text-align: center;
      padding: 20px 0;
    }
    .content p {
      font-size: 16px;
      color: #555;
      line-height: 1.5;
      margin: 10px 0;
    }
    .code {
      font-size: 28px;
      font-weight: bold;
      color: #007bff;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #888;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!-- Thay URL logo của bạn tại đây -->
      <img src="https://yourdomain.com/static/img/logo.png" alt="Logo">
      <h2>Xác Thực Đăng Ký Tài Khoản</h2>
    </div>
    <div class="content">
      <p>Xin chào ${username},</p>
      <p>Vui lòng sử dụng mã xác nhận dưới đây để hoàn tất đăng ký tài khoản của bạn. Mã này có hiệu lực trong 10 phút.</p>
      <div class="code">${verificationCode}</div>
      <p>Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Xeolone. Mọi quyền được bảo lưu.</p>
    </div>
  </div>
</body>
</html>
`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Xác thực đăng ký tài khoản",
      html: emailHtml,
    });

    res
      .status(200)
      .json({ message: "Mã xác minh đã được gửi, vui lòng kiểm tra email." });
  } catch (error) {
    console.error("Lỗi trong /register:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Route: POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    let conn = await db.getConnection();
    const userRows = await conn.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    conn.release();

    if (userRows.length === 0) {
      return res.status(400).json({ message: "Tài khoản không tồn tại" });
    }
    const user = userRows[0];

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // Tạo token JWT
    const token = jwt.sign(
      { userId: user.id, pid: user.pid, role: user.role },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Thiết lập cookie đăng nhập (1 giờ)
    res.cookie("token", token, { httpOnly: true, maxAge: 3600000 });
    res.json({ message: "Đăng nhập thành công", token });
  } catch (error) {
    console.error("Lỗi trong /login:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Route: POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token"); // Xóa cookie chứa JWT
  res.json({ message: "Đã đăng xuất" });
});

// Route: GET /api/auth/me
router.get("/me", async (req, res) => {
  if (!req.cookies.token) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }
  const token = req.cookies.token;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const conn = await db.getConnection();
    const userRows = await conn.query(
      "SELECT pid, username FROM users WHERE id = ?",
      [decoded.userId]
    );
    conn.release();
    if (userRows.length === 0) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }
    res.json(userRows[0]);
  } catch (error) {
    console.error("Lỗi trong /me:", error);
    res.status(401).json({ message: "Phiên đăng nhập hết hạn" });
  }
});

module.exports = router;

