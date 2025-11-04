import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/Home";
import { SfsdLayout } from "./layouts/SfsdLayout";
import { PenalCodePage } from "./pages/sfsd/PenalCode";
import { DashboardPage } from "./pages/sfsd/DashboardPage"; // ÚJ IMPORT
import { SzabalyzatPage } from "./pages/sfsd/SzabalyzatPage"; // ÚJ IMPORT
import "./App.css";

function App() {
  return (
    <Routes>
      {/* Főoldal (Frakcióválasztó) */}
      <Route path="/" element={<HomePage />} />

      {/* SFSD Szekció (Layout-tal védve) */}
      <Route path="/sfsd" element={<SfsdLayout />}>
        {/* JAVÍTÁS: Az 'index' mostantól a Dashboardra mutat */}
        <Route index element={<DashboardPage />} />
        <Route path="penalcode" element={<PenalCodePage />} />
        {/* ÚJ ÚTVONAL: */}
        <Route path="szabalyzat" element={<SzabalyzatPage />} />
      </Route>

    </Routes>
  );
}

export default App;