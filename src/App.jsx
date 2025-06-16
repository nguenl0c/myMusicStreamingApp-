import React from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./screens/home";
import Callback from "./screens/auth/callBack";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/*" element={<Home />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}