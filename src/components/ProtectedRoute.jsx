// src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    // Lấy token trực tiếp từ localStorage để kiểm tra
    const token = localStorage.getItem('token');

    // Nếu có token, cho phép truy cập vào các route con (sử dụng <Outlet />)
    // Nếu không, chuyển hướng người dùng về trang đăng nhập
    return token ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;