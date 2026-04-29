import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type UserStatus = "pending" | "approved" | "rejected";

export interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  status: UserStatus;
  createdAt: string;
}

interface PasswordResetRecord {
  email: string;
  code: string;
  expiresAt: string;
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  signup: (email: string, password: string, name: string) => { success: boolean; message: string };
  login: (email: string, password: string) => { success: boolean; message: string };
  requestPasswordReset: (email: string) => { success: boolean; message: string; code?: string };
  resetPassword: (email: string, code: string, newPassword: string) => { success: boolean; message: string };
  logout: () => void;
  approveUser: (id: string) => void;
  rejectUser: (id: string) => void;
  deleteUser: (id: string) => void;
  isAdmin: boolean;
}

const ADMIN_EMAIL = "admin@commissionpro.com";
const ADMIN_PASSWORD = "admin123";

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredUsers(): AppUser[] {
  try {
    return JSON.parse(localStorage.getItem("cp_users") || "[]");
  } catch {
    return [];
  }
}

function storeUsers(users: AppUser[]) {
  localStorage.setItem("cp_users", JSON.stringify(users));
}

function getResetRecords(): PasswordResetRecord[] {
  try {
    return JSON.parse(localStorage.getItem("cp_reset_codes") || "[]");
  } catch {
    return [];
  }
}

function storeResetRecords(records: PasswordResetRecord[]) {
  localStorage.setItem("cp_reset_codes", JSON.stringify(records));
}

function cleanupExpiredResetRecords(records: PasswordResetRecord[]) {
  const now = new Date();
  return records.filter((record) => new Date(record.expiresAt) > now);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(getStoredUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem("cp_current_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  const signup = useCallback((email: string, password: string, name: string) => {
    const existing = getStoredUsers();
    if (email.toLowerCase() === ADMIN_EMAIL) {
      return { success: false, message: "This email is reserved." };
    }
    if (existing.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: "An account with this email already exists." };
    }
    const newUser: AppUser = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      password,
      name,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const updated = [...existing, newUser];
    storeUsers(updated);
    setUsers(updated);
    return { success: true, message: "Account created! Please wait for admin to verify your account before you can log in." };
  }, []);

  const login = useCallback((email: string, password: string) => {
    // Admin login
    if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminUser: AppUser = {
        id: "admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: "Admin",
        status: "approved",
        createdAt: "",
      };
      setCurrentUser(adminUser);
      localStorage.setItem("cp_current_user", JSON.stringify(adminUser));
      return { success: true, message: "Welcome, Admin!" };
    }

    const allUsers = getStoredUsers();
    const user = allUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) {
      return { success: false, message: "Invalid email or password." };
    }
    if (user.status === "pending") {
      return { success: false, message: "Your account is pending admin verification. Please wait for approval." };
    }
    if (user.status === "rejected") {
      return { success: false, message: "Your account has been rejected. Please contact admin." };
    }
    setCurrentUser(user);
    localStorage.setItem("cp_current_user", JSON.stringify(user));
    return { success: true, message: "Welcome back!" };
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("cp_current_user");
  }, []);

  const requestPasswordReset = useCallback((email: string) => {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      return { success: false, message: "Please enter your email address." };
    }

    if (normalizedEmail === ADMIN_EMAIL) {
      return { success: false, message: "Admin password reset is restricted." };
    }

    const allUsers = getStoredUsers();
    const existingUser = allUsers.find((user) => user.email.toLowerCase() === normalizedEmail);
    if (!existingUser) {
      return { success: false, message: "No account found with this email." };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const cleaned = cleanupExpiredResetRecords(getResetRecords()).filter((record) => record.email !== normalizedEmail);
    cleaned.push({ email: normalizedEmail, code, expiresAt });
    storeResetRecords(cleaned);

    return {
      success: true,
      message: "Reset code generated. Use it within 10 minutes.",
      code,
    };
  }, []);

  const resetPassword = useCallback((email: string, code: string, newPassword: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedCode = code.trim();
    const trimmedPassword = newPassword.trim();

    if (!normalizedEmail || !trimmedCode || !trimmedPassword) {
      return { success: false, message: "Email, code, and new password are required." };
    }

    if (trimmedPassword.length < 6) {
      return { success: false, message: "New password must be at least 6 characters." };
    }

    const cleaned = cleanupExpiredResetRecords(getResetRecords());
    const record = cleaned.find((entry) => entry.email === normalizedEmail && entry.code === trimmedCode);
    if (!record) {
      storeResetRecords(cleaned);
      return { success: false, message: "Invalid or expired reset code." };
    }

    const usersList = getStoredUsers();
    const userIndex = usersList.findIndex((user) => user.email.toLowerCase() === normalizedEmail);
    if (userIndex === -1) {
      return { success: false, message: "No account found with this email." };
    }

    const updatedUsers = [...usersList];
    updatedUsers[userIndex] = { ...updatedUsers[userIndex], password: trimmedPassword };
    storeUsers(updatedUsers);
    setUsers(updatedUsers);

    const remainingRecords = cleaned.filter((entry) => !(entry.email === normalizedEmail && entry.code === trimmedCode));
    storeResetRecords(remainingRecords);

    return { success: true, message: "Password has been reset successfully." };
  }, []);

  const approveUser = useCallback((id: string) => {
    const updated = getStoredUsers().map((u) =>
      u.id === id ? { ...u, status: "approved" as UserStatus } : u
    );
    storeUsers(updated);
    setUsers(updated);
  }, []);

  const rejectUser = useCallback((id: string) => {
    const updated = getStoredUsers().map((u) =>
      u.id === id ? { ...u, status: "rejected" as UserStatus } : u
    );
    storeUsers(updated);
    setUsers(updated);
  }, []);

  const deleteUser = useCallback((id: string) => {
    const updated = getStoredUsers().filter((u) => u.id !== id);
    storeUsers(updated);
    setUsers(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, users, signup, login, requestPasswordReset, resetPassword, logout, approveUser, rejectUser, deleteUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
