package com.liftosaur.www.twa.timer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TimerAlarmRescheduler : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> {
                Notification.restoreWorkoutReminders(context)
            }
        }
    }
}
