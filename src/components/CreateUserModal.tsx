import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { useDepartmentsList } from "../hooks/useUsersManagement";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { normalizeRoleKey } from "../utils/roles";
import { getApiErrorMessage, type ApiAxiosError } from "../types/api";
import {
  departmentCodeMatchesGovernorRole,
  formatDepartmentSelectLabel,
  isDepartmentExcludedFromSelect,
} from "../utils/departmentFilter";

/** Create User modal content text. */
const CREATE_USER_TEXT = "text-black";

/** Optional majors when creating users under colleges that require a major. */
const MAJORS_BY_DEPARTMENT_CODE: Record<string, string[]> = {
  CBA: ["Marketing Management", "Financial Management", "Human Resource Management"],
  CEAS: ["English", "Filipino", "Mathematics", "BEED"],
};

type CreateAccountVariables = {
  username: string;
  fullName: string;
  password: string;
  department: string;
  major: string;
  role?: string;
};

type AccountType = "department" | "csg_president" | "dept_cashier" | "csg_cashier";

type CreateUserFormState = {
  fullName: string;
  department: string;
  major: string;
  username: string;
  password: string;
  confirmPassword: string;
  accountType: AccountType;
};

type CreateUserModalProps = {
  open: boolean;
  onClose?: () => void;
};

function useCreateUserDebugMutation() {
  return useMutation<unknown, ApiAxiosError, CreateAccountVariables>({
    mutationFn: async ({
      username,
      fullName,
      password,
      department,
      major,
      role = "department",
    }) => {
      const requestBody = {
        username,
        fullName,
        password,
        department,
        major,
        role,
      };

      console.log("[CreateUserModal] POST /signup request body:", {
        ...requestBody,
        password: requestBody.password ? "[REDACTED]" : requestBody.password,
      });
      console.log(
        "[CreateUserModal] password length:",
        requestBody.password?.length ?? 0,
      );

      const response = await api.post("/create-account", requestBody);
      return response.data;
    },
  });
}

