import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "@/components/LandingPage";
import ChatWidget from "@/components/ChatWidget";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
        <ChatWidget />
      </BrowserRouter>
    </div>
  );
}

export default App;
