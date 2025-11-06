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
import { AdminPage } from "./pages/mcb/AdminPage";
import { CaseDetailPage } from "./pages/mcb/CaseDetailPage";

function App() {
  return (
    <Routes>
      {/* Főoldal (Frakcióválasztó) */}
      <Route path="/" element={<HomePage />} />

      {/* SFSD Szekció (Layout-tal védve) */}
      <Route path="/sfsd" element={<SfsdLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="penalcode" element={<PenalCodePage />} />
        <Route path="szabalyzat" element={<SzabalyzatPage />} />
      </Route>

      {/* MCB Szekció */}
      <Route path="/mcb/login" element={<LoginPage />} />
      <Route path="/mcb/register" element={<RegisterPage />} />

      {/* Védett MCB Rendszer (Layout-tal védve) */}
      <Route path="/mcb" element={<McbLayout />}>
        <Route index element={<McbDashboard />} />
        <Route path="pending" element={<PendingApprovalPage />} />
        <Route path="admin" element={<AdminPage />} />
        {/* IDE KERÜL AZ ÚJ ÚTVONAL: */}
        <Route path="case/:caseId" element={<CaseDetailPage />} />
      </Route>

    </Routes>
  );
}

export default App;