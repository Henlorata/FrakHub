import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import {AuthProvider} from "@/context/AuthContext";
import {SystemStatusProvider} from "@/context/SystemStatusContext";
import {Toaster} from "@/components/ui/sonner";
// Layout
import {AppLayout} from "@/layouts/AppLayout";
// Oldalak
import {LoginPage} from "@/pages/auth/LoginPage";
import {RegisterPage} from "@/pages/auth/RegisterPage";
import {DashboardPage} from "@/pages/dashboard/DashboardPage";
import {HrPage} from "@/pages/hr/HrPage";
import {McbDashboard} from "@/pages/mcb/McbDashboard";
import {CaseDetailPage} from "@/pages/mcb/CaseDetailPage";
import {ProfilePage} from "@/pages/profile/ProfilePage.tsx";
import {LogisticsPage} from "@/pages/logistics/LogisticsPage.tsx";
import {FinancePage} from "@/pages/logistics/FinancePage.tsx";
import {ResourcesPage} from "@/pages/resources/ResourcesPage.tsx";
import {CalculatorPage} from "@/pages/calculator/CalculatorPage.tsx";
import {AdminPage} from "@/pages/mcb/AdminPage.tsx";
import {McbLayout} from "@/layouts/McbLayout.tsx";
import {SuspectsPage} from "@/pages/mcb/SuspectsPage.tsx";
import {NotificationsPage} from "@/pages/notifications/NotificationsPage.tsx";
import {ReportGeneratorPage} from "@/pages/reports/ReportGeneratorPage.tsx";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SystemStatusProvider>
          <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
            <Routes>
              <Route path="/login" element={<LoginPage/>}/>
              <Route path="/register" element={<RegisterPage/>}/>

              <Route element={<AppLayout/>}>
                <Route path="/dashboard" element={<DashboardPage/>}/>
                <Route path="/notifications" element={<NotificationsPage/>}/>
                <Route path="/reports" element={<ReportGeneratorPage/>}/>
                <Route path="/hr" element={<HrPage/>}/>

                <Route path="/mcb" element={<McbLayout/>}>
                  <Route index element={<McbDashboard/>}/>
                  <Route path="case/:caseId" element={<CaseDetailPage/>}/>
                  <Route path="admin" element={<AdminPage/>}/>
                  <Route path="suspects" element={<SuspectsPage/>}/>
                </Route>

                <Route path="/logistics" element={<LogisticsPage/>}/>
                <Route path="/finance" element={<FinancePage/>}/>
                <Route path="/resources" element={<ResourcesPage/>}/>
                <Route path="/profile" element={<ProfilePage/>}/>
                <Route path="/calculator" element={<CalculatorPage/>}/>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
            </Routes>
            <Toaster position="top-right" theme="dark"/>
          </div>
        </SystemStatusProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;