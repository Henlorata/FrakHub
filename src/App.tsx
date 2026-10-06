import {lazy, Suspense, type ComponentType} from "react";
import {BrowserRouter, Navigate, Route, Routes} from "react-router";
import {AuthProvider} from "@/context/AuthContext";
import {SystemStatusProvider} from "@/context/SystemStatusContext";
import {Toaster} from "@/components/ui/sonner";
import {LoadingScreen} from "@/components/ui/loading-screen";
import {AppLayout} from "@/layouts/AppLayout";
import {LoginPage} from "@/pages/auth/LoginPage";
import {ActiveExamAlert} from "@/components/ActiveExamAlert";
import {AppErrorBoundary} from "@/components/AppErrorBoundary";
import {ConfigErrorScreen} from "@/components/ConfigErrorScreen";
import {ConfirmProvider} from "@/components/ConfirmDialog";
import {SandboxBoundary} from "@/components/training/SandboxBoundary";
import {TrainingProvider} from "@/context/TrainingContext";
import {missingRequiredEnv} from "@/lib/env";

/**
 * Route-level code splitting: a page's code (and heavy dependencies such as the
 * BlockNote editor) is downloaded only when the page is first visited.
 */
function lazyPage<M extends Record<string, unknown>>(loader: () => Promise<M>, exportName: keyof M) {
  return lazy(async () => ({default: (await loader())[exportName] as ComponentType}));
}

const RegisterPage = lazyPage(() => import("@/pages/auth/RegisterPage"), "RegisterPage");
const OnboardingPage = lazyPage(() => import("@/pages/auth/OnboardingPage"), "OnboardingPage");
const PublicExamPage = lazyPage(() => import("@/pages/exams/PublicExamPage"), "PublicExamPage");
const DashboardPage = lazyPage(() => import("@/pages/dashboard/DashboardPage"), "DashboardPage");
const NotificationsPage = lazyPage(() => import("@/pages/notifications/NotificationsPage"), "NotificationsPage");
const ReportsPage = lazyPage(() => import("@/pages/reports/ReportsPage"), "ReportsPage");
const HrPage = lazyPage(() => import("@/pages/hr/HrPage"), "HrPage");
const McbLayout = lazyPage(() => import("@/layouts/McbLayout"), "McbLayout");
const McbDashboard = lazyPage(() => import("@/pages/mcb/McbDashboard"), "McbDashboard");
const CaseDetailPage = lazyPage(() => import("@/pages/mcb/CaseDetailPage"), "CaseDetailPage");
const AdminPage = lazyPage(() => import("@/pages/mcb/AdminPage"), "AdminPage");
const SuspectsPage = lazyPage(() => import("@/pages/mcb/SuspectsPage"), "SuspectsPage");
const WarrantsPage = lazyPage(() => import("@/pages/mcb/WarrantsPage"), "WarrantsPage");
const CasePrintPage = lazyPage(() => import("@/pages/mcb/CasePrintPage"), "CasePrintPage");
const TemplatesPage = lazyPage(() => import("@/pages/mcb/TemplatesPage"), "TemplatesPage");
const ExamHub = lazyPage(() => import("@/pages/exams/ExamHub"), "ExamHub");
const ExamEditor = lazyPage(() => import("@/pages/exams/ExamEditor"), "ExamEditor");
const ExamGradingPage = lazyPage(() => import("@/pages/exams/grading/ExamGradingPage"), "ExamGradingPage");
const LogisticsPage = lazyPage(() => import("@/pages/logistics/LogisticsPage"), "LogisticsPage");
const VehiclePage = lazyPage(() => import("@/pages/logistics/VehiclePage"), "VehiclePage");
const FinancePage = lazyPage(() => import("@/pages/finance/FinancePage"), "FinancePage");
const ProfilePage = lazyPage(() => import("@/pages/profile/ProfilePage"), "ProfilePage");
const CalculatorPage = lazyPage(() => import("@/pages/calculator/CalculatorPage"), "CalculatorPage");
const AcademyPage = lazyPage(() => import("@/pages/academy/AcademyPage"), "default");
const EventsPage = lazyPage(() => import("@/pages/events/EventsPage"), "EventsPage");
const CodesPage = lazyPage(() => import("@/pages/codes/CodesPage"), "CodesPage");
const ChangelogPage = lazyPage(() => import("@/pages/changelog/ChangelogPage"), "ChangelogPage");

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen/>}>
      <Routes>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<RegisterPage/>}/>
        <Route path="/exam/public/:examId" element={<PublicExamPage/>}/>

        <Route element={<AppLayout/>}>
          <Route path="/dashboard" element={<DashboardPage/>}/>
          <Route path="/onboarding" element={<OnboardingPage/>}/>
          <Route path="/notifications" element={<NotificationsPage/>}/>
          <Route path="/reports" element={<ReportsPage/>}/>
          <Route path="/hr" element={<HrPage/>}/>

          <Route path="/mcb" element={<McbLayout/>}>
            <Route index element={<McbDashboard/>}/>
            <Route path="case/:caseId" element={<CaseDetailPage/>}/>
            <Route path="case/:caseId/print" element={<CasePrintPage/>}/>
            <Route path="admin" element={<AdminPage/>}/>
            <Route path="suspects" element={<SuspectsPage/>}/>
            <Route path="warrants" element={<WarrantsPage/>}/>
            <Route path="templates" element={<TemplatesPage/>}/>
          </Route>

          <Route path="/exams" element={<ExamHub/>}/>
          <Route path="/exams/editor" element={<ExamEditor/>}/>
          <Route path="/exams/editor/:examId" element={<ExamEditor/>}/>
          <Route path="/exams/grading/:submissionId" element={<ExamGradingPage/>}/>
          <Route path="/logistics" element={<LogisticsPage/>}/>
          <Route path="/logistics/fleet/:vehicleId" element={<VehiclePage/>}/>
          <Route path="/finance" element={<FinancePage/>}/>
          <Route path="/profile" element={<ProfilePage/>}/>
          <Route path="/calculator" element={<CalculatorPage/>}/>
          <Route path="/academy" element={<AcademyPage/>}/>
          <Route path="/events" element={<EventsPage/>}/>
          <Route path="/codes" element={<CodesPage/>}/>
          <Route path="/changelog" element={<ChangelogPage/>}/>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </Suspense>
  );
}

function App() {
  if (missingRequiredEnv.length > 0) return <ConfigErrorScreen missing={missingRequiredEnv}/>;

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <TrainingProvider>
            {/* Practice mode (trainings) remounts everything below against the demo world. */}
            <SandboxBoundary>
              <SystemStatusProvider>
                <ConfirmProvider>
                  <div className="min-h-screen text-foreground font-sans antialiased">
                    <ActiveExamAlert/>
                    <AppRoutes/>
                  </div>
                </ConfirmProvider>
              </SystemStatusProvider>
            </SandboxBoundary>
            <Toaster position="top-right" theme="dark"/>
          </TrainingProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
