"use client";

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type WidgetDeepLinkEvent = {
  url: string;
};

type WidgetBridgePlugin = {
  saveWidgetPayload(options: { payload: string }): Promise<void>;
  getPendingDeepLink(): Promise<{ url: string | null }>;
  addListener(
    eventName: "deepLinkOpened",
    listenerFunc: (event: WidgetDeepLinkEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
};

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");
