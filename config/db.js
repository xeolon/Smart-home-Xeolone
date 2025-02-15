const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'tung',
    password: 'xeolone',
    database: 'xeolone_mariadb',
    connectionLimit: 5
});

// Kiểm tra kết nối
pool.getConnection()
    .then(conn => {
        console.log("✅ Kết nối MariaDB thành công!");
        conn.release();
    })
    .catch(err => {
        console.error("Lỗi kết nối MariaDB:", err.message);
    });

// Tạo bảng với cú pháp MariaDB
async function initializeDB() {
    let conn;
    try {
        conn = await pool.getConnection();
        
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pid VARCHAR(36) UNIQUE NOT NULL,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                bio TEXT DEFAULT 'Chưa có mô tả',
                avatar TEXT DEFAULT '/static/images/default-avatar.png',
                role ENUM('user', 'admin') DEFAULT 'user'
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                email VARCHAR(255) PRIMARY KEY,
                code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pid VARCHAR(36) UNIQUE NOT NULL,
                content TEXT NOT NULL,
                user_pid VARCHAR(36) NOT NULL,
                image TEXT,
                likes INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_pid) REFERENCES users(pid)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pid VARCHAR(36) UNIQUE NOT NULL,
                post_pid VARCHAR(36) NOT NULL,
                user_pid VARCHAR(36) NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_pid) REFERENCES posts(pid) ON DELETE CASCADE,
                FOREIGN KEY (user_pid) REFERENCES users(pid)
            )
        `);

    } catch (err) {
        console.error("Lỗi khởi tạo database:", err);
    } finally {
        if (conn) conn.release();
    }
}

initializeDB();

module.exports = pool;
