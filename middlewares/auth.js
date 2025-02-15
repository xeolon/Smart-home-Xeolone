const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey";

const checkAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect("/login");
    }
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.redirect("/login");
        }
        req.user = {
            userId: decoded.userId,
            pid: decoded.pid,
            role: decoded.role
        };
        next();
    });
};

module.exports = checkAuth;

