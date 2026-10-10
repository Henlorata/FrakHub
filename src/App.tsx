import {Suspense} from "react";
import {BrowserRouter, Navigate, Route, Routes} from "react-router";
import {AuthProvider, useAuth} from "@/context/AuthContext";
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
import {lazyComponent} from "@/lib/lazy";

/**
 * Route-level code splitting: a page's code (and heavy dependencies such as the
 * BlockNote editor) is downloaded only when the page is first visited.
 */
const lazyPage = lazyComponent;

const RegisterPage = lazyPage(() => import("@/pages/auth/RegisterPage"), "RegisterPage");
const OnboardingPage = lazyPage(() => import("@/pages/auth/OnboardingPage"), "OnboardingPage");
const PublicExamPage = lazyPage(() => import("@/pages/exams/PublicExamPage"), "PublicExamPage");
const CertificatePage = lazyPage(() => import("@/pages/certificates/CertificatePage"), "CertificatePage");
const PracticePage = lazyPage(() => import("@/pages/practice/PracticePage"), "PracticePage");
const LeaderboardPage = lazyPage(() => import("@/pages/leaderboard/LeaderboardPage"), "LeaderboardPage");
const PermissionsPage = lazyPage(() => import("@/pages/permissions/PermissionsPage"), "PermissionsPage");
const DashboardPage = lazyPage(() => import("@/pages/dashboard/DashboardPage"), "DashboardPage");
const NotificationsPage = lazyPage(() => import("@/pages/notifications/NotificationsPage"), "NotificationsPage");
const ReportsPage = lazyPage(() => import("@/pages/reports/ReportsPage"), "ReportsPage");
const ReportPage = lazyPage(() => import("@/pages/reports/ReportPage"), "ReportPage");
const HrPage = lazyPage(() => import("@/pages/hr/HrPage"), "HrPage");
const ServiceRecordPage = lazyPage(() => import("@/pages/hr/ServiceRecordPage"), "ServiceRecordPage");
const McbLayout = lazyPage(() => import("@/layouts/McbLayout"), "McbLayout");
const McbDashboard = lazyPage(() => import("@/pages/mcb/McbDashboard"), "McbDashboard");
const CaseDetailPage = lazyPage(() => import("@/pages/mcb/CaseDetailPage"), "CaseDetailPage");
const AdminPage = lazyPage(() => import("@/pages/mcb/AdminPage"), "AdminPage");
const SuspectsPage = lazyPage(() => import("@/pages/mcb/SuspectsPage"), "SuspectsPage");
const WarrantsPage = lazyPage(() => import("@/pages/mcb/WarrantsPage"), "WarrantsPage");
const CasePrintPage = lazyPage(() => import("@/pages/mcb/CasePrintPage"), "CasePrintPage");
const TemplatesPage = lazyPage(() => import("@/pages/mcb/TemplatesPage"), "TemplatesPage");
const InformantsPage = lazyPage(() => import("@/pages/mcb/InformantsPage"), "InformantsPage");
const OrganizationsPage = lazyPage(() => import("@/pages/mcb/OrganizationsPage"), "OrganizationsPage");
const OrganizationPage = lazyPage(() => import("@/pages/mcb/OrganizationPage"), "OrganizationPage");
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
const PoliciesPage = lazyPage(() => import("@/pages/community/PoliciesPage"), "PoliciesPage");
const CommunityPage = lazyPage(() => import("@/pages/community/CommunityPage"), "CommunityPage");
const BriefingPage = lazyPage(() => import("@/pages/briefing/BriefingPage"), "BriefingPage");
const StatsPage = lazyPage(() => import("@/pages/stats/StatsPage"), "StatsPage");
const MailPage = lazyPage(() => import("@/pages/mail/MailPage"), "MailPage");
const HomePage = lazyPage(() => import("@/pages/home/HomePage"), "HomePage");
const NewsListPage = lazyPage(() => import("@/pages/home/NewsListPage"), "NewsListPage");
const NewsArticlePage = lazyPage(() => import("@/pages/home/NewsArticlePage"), "NewsArticlePage");
const ContactPage = lazyPage(() => import("@/pages/home/ContactPage"), "ContactPage");
const GraphPage = lazyPage(() => import("@/pages/mcb/GraphPage"), "GraphPage");
const CaseTrashPage = lazyPage(() => import("@/pages/mcb/CaseTrashPage"), "CaseTrashPage");
const SibPage = lazyPage(() => import("@/pages/sib/SibPage"), "SibPage");
const NewsEditorPage = lazyPage(() => import("@/pages/sib/NewsEditorPage"), "NewsEditorPage");
const IabPage = lazyPage(() => import("@/pages/iab/IabPage"), "IabPage");
const IabCasePage = lazyPage(() => import("@/pages/iab/IabCasePage"), "IabCasePage");
const IabCasePrintPage = lazyPage(() => import("@/pages/iab/IabCasePrintPage"), "IabCasePrintPage");
const PayslipPrintPage = lazyPage(() => import("@/pages/finance/PayslipPrintPage"), "PayslipPrintPage");
const AwardCertificatePage = lazyPage(() => import("@/pages/hr/AwardCertificatePage"), "AwardCertificatePage");

