import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/Home";
import { SfsdLayout } from "./layouts/SfsdLayout";
import { PenalCodePage } from "./pages/sfsd/PenalCode";
import { DashboardPage } from "./pages/sfsd/DashboardPage";
import { SzabalyzatPage } from "./pages/sfsd/SzabalyzatPage";
import "./App.css";

import { McbLayout } from "./layouts/McbLayout";
import { LoginPage } from "./pages/mcb/LoginPage";
import { RegisterPage } from "./pages/mcb/RegisterPage";
import { PendingApprovalPage } from "./pages/mcb/PendingApprovalPage";
import { McbDashboard } from "./pages/mcb/McbDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/sfsd" element={<SfsdLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="penalcode" element={<PenalCodePage />} />
        <Route path="szabalyzat" element={<SzabalyzatPage />} />
      </Route>

      <Route path="/mcb/login" element={<LoginPage />} />
      <Route path="/mcb/register" element={<RegisterPage />} />
      <Route path="/mcb/pending" element={<PendingApprovalPage />} />

      <Route path="/mcb" element={<McbLayout />}>
        <Route index element={<McbDashboard />} />
      </Route>

    </Routes>
  );
}

export default App;