export default function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const { role, isGovernor } = useGovernorScope();
  const roleKey = normalizeRoleKey(role);
  const [createUserError, setCreateUserError] = useState("");
  const { data: departments = [], isLoading: departmentsLoading } = useDepartmentsList(open);

  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>({
    fullName: "",
    department: "",
    major: "",
    username: "",
    password: "",
    confirmPassword: "",
    accountType: "department",
  });

  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] =
    useState(false);

  const departmentSelectOptions = useMemo(
    () =>
      departments
        .filter((dept) => !isDepartmentExcludedFromSelect(dept.name))
        .map((dept) => {
          const code = String(dept.code ?? "").trim().toUpperCase();
          return {
            value: dept.name,
            code,
            label: formatDepartmentSelectLabel(dept.name, code),
            majors: MAJORS_BY_DEPARTMENT_CODE[code] ?? [],
          };
        }),
    [departments],
  );

  const governorDepartmentOptions = useMemo(() => {
    if (!isGovernor) return [];
    return departmentSelectOptions.filter((dept) =>
      departmentCodeMatchesGovernorRole(dept.code, roleKey),
    );
  }, [departmentSelectOptions, isGovernor, roleKey]);

  const selectedDepartment = useMemo(
    () => departmentSelectOptions.find((item) => item.value === createUserForm.department),
    [departmentSelectOptions, createUserForm.department],
  );

  const majorOptions = selectedDepartment?.majors ?? [];

  const resetForOpen = () => {
    setCreateUserError("");
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
    setCreateUserForm({
      fullName: "",
      department: "",
      major: "",
      username: "",
      password: "",
      confirmPassword: "",
      accountType: "department",
    });
  };

  useEffect(() => {
    if (!open) return;
    resetForOpen();
  }, [open]);

  useEffect(() => {
    if (!open || !isGovernor || !governorDepartmentOptions.length) return;
    const governorDepartment = governorDepartmentOptions[0]?.value ?? "";
    setCreateUserForm((prev) => ({
      ...prev,
      accountType: "department",
      department: governorDepartment,
      major: "",
      username: "",
    }));
  }, [open, isGovernor, governorDepartmentOptions]);

  const isPasswordValid = !createUserForm.password
    ? false
    : createUserForm.password.length >= 6;
  const doPasswordsMatch =
    !createUserForm.password ||
    !createUserForm.confirmPassword ||
    createUserForm.password === createUserForm.confirmPassword;

  const usernameValue = createUserForm.username.trim();
  const passwordValue = createUserForm.password || "";

  const requiresMajor = useMemo(() => {
    if (
      createUserForm.accountType === "csg_president" ||
      createUserForm.accountType === "dept_cashier" ||
      createUserForm.accountType === "csg_cashier"
    ) {
      return false;
    }
    if (!isGovernor) return false;
    return majorOptions.length > 0;
  }, [createUserForm.accountType, isGovernor, majorOptions.length]);

  const { mutate: createUser, isPending: isCreatingUser } =
    useCreateUserDebugMutation();

  const roleToSend =
    createUserForm.accountType === "csg_president"
      ? "csg_president"
      : createUserForm.accountType === "dept_cashier"
        ? "dept_cashier"
        : createUserForm.accountType === "csg_cashier"
          ? "csg_cashier"
          : "governor";

  const needsDepartment =
    createUserForm.accountType === "department" ||
    createUserForm.accountType === "dept_cashier";

  const isCreateDisabled =
    isCreatingUser ||
    departmentsLoading ||
    !createUserForm.fullName.trim() ||
    !createUserForm.username.trim() ||
    !passwordValue ||
    !doPasswordsMatch ||
    !isPasswordValid ||
    (needsDepartment && !createUserForm.department.trim()) ||
    (requiresMajor && !createUserForm.major.trim());

  const resetForm = () => {
    setCreateUserError("");
    setCreateUserForm({
      fullName: "",
      department: "",
      major: "",
      username: "",
      password: "",
      confirmPassword: "",
      accountType: "department",
    });
    setShowCreatePassword(false);
    setShowCreateConfirmPassword(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-[#07713c]/30 bg-[#07713c]/10 px-5 py-3">
          <h3 className="font-semibold text-black">Create User</h3>
        </div>
        <form
          className={`${CREATE_USER_TEXT} p-5 space-y-4 text-sm`}
          onSubmit={(e) => {
            e.preventDefault();
            setCreateUserError("");

            if (needsDepartment) {
              if (!createUserForm.department.trim()) {
                setCreateUserError("Department is required.");
                return;
              }
              if (requiresMajor && !createUserForm.major.trim()) {
                setCreateUserError(
                  "Major is required for the selected department.",
                );
                return;
              }
            }

            if (!createUserForm.fullName.trim()) {
              setCreateUserError("Full name is required.");
              return;
            }

            if (!usernameValue) {
              setCreateUserError("Username is required.");
              return;
            }

            if (
              !createUserForm.password ||
              createUserForm.password.length < 6
            ) {
              setCreateUserError("Password must be at least 6 characters.");
              return;
            }

            if (createUserForm.password !== createUserForm.confirmPassword) {
              setCreateUserError("Password and confirm password do not match.");
              return;
            }

            createUser(
              {
                username: usernameValue,
                fullName: createUserForm.fullName.trim(),
                password: createUserForm.password,
                department: needsDepartment ? createUserForm.department.trim() : "",
                major:
                  needsDepartment && isGovernor && requiresMajor
                    ? createUserForm.major.trim()
                    : "",
                role: roleToSend,
              },
              {
                onSuccess: () => {
                  onClose?.();
                },
                onError: (err) => {
                  setCreateUserError(getApiErrorMessage(err, "Failed to create user."));
                },
              },
            );
          }}
        >
          {createUserError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-black">
              {createUserError}
            </div>
          )}

          {/* 1. Full Name */}
          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={createUserForm.fullName}
              onChange={(e) =>
                setCreateUserForm((prev) => ({
                  ...prev,
                  fullName: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
              placeholder="Enter full name"
            />
          </div>

          {/* 2. Account Type & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Account Type
              </label>
              <select
                value={createUserForm.accountType}
                disabled={isGovernor}
                onChange={(e) => {
                  const nextType = e.target.value as AccountType;
                  setCreateUserForm((prev) => ({
                    ...prev,
                    accountType: nextType,
                    ...(nextType === "csg_president" || nextType === "csg_cashier"
                      ? { department: "", major: "" }
                      : null),
                  }));
                }}
                className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] disabled:bg-gray-100"
              >
                <option value="department">Department User</option>
                <option value="csg_president">CSG President</option>
                <option value="dept_cashier">Dept Cashier</option>
                <option value="csg_cashier">CSG Cashier</option>
              </select>
            </div>

            {needsDepartment && (
              <>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Department
                  </label>
                  {isGovernor ? (
                    <div className="w-full rounded-lg border border-[#07713c]/30 bg-gray-100 px-3 py-2 text-sm text-black/70">
                      {createUserForm.department || governorDepartmentOptions[0]?.label || "—"}
                    </div>
                  ) : (
                    <select
                      value={createUserForm.department}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          department: e.target.value,
                          major: "",
                        }))
                      }
                      disabled={departmentsLoading || departmentSelectOptions.length === 0}
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] disabled:bg-gray-100"
                    >
                      <option value="">
                        {departmentsLoading
                          ? "Loading departments..."
                          : departmentSelectOptions.length
                            ? "Select Department"
                            : "No departments found"}
                      </option>
                      {departmentSelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {isGovernor && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-black mb-1">
                      Major
                    </label>
                    <select
                      value={createUserForm.major}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          major: e.target.value,
                        }))
                      }
                      disabled={
                        !createUserForm.department || majorOptions.length === 0
                      }
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-black focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] disabled:bg-gray-100"
                    >
                      <option value="">
                        {createUserForm.department && majorOptions.length === 0
                          ? "No Major Required"
                          : createUserForm.department
                            ? "Select Major"
                            : "Select Department First"}
                      </option>
                      {majorOptions.map((major: string) => (
                        <option key={major} value={major}>
                          {major}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 3. Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-black mb-1">
                Username
              </label>
              <input
                type="text"
                value={createUserForm.username}
                onChange={(e) =>
                  setCreateUserForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                placeholder="Enter username"
              />
              {!createUserForm.username.trim() &&
              createUserError?.toLowerCase().includes("username") ? (
                <p className="text-[11px] text-black mt-1">Username is required.</p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={createUserForm.password}
                  onChange={(e) =>
                    setCreateUserForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] ${
                    !createUserForm.password
                      ? "border-[#07713c]/40"
                      : isPasswordValid
                        ? "border-[#07713c]/40"
                        : "border-red-400"
                  }`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-black hover:text-black/70"
                >
                  {showCreatePassword ? "Hide" : "Show"}
                </button>
              </div>
              {createUserForm.password && !isPasswordValid && (
                <p className="text-[11px] text-black mt-1">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showCreateConfirmPassword ? "text" : "password"}
                  value={createUserForm.confirmPassword}
                  onChange={(e) =>
                    setCreateUserForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm text-black placeholder:text-black/45 bg-white focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] ${
                    !createUserForm.confirmPassword
                      ? "border-[#07713c]/40"
                      : doPasswordsMatch
                        ? "border-[#07713c]/40"
                        : "border-red-400"
                  }`}
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-[11px] text-black hover:text-black/70"
                >
                  {showCreateConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {createUserForm.confirmPassword && !doPasswordsMatch && (
                <p className="text-[11px] text-black mt-1">
                  Passwords do not match.
                </p>
              )}
            </div>
          </div>

          <div className="px-1 pt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose?.();
              }}
              disabled={isCreatingUser}
              className="px-4 py-2 rounded-lg border border-gray-300 text-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreateDisabled}
              className="px-4 py-2 rounded-lg border border-[#07713c] bg-[#07713c]/10 font-medium text-black hover:bg-[#07713c]/15 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCreatingUser ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