/**
 * "/": visitors get the public front page, signed-in members their dashboard (the front page stays
 * at /home). Small and eager, so members never download the front page just to be sent on.
 */
function HomeGate() {
  const {session, loading} = useAuth();
  if (session) return <Navigate to="/dashboard" replace/>;
  // The stored session is checked first (instant without one).
  if (loading) return <LoadingScreen/>;
  return <HomePage/>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen/>}>
      <Routes>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/register" element={<RegisterPage/>}/>
        <Route path="/exam/public/:examId" element={<PublicExamPage/>}/>
        <Route path="/certificates" element={<CertificatePage/>}/>
        <Route path="/certificates/:code" element={<CertificatePage/>}/>
        <Route path="/home" element={<HomePage/>}/>
        <Route path="/news" element={<NewsListPage/>}/>
        <Route path="/news/:slug" element={<NewsArticlePage/>}/>
        <Route path="/contact" element={<ContactPage/>}/>

        <Route element={<AppLayout/>}>
          <Route path="/dashboard" element={<DashboardPage/>}/>
          <Route path="/onboarding" element={<OnboardingPage/>}/>
          <Route path="/notifications" element={<NotificationsPage/>}/>
          <Route path="/briefing" element={<BriefingPage/>}/>
          <Route path="/stats" element={<StatsPage/>}/>
          <Route path="/mail" element={<MailPage/>}/>
          <Route path="/sib" element={<SibPage/>}/>
          <Route path="/sib/news/:postId" element={<NewsEditorPage/>}/>
          <Route path="/iab" element={<IabPage/>}/>
          <Route path="/iab/case/:caseId" element={<IabCasePage/>}/>
          <Route path="/iab/case/:caseId/print" element={<IabCasePrintPage/>}/>
          <Route path="/reports" element={<ReportsPage/>}/>
          <Route path="/reports/:reportId" element={<ReportPage/>}/>
          <Route path="/hr" element={<HrPage/>}/>
          <Route path="/hr/record/:userId" element={<ServiceRecordPage/>}/>
          <Route path="/hr/award/:kind/:id" element={<AwardCertificatePage/>}/>

          <Route path="/mcb" element={<McbLayout/>}>
            <Route index element={<McbDashboard/>}/>
            <Route path="case/:caseId" element={<CaseDetailPage/>}/>
            <Route path="case/:caseId/print" element={<CasePrintPage/>}/>
            <Route path="admin" element={<AdminPage/>}/>
            <Route path="suspects" element={<SuspectsPage/>}/>
            <Route path="warrants" element={<WarrantsPage/>}/>
            <Route path="templates" element={<TemplatesPage/>}/>
            <Route path="informants" element={<InformantsPage/>}/>
            <Route path="organizations" element={<OrganizationsPage/>}/>
            <Route path="organizations/:orgId" element={<OrganizationPage/>}/>
            <Route path="graph" element={<GraphPage/>}/>
            <Route path="trash" element={<CaseTrashPage/>}/>
          </Route>

          <Route path="/exams" element={<ExamHub/>}/>
          <Route path="/exams/editor" element={<ExamEditor/>}/>
          <Route path="/exams/editor/:examId" element={<ExamEditor/>}/>
          <Route path="/exams/grading/:submissionId" element={<ExamGradingPage/>}/>
          <Route path="/logistics" element={<LogisticsPage/>}/>
          <Route path="/logistics/fleet/:vehicleId" element={<VehiclePage/>}/>
          <Route path="/finance" element={<FinancePage/>}/>
          <Route path="/finance/payslip/:month" element={<PayslipPrintPage/>}/>
          <Route path="/profile" element={<ProfilePage/>}/>
          <Route path="/calculator" element={<CalculatorPage/>}/>
          <Route path="/academy" element={<AcademyPage/>}/>
          <Route path="/events" element={<EventsPage/>}/>
          <Route path="/codes" element={<CodesPage/>}/>
          <Route path="/changelog" element={<ChangelogPage/>}/>
          <Route path="/policies" element={<PoliciesPage/>}/>
          <Route path="/community" element={<CommunityPage/>}/>
          <Route path="/practice" element={<PracticePage/>}/>
          <Route path="/leaderboard" element={<LeaderboardPage/>}/>
          <Route path="/permissions" element={<PermissionsPage/>}/>
        </Route>

        <Route path="/" element={<HomeGate/>}/>
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
