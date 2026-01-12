import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import WebARDemo from "@/pages/WebARDemo";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/webar" replace />} />
        <Route path="/webar" element={<WebARDemo />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
