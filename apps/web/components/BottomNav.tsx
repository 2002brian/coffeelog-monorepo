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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-dark-surface/88 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-2xl items-end justify-between gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.external);
          const Icon = item.icon as LucideIcon;
          const isCoreAction = item.href === "/brew/new";

          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              className={`select-none relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition duration-200 active:scale-95 ${
                active ? "text-primary-default" : "text-dark-muted hover:text-text-secondary"
              }`}
            >
              {active && !isCoreAction ? (
                <span className="absolute inset-0 rounded-2xl bg-primary-default/10" />
              ) : null}
              {isCoreAction ? (
                <span
                  className={`absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-[1.2rem] border border-border-subtle ${
                    active ? "bg-cta-primary text-cta-foreground shadow-[0_8px_18px_rgba(232,97,0,0.22)]" : "bg-dark-elevated text-text-secondary"
                  }`}
                />
              ) : null}
              <Icon
                className={`relative z-10 h-[1.15rem] w-[1.15rem] ${
                  isCoreAction
                    ? active
                      ? "stroke-[2.2] text-cta-foreground"
                      : "stroke-[2.2] text-text-secondary"
                    : active
                      ? "stroke-[2.2] text-primary-default"
                      : "stroke-2 text-dark-muted"
                }`}
              />
              <span
                className={`relative z-10 ${
                  isCoreAction
                    ? active
                      ? "font-semibold text-cta-foreground"
                      : "font-medium text-text-secondary"
                    : active
                      ? "font-semibold text-primary-default"
                      : ""
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
