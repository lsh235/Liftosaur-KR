package com.liftosaur.www.twa.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

internal fun shouldRestoreWorkoutReminders(action: String?): Boolean {
    return when (action) {
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_MY_PACKAGE_REPLACED,
        Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED,
        "android.intent.action.TIMEZONE_OFFSET_CHANGED",
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> true
        else -> false
    }
}

class TimerAlarmRescheduler : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (shouldRestoreWorkoutReminders(intent.action)) {
            Notification.restoreWorkoutReminders(context)
        }
    }
}
