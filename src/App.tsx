import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import LoginDashboard from "./components/LoginDashboard";
import Home from "./components/Home";
import Events from "./components/Events";
import StudentAttendancePage from "./components/StudentAttendancePage";
import ManageEvents from "./components/ManageEvents";
import Payments from "./components/Payments";
import ImportPage from "./components/ImportPage";
import UsersPage from "./components/UsersPage";
import AcademicSettingsPage from "./components/AcademicSettingsPage";
import MainDashboard from "./components/MainDashboard";
import AdminManagementPage from "./components/AdminManagementPage";
import RolesPermissionsPage from "./components/RolesPermissionsPage";
import SystemSettingsPage from "./components/SystemSettingsPage";
import AuditLogsPage from "./components/AuditLogsPage";
import ReportsAnalyticsPage from "./components/ReportsAnalyticsPage";
import ExportSecurityPage from "./components/ExportSecurityPage";
import CreateUserModal from "./components/CreateUserModal";
import { AUTH_SESSION_QUERY_KEY, useAuthSession, useLogout } from "./hooks/auth";
import {
  APP_ROUTES,
  DEFAULT_LOGGED_IN_ROUTE,
  eventsEventPath,
  eventsEventStudentsPath,
  resolveNavRoute,
} from "./utils/appNav";
import { getDefaultRouteForRole } from "./utils/authRouting";
import { getRoleFromSession, isSuperAdminRole, isAdminRole, isCsgPresident } from "./utils/roles";
import { CURRENT_EVENT_QUERY_KEY } from "./hooks/useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./hooks/useGetEvents";
import type { AuthSession } from "./types/api";

type LoginSuccessOptions = { redirectTo?: string };

function LegacyAttendanceEventRedirect() {
  const { eventId } = useParams();
  if (!eventId) return <Navigate to={APP_ROUTES.events} replace />;
  return <Navigate to={eventsEventPath(eventId)} replace />;
}

function LegacyAttendanceEventStudentsRedirect() {
  const { eventId } = useParams();
  if (!eventId) return <Navigate to={APP_ROUTES.events} replace />;
  return <Navigate to={eventsEventStudentsPath(eventId)} replace />;
}

function App() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutate: logout } = useLogout();
  const { data: session, isLoading: isSessionLoading, refetch: refetchSession } = useAuthSession();
  const [loginPayload, setLoginPayload] = useState<AuthSession | null>(null);
  const isLoggedIn = Boolean(session) || Boolean(loginPayload);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const effectiveAuth = session ?? loginPayload;
  const decodedUser = effectiveAuth?.user ?? effectiveAuth;
  const normalizedRole = String(decodedUser?.role ?? "").toLowerCase().trim();
  const isAdminUser = isAdminRole(normalizedRole);
  const isSuperAdminUser = isSuperAdminRole(normalizedRole);
  const isCsgUser = isCsgPresident(normalizedRole);
  const defaultRoute = DEFAULT_LOGGED_IN_ROUTE;

  useEffect(() => {
    if (!isCreateUserOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isCreateUserOpen]);

  const handleLoginSuccess = (data: AuthSession | null | undefined, options: LoginSuccessOptions = {}) => {
    setLoginPayload(data ?? { authenticated: true });
    queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    refetchSession().then((result) => {
      const session = result.data ?? data ?? null;
      const role = getRoleFromSession(session);
      const redirectTo = options.redirectTo ?? getDefaultRouteForRole(role);
      navigate(redirectTo, { replace: true });
    });
  };

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => {
        setLoginPayload(null);
        queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null);
        navigate("/login", { replace: true });
      },
    });
  };

  const handleNavigate = (page: string) => {
    const route = resolveNavRoute(page);
    navigate(route ?? defaultRoute);
  };

  const openCreateUser = () => {
    navigate(APP_ROUTES.users);
  };
  const closeCreateUser = () => setIsCreateUserOpen(false);

  const deskProps = {
    onLogout: handleLogout,
    onNavigate: handleNavigate,
    onOpenCreateUser: openCreateUser,
    isCreateUserOpen,
  };

  if (isSessionLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-600">Checking session...</div>;
  }

  return (
    <>
      <Routes>
      {!isLoggedIn ? (
        <>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginDashboard onLoginSuccess={(data) => handleLoginSuccess(data)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />

          {/* Dashboard — accessible to all logged-in desk users */}
          <Route
            path={APP_ROUTES.dashboard}
            element={<MainDashboard {...deskProps} />}
          />

          {/* Academic Settings — Super Admin only */}
          <Route
            path={APP_ROUTES.academicSettings}
            element={
              isSuperAdminUser ? (
                <AcademicSettingsPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />

          {/* Shared operational routes — all roles except require admin for import/users */}
          <Route path={APP_ROUTES.events} element={<Events {...deskProps} />} />
          <Route path={`${APP_ROUTES.events}/:eventId`} element={<Events {...deskProps} />} />
          <Route path={`${APP_ROUTES.events}/:eventId/students`} element={<Events {...deskProps} />} />
          <Route path={APP_ROUTES.students} element={<StudentAttendancePage {...deskProps} />} />
          <Route path={APP_ROUTES.manageEvents} element={<ManageEvents {...deskProps} />} />
          <Route path={APP_ROUTES.payments} element={<Payments {...deskProps} />} />

          {/* Admin + Super Admin only */}
          <Route
            path={APP_ROUTES.import}
            element={
              isAdminUser || isSuperAdminUser ? (
                <ImportPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          <Route
            path={APP_ROUTES.users}
            element={
              isAdminUser || isSuperAdminUser ? (
                <UsersPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />

          {/* CSG President exclusive routes */}
          <Route
            path={APP_ROUTES.exportSecurity}
            element={
              isCsgUser ? (
                <ExportSecurityPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />

          {/* Super Admin exclusive routes */}
          <Route
            path={APP_ROUTES.adminManagement}
            element={
              isSuperAdminUser ? (
                <AdminManagementPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          <Route
            path={APP_ROUTES.rolesPermissions}
            element={
              isSuperAdminUser ? (
                <RolesPermissionsPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          <Route
            path={APP_ROUTES.systemSettings}
            element={
              isSuperAdminUser ? (
                <SystemSettingsPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          <Route
            path={APP_ROUTES.auditLogs}
            element={
              isSuperAdminUser ? (
                <AuditLogsPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          <Route
            path={APP_ROUTES.reports}
            element={
              isSuperAdminUser ? (
                <ReportsAnalyticsPage {...deskProps} />
              ) : (
                <Navigate to={defaultRoute} replace />
              )
            }
          />

          {/* Legacy redirects */}
          <Route path="/attendance" element={<Navigate to={APP_ROUTES.events} replace />} />
          <Route path="/attendance/event/:eventId" element={<LegacyAttendanceEventRedirect />} />
          <Route path="/attendance/event/:eventId/students" element={<LegacyAttendanceEventStudentsRedirect />} />
          <Route path="/time-in-out" element={<Navigate to={defaultRoute} replace />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )}
      </Routes>
      <CreateUserModal open={isCreateUserOpen} onClose={closeCreateUser} />
    </>
  );
}

export default App;
