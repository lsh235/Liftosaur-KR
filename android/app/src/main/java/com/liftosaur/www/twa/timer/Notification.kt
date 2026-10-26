package com.liftosaur.www.twa.timer

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.AlertDialog
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.TimeZone
import kotlin.math.ceil
import java.util.concurrent.TimeUnit

internal enum class NotificationPermissionAction {
    ALLOW,
    REQUEST_RUNTIME,
    OPEN_SETTINGS
}

internal fun notificationPermissionAction(apiLevel: Int, notificationsEnabled: Boolean): NotificationPermissionAction {
    if (notificationsEnabled) return NotificationPermissionAction.ALLOW
    return if (apiLevel >= Build.VERSION_CODES.TIRAMISU) {
        NotificationPermissionAction.REQUEST_RUNTIME
    } else {
        NotificationPermissionAction.OPEN_SETTINGS
    }
}

class Notification(private val context: Context, private val activity: Activity? = null) {
    private fun showAlertOnce(permission: String, message: String, onOk: () -> Unit) {
        val act = activity ?: return
        val prefs = context.applicationContext.getSharedPreferences(PROMPTS_PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(permission, false)) return
        prefs.edit().putBoolean(permission, true).apply()
        Handler(Looper.getMainLooper()).post {
            try {
                AlertDialog.Builder(act)
                    .setMessage(message)
                    .setNeutralButton(android.R.string.ok) { dialog, _ ->
                        onOk()
                        dialog.dismiss()
                    }
                    .create()
                    .show()
            } catch (e: Exception) {
                android.util.Log.e("LftTimer", "showAlert failed", e)
            }
        }
    }

    companion object {
        const val REST_TIMER_ID: Int = 1
        const val REMINDER_ID: Int = 2
        const val WORKOUT_REMINDER_ID_START: Int = 1000
        const val WORKOUT_REMINDER_ID_LIMIT: Int = 60
        const val CHANNEL_ID_WORKOUT: String = "liftosaur_workout_reminders"
        private const val NOTIF_PERM_REQUEST_CODE: Int = 41001
        private const val PROMPTS_PREFS: String = "LftTimerPermissionPrompts"
        private const val WORKOUT_REMINDERS_PREFS: String = "LftTimerWorkoutReminders"
        private const val WORKOUT_REMINDERS_KEY: String = "pending"
        var startedIntents: MutableMap<Int, PendingIntent> = mutableMapOf()

        fun workoutReminderTimestamp(reminder: JSONObject): Long {
            val fallback = reminder.optLong("timestamp", 0L)
            val date = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").matchEntire(reminder.optString("localDate", ""))
                ?: return fallback
            val time = Regex("^(\\d{2}):(\\d{2})$").matchEntire(reminder.optString("localTime", ""))
                ?: return fallback
            val year = date.groupValues[1].toIntOrNull() ?: return fallback
            val month = date.groupValues[2].toIntOrNull() ?: return fallback
            val day = date.groupValues[3].toIntOrNull() ?: return fallback
            val hour = time.groupValues[1].toIntOrNull() ?: return fallback
            val minute = time.groupValues[2].toIntOrNull() ?: return fallback
            if (month !in 1..12 || day !in 1..31 || hour !in 0..23 || minute !in 0..59) {
                return fallback
            }

            val dateValidator = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            dateValidator.isLenient = false
            dateValidator.clear()
            dateValidator.set(year, month - 1, day, hour, minute, 0)
            try {
                dateValidator.timeInMillis
            } catch (_: IllegalArgumentException) {
                return fallback
            }

            return WorkoutReminderTime.resolveLocalTimestamp(
                year,
                month,
                day,
                hour,
                minute,
                TimeZone.getDefault()
            ) ?: fallback
        }

        fun storeWorkoutReminders(context: Context, payload: String): Boolean {
            return context.applicationContext
                .getSharedPreferences(WORKOUT_REMINDERS_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(WORKOUT_REMINDERS_KEY, payload)
                .commit()
        }

        fun restoreWorkoutReminders(context: Context) {
            val payload = context.applicationContext
                .getSharedPreferences(WORKOUT_REMINDERS_PREFS, Context.MODE_PRIVATE)
                .getString(WORKOUT_REMINDERS_KEY, null) ?: return
            val reminders = try {
                JSONArray(payload)
            } catch (e: Exception) {
                android.util.Log.e("LftTimer", "Stored workout reminders are invalid", e)
                return
            }
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                android.util.Log.i("LftTimer", "Workout reminders not restored: exact alarm access is unavailable")
                return
            }
            if (notificationPermissionAction(
                    Build.VERSION.SDK_INT,
                    NotificationManagerCompat.from(context).areNotificationsEnabled()
                ) != NotificationPermissionAction.ALLOW
            ) {
                android.util.Log.i("LftTimer", "Workout reminders not restored: notifications are disabled")
                return
            }

            val notification = Notification(context)
            for (index in 0 until WORKOUT_REMINDER_ID_LIMIT) {
                notification.cancel(WORKOUT_REMINDER_ID_START + index)
            }
            val now = System.currentTimeMillis()
            for (index in 0 until reminders.length()) {
                val reminder = reminders.optJSONObject(index) ?: continue
                val scheduleId = reminder.optInt("id", index)
                val timestamp = workoutReminderTimestamp(reminder)
                if (scheduleId !in 0 until WORKOUT_REMINDER_ID_LIMIT || timestamp <= now) continue
                val delaySeconds = ceil((timestamp - now) / 1000.0).toLong()
                notification.send(
                    WORKOUT_REMINDER_ID_START + scheduleId,
                    delaySeconds,
                    false,
                    false,
                    "TigerFit",
                    reminder.optString("title", "오늘의 운동"),
                    reminder.optString("body", "오늘의 루틴을 시작할 시간입니다."),
                    0.0f,
                    true
                )
            }
        }
    }

