"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

function canUseLocalNotifications() {
  return Capacitor.isNativePlatform();
}

function createNotificationId(beanName: string, peakDate: string) {
  const seed = `${beanName}:${peakDate}`;

  return seed.split("").reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 2147483647;
  }, 17);
}

export async function schedulePeakNotification(
  beanName: string,
  peakDate: string
) {
  if (!canUseLocalNotifications()) {
    return false;
  }

  const scheduledAt = new Date(peakDate);

  if (Number.isNaN(scheduledAt.getTime())) {
    return false;
  }

  scheduledAt.setHours(9, 0, 0, 0);

  if (scheduledAt.getTime() <= Date.now()) {
    return false;
  }

  try {
    const permission = await LocalNotifications.requestPermissions();

    if (permission.display !== "granted") {
      return false;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: createNotificationId(beanName, peakDate),
          title: "CoffeeLog 最佳賞味提醒",
          body: `${beanName} 今天進入建議賞味期，記得安排一杯。`,
          schedule: {
            at: scheduledAt,
          },
          extra: {
            beanName,
            peakDate,
          },
        },
      ],
    });

    return true;
  } catch {
    return false;
  }
}
