package com.liftosaur.www.twa.timer

import android.content.Intent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TimerAlarmReschedulerTest {
    @Test
    fun restoresWorkoutRemindersAfterLifecycleEventsThatInvalidateOrMoveAlarms() {
        val actions = listOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            "android.intent.action.TIMEZONE_OFFSET_CHANGED",
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"
        )

        actions.forEach { action -> assertTrue("Expected reschedule for $action", shouldRestoreWorkoutReminders(action)) }
    }

    @Test
    fun ignoresUnrelatedBroadcasts() {
        assertFalse(shouldRestoreWorkoutReminders(Intent.ACTION_AIRPLANE_MODE_CHANGED))
        assertFalse(shouldRestoreWorkoutReminders(null))
    }
}
