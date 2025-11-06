import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from "react-router-dom";
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext';

// BlockNote stíluslapok
import "@blocknote/core/fonts/inter.css";
// import "@blocknote/react/style.css"; // EZT TÖRÖLJÜK
import "@blocknote/mantine/style.css"; // EZ AZ ÚJ IMPORT

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App/>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);