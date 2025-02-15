// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

const db = require("./config/db"); // Sử dụng pool của MariaDB
const checkAuth = require("./middlewares/auth");
const checkProfilePermission = require("./middlewares/checkProfilePermission");
const authLogin_and_Register = require("./services/Login_and_Register");

const API_routes = require("./routes/apiRoutes");
const WEB_routes = require("./routes/webRoutes");

dotenv.config();
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Cho phép truy cập các file tĩnh (CSS, JS, ảnh, …)
app.use("/static", express.static(path.join(__dirname, "public")));

// Multer cho upload ảnh bài viết và avatar
const uploadPost = multer({ dest: "./public/uploads/posts/" });
const uploadAvatar = multer({ dest: "./public/uploads" });

// Middleware resize ảnh bằng sharp (áp dụng cho bài viết)
const resizeImage = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const optimizedPath = `public/uploads/posts/optimized-${req.file.filename}.jpeg`;
    await sharp(req.file.path)
      .resize(800, 800, { fit: "inside" })
      .toFormat("jpeg", { quality: 80 })
      .toFile(optimizedPath);
    // Xóa file gốc
    fs.unlinkSync(req.file.path);
    // Cập nhật lại tên file cho route sử dụng
    req.file.filename = `optimized-${req.file.filename}.jpeg`;
    next();
  } catch (err) {
    console.error("Lỗi xử lý ảnh:", err);
    next(err);
  }
};

// Sử dụng các router đã định nghĩa khác (API, Web, Auth,…)
app.use("/api/auth", API_routes);
app.use("/", WEB_routes);

// Nếu có controller riêng cho auth (Login & Register) cũng dùng như sau:
app.use("/api/auth", authLogin_and_Register);

// Lấy thông tin người dùng theo pid
app.get("/api/profile", async (req, res) => {
  const { pid } = req.query;
  if (!pid) return res.status(400).json({ message: "Thiếu pid" });

  let conn;
  try {
    conn = await db.getConnection();
    const rows = await conn.query(
      "SELECT username, email, bio, avatar, role FROM users WHERE pid = ?",
      [pid]
    );
    conn.release();

    if (!rows[0])
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    res.json(rows[0]);
  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ message: "Lỗi database" });
  }
});

// Cập nhật profile (chỉ admin hoặc chủ sở hữu)
app.put(
  "/api/profile",
  checkAuth,
  checkProfilePermission,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    const { pid } = req.query;
    const { username, bio } = req.body;
    // Nếu có file upload thì tạo đường dẫn mới cho avatar
    const avatar = req.file ? `/static/uploads/${req.file.filename}` : null;
    let conn;
    try {
      // Lấy avatar hiện tại của user
      conn = await db.getConnection();
      const rows = await conn.query("SELECT avatar FROM users WHERE pid = ?", [
        pid,
      ]);
      conn.release();

      if (!rows[0])
        return res.status(404).json({ message: "Người dùng không tồn tại" });

      const user = rows[0];
      // Nếu có avatar cũ và không phải default, xóa file cũ
      if (user.avatar && user.avatar !== "/static/default-avatar.png") {
        const oldAvatarPath = path.join(
          __dirname,
          "public",
          user.avatar.replace("/static/", "")
        );
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }

      // Cập nhật thông tin user
      conn = await db.getConnection();
      await conn.query(
        "UPDATE users SET username = ?, bio = ?, avatar = ? WHERE pid = ?",
        [username, bio, avatar, pid]
      );
      conn.release();

      res.json({ message: "Cập nhật hồ sơ thành công" });
    } catch (err) {
      if (conn) conn.release();
      console.error("Lỗi cập nhật hồ sơ:", err);
      res.status(500).json({ message: "Lỗi khi cập nhật hồ sơ" });
    }
  }
);

// Tạo bài viết (áp dụng middleware resizeImage)
app.post(
  "/api/auth/posts",
  checkAuth,
  uploadPost.single("image"),
  resizeImage,
  async (req, res) => {
    const { content } = req.body;
    const user_pid = req.user.pid;
    const image = req.file ? `/static/uploads/posts/${req.file.filename}` : null;
    const post_pid = uuidv4();

    if (!content)
      return res
        .status(400)
        .json({ message: "Không có nội dung bài viết!" });

    let conn;
    try {
      conn = await db.getConnection();
      await conn.query(
        "INSERT INTO posts (pid, content, user_pid, image) VALUES (?, ?, ?, ?)",
        [post_pid, content, user_pid, image]
      );
      conn.release();
      res.json({ message: "Đăng bài thành công!", post_pid });
    } catch (err) {
      if (conn) conn.release();
      console.error("Lỗi khi đăng bài:", err);
      res.status(500).json({ message: "Lỗi khi đăng bài" });
    }
  }
);