    fun cancel(id: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // setAlarmClock alarms survive process death, but `startedIntents` does not. Rebuild a
        // filterEquals-matching PendingIntent (extras are ignored when matching) so the alarm is
        // cancelled even after a kill/restart wiped the in-memory map; otherwise a stale rest-timer
        // would still fire after the workout was finished or discarded.
        val intent = Intent(context, TimerNotificationPublisher::class.java)
        PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )?.let { alarmManager.cancel(it) }
        startedIntents.remove(id)?.let { alarmManager.cancel(it) }
    }

    fun send(
        id: Int,
        duration: Long,
        ignoreDoNotDisturb: Boolean,
        vibration: Boolean,
        title: String?,
        subtitle: String?,
        body: String?,
        volume: Float,
        isWorkoutReminder: Boolean = false
    ): String? {
        cancel(id)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            android.util.Log.d("LftTimer", "Notification.send -> missing exactAlarm")
            showAlertOnce(
                "exactAlarm",
                "정확한 알람 권한을 허용하면 앱이 백그라운드에 있어도 운동 일정과 휴식 타이머 알림을 받을 수 있습니다."
            ) {
                val act = activity ?: return@showAlertOnce
                act.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = android.net.Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
            }
            return "exactAlarm"
        }
        val permissionAction = notificationPermissionAction(
            Build.VERSION.SDK_INT,
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        )
        if (permissionAction != NotificationPermissionAction.ALLOW) {
            android.util.Log.d("LftTimer", "Notification.send -> missing notifications permission")
            showAlertOnce(
                "notifications",
                if (permissionAction == NotificationPermissionAction.REQUEST_RUNTIME) {
                    "알림 권한을 허용하면 운동 일정과 휴식 타이머 알림을 받을 수 있습니다."
                } else {
                    "앱 알림이 꺼져 있습니다. 앱 설정에서 알림을 허용하면 운동 일정과 휴식 타이머 알림을 받을 수 있습니다."
                }
            ) {
                if (permissionAction == NotificationPermissionAction.REQUEST_RUNTIME) {
                    val act = activity as? PermissionAwareActivity ?: return@showAlertOnce
                    act.requestPermissions(
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        NOTIF_PERM_REQUEST_CODE,
                        PermissionListener { code, _, results ->
                            if (code != NOTIF_PERM_REQUEST_CODE) return@PermissionListener false
                            val granted = results.firstOrNull() == PackageManager.PERMISSION_GRANTED
                            if (granted && isWorkoutReminder) restoreWorkoutReminders(context)
                            true
                        }
                    )
                } else {
                    val act = activity ?: return@showAlertOnce
                    act.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = android.net.Uri.parse("package:${context.packageName}")
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    )
                }
            }
            return "notifications"
        }
        if (ignoreDoNotDisturb &&
            notificationManager.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL &&
            !notificationManager.isNotificationPolicyAccessGranted
        ) {
            android.util.Log.d("LftTimer", "Notification.send -> missing dndAccess")
            showAlertOnce(
                "dndAccess",
                "방해 금지 모드에서도 타이머 알림을 받으려면 알림 정책 접근 권한을 허용해 주세요. 원하지 않으면 설정에서 '방해 금지 무시'를 끌 수 있습니다."
            ) {
                val act = activity ?: return@showAlertOnce
                act.startActivity(
                    Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            return "dndAccess"
        }

        val intent = Intent(context, TimerNotificationPublisher::class.java).apply {
            putExtra("title", title)
            putExtra("subtitle", subtitle)
            putExtra("body", body)
            putExtra("ignoreDoNotDisturb", ignoreDoNotDisturb)
            putExtra("vibration", vibration)
            putExtra("notificationId", id)
            putExtra("volume", volume)
            putExtra("isWorkoutReminder", isWorkoutReminder)
        }

        val flags = PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags)
        startedIntents[id] = pendingIntent

        val delay = TimeUnit.SECONDS.toMillis(duration)
        val alarmInfo = AlarmManager.AlarmClockInfo(System.currentTimeMillis() + delay, pendingIntent)
        alarmManager.setAlarmClock(alarmInfo, pendingIntent)
        android.util.Log.d("LftTimer", "Notification.send -> scheduled, fires in ${delay}ms id=$id")
        return null
    }
}

