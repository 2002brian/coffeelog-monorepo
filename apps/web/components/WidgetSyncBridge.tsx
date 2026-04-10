"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo } from "react";
import { WidgetBridge } from "@/lib/native/widgetBridge";
import { serializeWidgetPayload, useWidgetPayload } from "@/lib/widgetData";

function isNativeIOS() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function parseWidgetRoute(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "coffeelog:") {
      return null;
    }

    const segments = [url.host, ...url.pathname.split("/").filter(Boolean)].filter(Boolean);
    const pathname = segments.length > 0 ? `/${segments.join("/")}` : "/";

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export default function WidgetSyncBridge() {
  const payload = useWidgetPayload();
  const pathname = usePathname();
  const router = useRouter();
  const serializedPayload = useMemo(() => {
    if (!payload) {
      return null;
    }

    return JSON.stringify(serializeWidgetPayload(payload));
  }, [payload]);

  useEffect(() => {
    if (!isNativeIOS()) {
      return;
    }

    let mounted = true;
    let removeListener: (() => void) | undefined;

    function navigateFromWidget(rawUrl: string) {
      const target = parseWidgetRoute(rawUrl);

      if (!target || target === pathname) {
        return;
      }

      startTransition(() => {
        router.push(target);
      });
    }

    void (async () => {
      const pending = await WidgetBridge.getPendingDeepLink();

      if (mounted && pending.url) {
        navigateFromWidget(pending.url);
      }

      const listener = await WidgetBridge.addListener("deepLinkOpened", ({ url }) => {
        navigateFromWidget(url);
      });

      removeListener = () => {
        void listener.remove();
      };
    })();

    return () => {
      mounted = false;
      removeListener?.();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!isNativeIOS() || !serializedPayload) {
      return;
    }

    void WidgetBridge.saveWidgetPayload({
      payload: serializedPayload,
    });
  }, [serializedPayload]);

  return null;
}
