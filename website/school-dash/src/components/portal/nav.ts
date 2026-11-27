import { BookOpenCheck, FolderOpen, TrendingUp, CalendarDays, ClipboardCheck, CalendarCheck, ClipboardList, GraduationCap, Home, MessagesSquare, Megaphone, Replace, UserRound, Users, Video, UserPlus, Shield } from "lucide-react";

/** Staff portal navigation (docs/STAFF_PORTAL_CONTRACT.md §2). `teaching` links show for teacher accounts only;
 * `addStaff` shows when the signed-in designation may add staff (functions/staffRoles.json); `reviewer` for the principal,
 * vice principal and HODs. */
export const PORTAL_NAV = [
  { href: "/me", label: "Home", icon: Home },
  { href: "/me/timetable", label: "My timetable", icon: CalendarDays, teaching: true },
  { href: "/me/attendance", label: "Class attendance", icon: CalendarCheck, teaching: true },
  { href: "/me/attendance/trends", label: "Attendance trends", icon: TrendingUp, teaching: true },
  { href: "/me/classes", label: "My classes", icon: Users, teaching: true },
  { href: "/me/assignments", label: "Assignments", icon: ClipboardList, teaching: true },
  { href: "/me/resources", label: "Resources", icon: FolderOpen, teaching: true },
  { href: "/me/marks", label: "Marks entry", icon: GraduationCap, teaching: true },
  { href: "/me/substitutions", label: "Substitutions", icon: Replace, teaching: true },
  { href: "/me/duties", label: "Exam duties", icon: Shield, teaching: true },
  { href: "/me/live", label: "Live classes", icon: Video, teaching: true },
  { href: "/me/messages", label: "Parent messages", icon: MessagesSquare, teaching: true },
  { href: "/me/lesson-plans", label: "Lesson plan reviews", icon: ClipboardCheck, reviewer: true },
  { href: "/me/leave", label: "Leave & check-in", icon: BookOpenCheck },
  { href: "/me/notices", label: "Notices", icon: Megaphone },
  { href: "/me/profile", label: "My profile", icon: UserRound },
  { href: "/me/add-staff", label: "Add staff", icon: UserPlus, addStaff: true },
] as const;