/** Resolves a wall-clock time the same way JavaScript Date does for local reminder times. */
internal object WorkoutReminderTime {
    private const val MILLIS_PER_HOUR = 60L * 60L * 1000L

    fun resolveLocalTimestamp(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int,
        timeZone: TimeZone
    ): Long? {
        val utcCalendar = GregorianCalendar(TimeZone.getTimeZone("UTC"))
        utcCalendar.isLenient = false
        utcCalendar.clear()
        utcCalendar.set(year, month - 1, day, hour, minute, 0)
        val wallTimeMillis = try {
            utcCalendar.timeInMillis
        } catch (_: IllegalArgumentException) {
            return null
        }

        // Calendar's lenient resolution matches JavaScript's forward adjustment for a local
        // time skipped by a spring DST transition.
        val localCalendar = GregorianCalendar(timeZone)
        localCalendar.clear()
        localCalendar.set(year, month - 1, day, hour, minute, 0)
        val calendarResolution = localCalendar.timeInMillis

        // During a fall DST overlap, Calendar chooses the later (standard-time) occurrence,
        // while JavaScript Date chooses the earlier occurrence. Collect nearby offsets and
        // select the earliest instant that maps back to the requested wall-clock fields.
        val offsets = mutableSetOf<Int>()
        for (hoursFromWallTime in -72..72 step 6) {
            offsets.add(timeZone.getOffset(wallTimeMillis + hoursFromWallTime * MILLIS_PER_HOUR))
        }
        val matchingInstants = offsets.map { offset -> wallTimeMillis - offset }
            .filter { instant -> timeZone.getOffset(instant) == (wallTimeMillis - instant).toInt() }
        return matchingInstants.minOrNull() ?: calendarResolution
    }
}
