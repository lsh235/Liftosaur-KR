package com.liftosaur.www.twa.timer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.GregorianCalendar
import java.util.TimeZone

class WorkoutReminderTimeTest {
    private val newYork = TimeZone.getTimeZone("America/New_York")

    @Test
    fun ambiguousFallBackTimeUsesEarlierOccurrenceLikeJavaScriptDate() {
        val actual = WorkoutReminderTime.resolveLocalTimestamp(2026, 11, 1, 1, 30, newYork)

        assertEquals(utcTimestamp(2026, 11, 1, 5, 30), actual)
    }

    @Test
    fun nonexistentSpringForwardTimeMovesForwardByTheGap() {
        val actual = WorkoutReminderTime.resolveLocalTimestamp(2026, 3, 8, 2, 30, newYork)

        assertEquals(utcTimestamp(2026, 3, 8, 7, 30), actual)
    }

    @Test
    fun invalidWallClockDateIsRejected() {
        assertNull(WorkoutReminderTime.resolveLocalTimestamp(2026, 2, 30, 19, 0, newYork))
    }

    private fun utcTimestamp(year: Int, month: Int, day: Int, hour: Int, minute: Int): Long {
        return GregorianCalendar(TimeZone.getTimeZone("UTC")).run {
            clear()
            set(year, month - 1, day, hour, minute, 0)
            timeInMillis
        }
    }
}
