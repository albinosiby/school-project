import { Award, BookOpenCheck, Bus, GraduationCap, Banknote, LayoutDashboard, MessagesSquare, Settings2, UserPlus, Users, Briefcase, School } from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admissions", label: "Admissions", icon: UserPlus },
  { href: "/students", label: "Students & Guardians", icon: Users },
  { href: "/certificates", label: "Certificates", icon: Award },
  { href: "/staff", label: "Staff & HR", icon: Briefcase },
  { href: "/classes", label: "Classes & Assignments", icon: School },
  { href: "/transport", label: "Transport", icon: Bus },
  { href: "/exams", label: "Exams & Results", icon: GraduationCap },
  { href: "/fees", label: "Fees & Payments", icon: Banknote },
  { href: "/communication", label: "Communication & Reports", icon: MessagesSquare },
  { href: "/settings", label: "Settings & Year End", icon: Settings2 },
] as const;

export const EXTRA_PAGES = [
  { href: "/settings?section=timetable", label: "Timetable" },
  { href: "/approvals", label: "Approvals Inbox" },
  { href: "/calendar", label: "Academic Calendar" },
  { href: "/notifications", label: "Notifications" },
  { href: "/communication", label: "Circulars & Notices" },
  { href: "/profile", label: "My Profile" },
] as const;
export { BookOpenCheck };
