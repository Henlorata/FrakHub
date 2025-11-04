import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/Home";
import { SfsdLayout } from "./layouts/SfsdLayout";
import { PenalCodePage } from "./pages/sfsd/PenalCode";
import "./App.css"; // Az üres CSS fájl

function App() {
  return (
    <Routes>
      {/* Főoldal (Frakcióválasztó) */}
      <Route path="/" element={<HomePage />} />

      {/* SFSD Szekció (Layout-tal védve) */}
      <Route path="/sfsd" element={<SfsdLayout />}>
        {/* Az 'index' az /sfsd főoldala lesz, egyelőre a PenalCode-ra irányít */}
        <Route index element={<PenalCodePage />} />
        <Route path="penalcode" element={<PenalCodePage />} />
        {/* Ide jöhetnek majd a további aloldalak, pl:
        <Route path="szabalyzat" element={<SzabalyzatPage />} />
        */}
      </Route>

      {/* Később ide jöhet az LSPD szekció:
      <Route path="/lspd" element={<LspdLayout />}>
        ...
      </Route>
      */}
    </Routes>
  );
}

export default App;