// Lấy bài viết có phân trang
app.get("/api/auth/posts", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5; // Số bài viết mỗi trang
  const offset = (page - 1) * limit;
  let conn;
  try {
    conn = await db.getConnection();
    const posts = await conn.query(
      `SELECT posts.*, users.username, users.avatar
       FROM posts
       JOIN users ON posts.user_pid = users.pid
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    conn.release();
    res.json(posts);
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi khi tải bài viết:", err);
    res.status(500).json({ message: "Lỗi khi tải bài viết" });
  }
});

// Thả tim (like) bài viết
app.put("/api/auth/posts/:pid/like", checkAuth, async (req, res) => {
  const post_pid = req.params.pid;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query("UPDATE posts SET likes = likes + 1 WHERE pid = ?", [
      post_pid,
    ]);
    conn.release();
    res.json({ message: "Đã thả tim ❤️" });
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi khi like bài:", err);
    res.status(500).json({ message: "Lỗi khi like bài" });
  }
});

// Thêm bình luận
app.post("/api/auth/comments", checkAuth, async (req, res) => {
  const { post_pid, content } = req.body;
  const user_pid = req.user.pid;
  const comment_pid = uuidv4();
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(
      "INSERT INTO comments (pid, post_pid, user_pid, content) VALUES (?, ?, ?, ?)",
      [comment_pid, post_pid, user_pid, content]
    );
    conn.release();
    res.json({ message: "Đã bình luận!", comment_pid });
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi khi đăng bình luận:", err);
    res.status(500).json({ message: "Lỗi khi đăng bình luận" });
  }
});

// Lấy bình luận theo bài viết
app.get("/api/auth/comments/:post_pid", async (req, res) => {
  const post_pid = req.params.post_pid;
  let conn;
  try {
    conn = await db.getConnection();
    const comments = await conn.query(
      `SELECT comments.*, users.username, users.avatar
       FROM comments
       JOIN users ON comments.user_pid = users.pid
       WHERE post_pid = ?
       ORDER BY created_at DESC`,
      [post_pid]
    );
    conn.release();
    res.json(comments);
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi khi tải bình luận:", err);
    res.status(500).json({ message: "Lỗi khi tải bình luận" });
  }
});

// Lấy bài viết theo user_pid
app.get("/api/auth/posts/user/:user_pid", async (req, res) => {
  const user_pid = req.params.user_pid;
  let conn;
  try {
    conn = await db.getConnection();
    const posts = await conn.query(
      `SELECT posts.*, users.username, users.avatar
       FROM posts
       JOIN users ON posts.user_pid = users.pid
       WHERE posts.user_pid = ?
       ORDER BY created_at DESC`,
      [user_pid]
    );
    conn.release();
    res.json(posts);
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi khi tải bài viết:", err);
    res.status(500).json({ message: "Lỗi khi tải bài viết" });
  }
});

// Route admin dashboard (không có thao tác DB)
app.get("/admin/dashboard", checkAuth, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).send("Truy cập bị từ chối!");
  }
  res.sendFile(
    path.join(__dirname, "./views/profile/admin/admin_dashboard.html")
  );
});

// DELETE /api/auth/posts/:pid - Xoá bài viết
app.delete("/api/auth/posts/:pid", checkAuth, async (req, res) => {
  const postPid = req.params.pid;
  let conn;
  try {
    conn = await db.getConnection();
    // Lấy bài viết để kiểm tra quyền (chỉ chủ bài hoặc admin mới được xoá)
    const posts = await conn.query("SELECT user_pid, image FROM posts WHERE pid = ?", [postPid]);
    if (posts.length === 0) {
      conn.release();
      return res.status(404).json({ message: "Bài viết không tồn tại" });
    }
    const post = posts[0];
    // Kiểm tra quyền: nếu người dùng không phải chủ bài và không phải admin
    if (req.user.pid !== post.user_pid && req.user.role !== "admin") {
      conn.release();
      return res.status(403).json({ message: "Bạn không có quyền xoá bài viết này" });
    }

    // Nếu bài viết có ảnh, có thể xoá file ảnh khỏi server (nếu cần)
    if (post.image) {
      const imagePath = path.join(__dirname, "public", post.image.replace("/static/", ""));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Xoá bài viết khỏi database
    await conn.query("DELETE FROM posts WHERE pid = ?", [postPid]);
    conn.release();

    res.json({ message: "Bài viết đã được xoá" });
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi xoá bài viết:", err);
    res.status(500).json({ message: "Lỗi khi xoá bài viết" });
  }
});


// PUT /api/auth/posts/:pid - Chỉnh sửa bài viết
app.put("/api/auth/posts/:pid", checkAuth, async (req, res) => {
  const postPid = req.params.pid;
  const { content } = req.body;
  // (Nếu có upload hình ảnh mới, bạn có thể tích hợp multer vào đây)
  if (!content) {
    return res.status(400).json({ message: "Nội dung bài viết không được để trống" });
  }

  let conn;
  try {
    conn = await db.getConnection();
    // Lấy bài viết hiện tại để kiểm tra quyền
    const posts = await conn.query("SELECT user_pid FROM posts WHERE pid = ?", [postPid]);
    if (posts.length === 0) {
      conn.release();
      return res.status(404).json({ message: "Bài viết không tồn tại" });
    }
    const post = posts[0];
    if (req.user.pid !== post.user_pid && req.user.role !== "admin") {
      conn.release();
      return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa bài viết này" });
    }

    // Cập nhật nội dung bài viết
    await conn.query("UPDATE posts SET content = ? WHERE pid = ?", [content, postPid]);
    conn.release();

    res.json({ message: "Bài viết đã được cập nhật" });
  } catch (err) {
    if (conn) conn.release();
    console.error("Lỗi cập nhật bài viết:", err);
    res.status(500).json({ message: "Lỗi khi cập nhật bài viết" });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server đang chạy tại http://localhost:${PORT}`)
);

