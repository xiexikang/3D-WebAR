import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import WebARDemo from "@/pages/WebARDemo";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/webar" element={<WebARDemo />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
