import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import LoginDashboard from "./components/LoginDashboard";
import Home from "./components/Home";
import Events from "./components/Events";
import StudentAttendancePage from "./components/StudentAttendancePage";
import ManageEvents from "./components/ManageEvents";
import Payments from "./components/Payments";
import PaymentStation from "./components/PaymentStation";
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
import ReportsAttendancePage from "./components/ReportsAttendancePage";
import ReportsCollectionPage from "./components/ReportsCollectionPage";
import CreateUserModal from "./components/CreateUserModal";
import { AUTH_SESSION_QUERY_KEY, useAuthSession, useLogout } from "./hooks/auth";
import { MY_PERMISSIONS_QUERY_KEY, useMyPermissions } from "./hooks/useMyPermissions";
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

function RequirePermission({
  permission,
  fallbackRoleOk,
  children,
}: {
  permission: string | string[];
  /** Used while permissions are still loading (legacy role gate). */
  fallbackRoleOk?: boolean;
  children: React.ReactNode;
}) {
  const { has, isReady, isSuperAdmin, isSuccess } = useMyPermissions();
  if (isSuperAdmin) return <>{children}</>;
  if (!isReady || !isSuccess) {
    if (fallbackRoleOk) return <>{children}</>;
    return <Navigate to={DEFAULT_LOGGED_IN_ROUTE} replace />;
  }
  if (has(permission)) return <>{children}</>;
  return <Navigate to={DEFAULT_LOGGED_IN_ROUTE} replace />;
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
        queryClient.removeQueries({ queryKey: MY_PERMISSIONS_QUERY_KEY });
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
          <Route path={APP_ROUTES.live} element={<Home />} />
          <Route path={`${APP_ROUTES.live}/:eventId`} element={<Home />} />
          <Route path="/login" element={<LoginDashboard onLoginSuccess={(data) => handleLoginSuccess(data)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />

          {/* Public attendance landing (available while logged in) */}
          <Route path={APP_ROUTES.live} element={<Home />} />
          <Route path={`${APP_ROUTES.live}/:eventId`} element={<Home />} />

          {/* Dashboard */}
          <Route
            path={APP_ROUTES.dashboard}
            element={
              <RequirePermission permission="nav.dashboard" fallbackRoleOk>
                <MainDashboard {...deskProps} />
              </RequirePermission>
            }
          />

          {/* Academic Settings — Super Admin / school year permission */}
          <Route
            path={APP_ROUTES.academicSettings}
            element={
              <RequirePermission
                permission={["nav.settings.school_year", "action.academic_period.manage"]}
                fallbackRoleOk={isSuperAdminUser}
              >
                <AcademicSettingsPage {...deskProps} />
              </RequirePermission>
            }
          />

          {/* Shared operational routes */}
          <Route
            path={APP_ROUTES.events}
            element={
              <RequirePermission permission="nav.manage_event.list" fallbackRoleOk>
                <Events {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={`${APP_ROUTES.events}/:eventId`}
            element={
              <RequirePermission permission="nav.manage_event.list" fallbackRoleOk>
                <Events {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={`${APP_ROUTES.events}/:eventId/students`}
            element={
              <RequirePermission permission="nav.manage_event.list" fallbackRoleOk>
                <Events {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.students}
            element={
              <RequirePermission permission="nav.reports.students" fallbackRoleOk>
                <StudentAttendancePage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.manageEvents}
            element={
              <RequirePermission permission={["action.event.create", "nav.manage_event.create"]} fallbackRoleOk>
                <ManageEvents {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.payments}
            element={
              <RequirePermission permission="nav.cashier.payments" fallbackRoleOk>
                <Payments {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.paymentStation}
            element={
              <RequirePermission permission="nav.cashier.station" fallbackRoleOk>
                <PaymentStation {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.reportsAttendance}
            element={
              <RequirePermission permission="nav.reports.attendance" fallbackRoleOk>
                <ReportsAttendancePage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.reportsCollection}
            element={
              <RequirePermission permission="nav.reports.collection" fallbackRoleOk>
                <ReportsCollectionPage {...deskProps} />
              </RequirePermission>
            }
          />

          {/* Admin + Super Admin (also grantable via RBAC) */}
          <Route
            path={APP_ROUTES.import}
            element={
              <RequirePermission permission="nav.import" fallbackRoleOk={isAdminUser || isSuperAdminUser}>
                <ImportPage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.users}
            element={
              <RequirePermission permission="nav.users" fallbackRoleOk={isAdminUser || isSuperAdminUser}>
                <UsersPage {...deskProps} />
              </RequirePermission>
            }
          />

          {/* CSG / grantable via RBAC */}
          <Route
            path={APP_ROUTES.exportSecurity}
            element={
              <RequirePermission permission="nav.settings.export_security" fallbackRoleOk={isCsgUser}>
                <ExportSecurityPage {...deskProps} />
              </RequirePermission>
            }
          />

          {/* Super Admin / grantable via RBAC */}
          <Route
            path={APP_ROUTES.adminManagement}
            element={
              <RequirePermission
                permission={["nav.users.list", "nav.users"]}
                fallbackRoleOk={isSuperAdminUser || isAdminUser}
              >
                <AdminManagementPage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.rolesPermissions}
            element={
              <RequirePermission permission="nav.settings.role" fallbackRoleOk={isSuperAdminUser}>
                <RolesPermissionsPage {...deskProps} view="permissions" />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.rolesList}
            element={
              <RequirePermission permission="nav.settings.role" fallbackRoleOk={isSuperAdminUser}>
                <RolesPermissionsPage {...deskProps} view="list" />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.systemSettings}
            element={
              <RequirePermission
                permission={["nav.settings.school_year", "action.academic_period.manage"]}
                fallbackRoleOk={isSuperAdminUser}
              >
                <SystemSettingsPage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.auditLogs}
            element={
              <RequirePermission permission="nav.settings.audit_logs" fallbackRoleOk={isSuperAdminUser}>
                <AuditLogsPage {...deskProps} />
              </RequirePermission>
            }
          />
          <Route
            path={APP_ROUTES.reports}
            element={
              <RequirePermission
                permission="nav.settings.reports_analytics"
                fallbackRoleOk={isSuperAdminUser}
              >
                <ReportsAnalyticsPage {...deskProps} />
              </RequirePermission>
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
