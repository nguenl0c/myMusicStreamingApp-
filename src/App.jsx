import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./pages/home";
import Callback from "./pages/auth/callBack";
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