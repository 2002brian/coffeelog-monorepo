"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bean,
  Compass,
  Droplets,
  FlaskConical,
  HelpCircle,
  Microscope,
  type LucideIcon,
} from "lucide-react";

const supportHref =
  process.env.NEXT_PUBLIC_SUPPORT_FORM_URL?.trim() || "/support";
const supportIsExternal = /^https?:\/\//.test(supportHref);

const items = [
  { href: "/", icon: Compass, label: "首頁" },
  { href: "/beans", icon: Bean, label: "豆單" },
  { href: "/equipment", icon: FlaskConical, label: "器具" },
  { href: "/brew/new", icon: Droplets, label: "沖煮" },
  { href: "/records", icon: Microscope, label: "紀錄" },
  {
    href: supportHref,
    icon: HelpCircle,
    label: "支援",
    external: supportIsExternal,
  },
];

function isActive(pathname: string, href: string, external?: boolean) {
  if (external) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/brew/new") {
    return pathname === "/brew" || pathname.startsWith("/brew/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-panel fixed bottom-0 left-0 right-0 z-50 rounded-none border-x-0 border-b-0 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2">
      <div className="mx-auto flex w-full max-w-2xl items-end justify-between gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.external);
          const Icon = item.icon as LucideIcon;

          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              className={`select-none relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-[13px] font-medium transition duration-200 active:scale-95 ${
                active ? "text-cta-primary" : "text-dark-muted hover:text-text-secondary"
              }`}
            >
              {active ? (
                <span className="glass-chip absolute inset-0 rounded-2xl bg-cta-primary/14" />
              ) : null}
              <Icon
                className={`relative z-10 h-[1.15rem] w-[1.15rem] ${
                  active
                    ? "stroke-[2.2] text-cta-primary"
                    : "stroke-2 text-dark-muted"
                }`}
              />
              <span
                className={`relative z-10 ${
                  active ? "font-semibold text-cta-primary" : "font-medium text-text-secondary"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
