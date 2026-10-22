package com.liftosaur.www.twa.timer

import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationPermissionTest {
    @Test
    fun enabledNotificationsAllowSchedulingOnEveryAndroidVersion() {
        assertEquals(NotificationPermissionAction.ALLOW, notificationPermissionAction(Build.VERSION_CODES.S, true))
        assertEquals(NotificationPermissionAction.ALLOW, notificationPermissionAction(Build.VERSION_CODES.TIRAMISU, true))
    }

    @Test
    fun disabledNotificationsUseRuntimePermissionOnAndroid13AndNewer() {
        assertEquals(
            NotificationPermissionAction.REQUEST_RUNTIME,
            notificationPermissionAction(Build.VERSION_CODES.TIRAMISU, false)
        )
    }

    @Test
    fun disabledNotificationsOpenSettingsOnOlderAndroidVersions() {
        assertEquals(
            NotificationPermissionAction.OPEN_SETTINGS,
            notificationPermissionAction(Build.VERSION_CODES.S, false)
        )
    }
}
