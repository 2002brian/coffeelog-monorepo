"use client";

import { Capacitor } from "@capacitor/core";
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";

function canUseNativeHaptics() {
  return Capacitor.isNativePlatform();
}

export async function triggerLightImpact() {
  if (!canUseNativeHaptics()) {
    return;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Graceful degradation for unsupported or unavailable environments.
  }
}

export async function triggerSuccessNotification() {
  if (!canUseNativeHaptics()) {
    return;
  }

  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Graceful degradation for unsupported or unavailable environments.
  }
}

export async function triggerWarningNotification() {
  if (!canUseNativeHaptics()) {
    return;
  }

  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Graceful degradation for unsupported or unavailable environments.
  }
}

export async function triggerSelectionChange() {
  if (!canUseNativeHaptics()) {
    return;
  }

  try {
    await Haptics.selectionChanged();
  } catch {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Graceful degradation for unsupported or unavailable environments.
    }
  }
}
