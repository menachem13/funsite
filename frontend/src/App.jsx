import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Browse from "./pages/Browse";
import ListingDetail from "./pages/ListingDetail";
import DashboardHome from "./pages/dashboard/DashboardHome";
import ListingForm from "./pages/dashboard/ListingForm";
import Inbox from "./pages/Inbox";
import AdminLogin from "./pages/AdminLogin";
import AdminCoupons from "./pages/AdminCoupons";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/listings/:id" element={<ListingDetail />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["owner"]}>
                <DashboardHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/new"
            element={
              <ProtectedRoute roles={["owner"]}>
                <ListingForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:id/edit"
            element={
              <ProtectedRoute roles={["owner"]}>
                <ListingForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inbox"
            element={
              <ProtectedRoute roles={["owner", "renter"]}>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox/:threadId"
            element={
              <ProtectedRoute roles={["owner", "renter"]}>
                <Inbox />
              </ProtectedRoute>
            }
          />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/coupons"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminCoupons />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
