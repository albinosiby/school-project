import { BookOpenCheck, CalendarDays, ClipboardCheck, GraduationCap, Banknote, LayoutDashboard, MessagesSquare, Settings2, UserPlus, Users, Briefcase, BookText, School, Video } from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admissions", label: "Admissions", icon: UserPlus },
  { href: "/students", label: "Students & Guardians", icon: Users },
  { href: "/staff", label: "Staff & HR", icon: Briefcase },
  { href: "/classes", label: "Classes & Assignments", icon: School },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/live-classes", label: "Live Classes", icon: Video },
  { href: "/academics", label: "Academics & Homework", icon: BookText },
  { href: "/exams", label: "Exams & Results", icon: GraduationCap },
  { href: "/fees", label: "Fees & Payments", icon: Banknote },
  { href: "/communication", label: "Communication & Reports", icon: MessagesSquare },
  { href: "/settings", label: "Settings & Year End", icon: Settings2 },
] as const;

export const EXTRA_PAGES = [
  { href: "/setup", label: "Setup Wizard" },
  { href: "/approvals", label: "Approvals Inbox" },
  { href: "/calendar", label: "Academic Calendar" },
  { href: "/notifications", label: "Notifications" },
  { href: "/profile", label: "My Profile" },
] as const;
export { BookOpenCheck };
