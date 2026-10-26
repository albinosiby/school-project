import Image from "next/image";

/** The product logo (graduation cap over students and an open book), transparent background. */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return <Image src="/logo.png" alt="EduAdmin logo" width={size} height={size} className={className} priority />;
}
