// Middleware kiểm tra quyền chỉnh sửa profile
const checkProfilePermission = (req, res, next) => {
    const targetPid = req.query.pid;
    const userPid = req.user.pid;
    const userRole = req.user.role;
    if (userRole === 'admin' || targetPid === userPid) {
        next();
    } else {
	res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này!" });
    }
};


module.exports = checkProfilePermission;
