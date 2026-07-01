import { useMemo } from "react";
import { Chart as ChartJS, type ChartOptions } from "chart.js/auto";
import { Bar, Doughnut } from "react-chartjs-2";
import SuperAdminShell from "./SuperAdminShell";
import { useSuperAdminStats } from "../hooks/useSuperAdminData";
import { useGetEvents } from "../hooks/useGetEvents";
import type { DeskPageProps } from "../types/desk-pages";

void ChartJS;

function StatCard({ label, value, sub, color = "text-[#07713C]" }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[#07713c]/25 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#36454F]/60">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#36454F]/55 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportsAnalyticsPage(props: DeskPageProps) {
  const { data: stats } = useSuperAdminStats(true);
  const { data: events = [] } = useGetEvents();

  const eventStatusData = useMemo(() => ({
    labels: ["Upcoming", "Active", "Completed"],
    datasets: [
      {
        label: "Events by Status",
        data: [
          Number(stats?.events.upcoming_events ?? 0),
          Number(stats?.events.active_events ?? 0),
          Number(stats?.events.completed_events ?? 0),
        ],
        backgroundColor: ["#4A90D9", "#F59E0B", "#10B981"],
        borderColor: "#ffffff",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  }), [stats]);

  const userRoleData = useMemo(() => ({
    labels: ["Admins", "CSG Presidents", "Governors"],
    datasets: [
      {
        data: [
          Number(stats?.users.total_admins ?? 0),
          Number(stats?.users.total_csg_presidents ?? 0),
          Number(stats?.users.total_governors ?? 0),
        ],
        backgroundColor: ["#07713C", "#FFC90B", "#4A90D9"],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  }), [stats]);

  const barOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { grid: { color: "rgba(54,69,79,0.08)" }, ticks: { color: "#36454F", font: { size: 12 } } },
        y: { beginAtZero: true, grid: { color: "rgba(54,69,79,0.08)" }, ticks: { color: "#36454F", precision: 0 } },
      },
    }),
    [],
  );

  const doughnutOptions = useMemo<ChartOptions<"doughnut">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" as const, labels: { color: "#36454F", boxWidth: 12, padding: 12 } },
      },
      cutout: "65%",
    }),
    [],
  );

  const mandatoryCount = events.filter((e) => e.is_mandatory).length;
  const allDeptCount = events.filter((e) => e.is_all_departments).length;

  return (
    <SuperAdminShell
      {...props}
      activeNavId="reports"
      pageTitle="Reports & Analytics"
      pageSubtitle="System-wide data aggregated across all accounts"
    >
      {/* Top stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Users" value={Number(stats?.users.total_users ?? 0)} sub="All roles" color="text-[#07713C]" />
        <StatCard label="Total Admins" value={Number(stats?.users.total_admins ?? 0)} sub="Admin accounts" color="text-blue-600" />
        <StatCard label="Total Students" value={Number(stats?.students.total_students ?? 0)} sub="Enrolled" color="text-indigo-600" />
        <StatCard label="Total Events" value={Number(stats?.events.total_events ?? 0)} sub="All periods" color="text-orange-600" />
        <StatCard label="Payments" value={Number(stats?.payments.total_payments ?? 0)} sub="Paid transactions" color="text-green-700" />
      </div>

      {/* Charts row */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Events by status bar */}
        <div className="rounded-xl border border-[#07713c]/20 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold text-[#36454F] mb-1">Events by Status</h2>
          <p className="text-xs text-[#36454F]/55 mb-4">All events across the entire system</p>
          <div className="h-[240px]">
            <Bar data={eventStatusData} options={barOptions} />
          </div>
        </div>

        {/* User role doughnut */}
        <div className="rounded-xl border border-[#07713c]/20 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#36454F] mb-1">User Role Distribution</h2>
          <p className="text-xs text-[#36454F]/55 mb-4">Operational users breakdown</p>
          <div className="h-[240px]">
            <Doughnut data={userRoleData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Event type breakdown */}
      <div className="mb-6 rounded-xl border border-[#07713c]/20 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[#36454F] mb-4">Event Type Breakdown</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Events", value: events.length, color: "text-[#07713C]", bg: "bg-green-50" },
            { label: "Mandatory", value: mandatoryCount, color: "text-red-600", bg: "bg-red-50" },
            { label: "All Departments", value: allDeptCount, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Optional", value: events.length - mandatoryCount, color: "text-gray-600", bg: "bg-gray-50" },
          ].map((item) => (
            <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-[#36454F]/60 mt-1 font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* User summary table */}
      {stats && (
        <div className="rounded-xl border border-[#07713c]/20 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#07713c]/15 px-5 py-4">
            <h2 className="text-sm font-bold text-[#36454F]">User Account Summary</h2>
            <p className="text-xs text-[#36454F]/55 mt-0.5">All registered accounts by role</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#f8faf8] border-b border-[#07713c]/15">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Role</th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Count</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#36454F]/60">Access Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { role: "Super Admin", count: stats.users.total_super_admins, level: "Full system access" },
                { role: "Admin", count: stats.users.total_admins, level: "Full operational access" },
                { role: "CSG President", count: stats.users.total_csg_presidents, level: "Institution events" },
                { role: "Governors", count: stats.users.total_governors, level: "Department-scoped" },
              ].map((row) => (
                <tr key={row.role} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[#36454F]">{row.role}</td>
                  <td className="px-5 py-3 text-right font-bold text-[#07713C]">{Number(row.count)}</td>
                  <td className="px-5 py-3 text-xs text-[#36454F]/60">{row.level}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-3 text-[#36454F]">Total</td>
                <td className="px-5 py-3 text-right text-[#07713C]">{Number(stats.users.total_users)}</td>
                <td className="px-5 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SuperAdminShell>
  );
}
