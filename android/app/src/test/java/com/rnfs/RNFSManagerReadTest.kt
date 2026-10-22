package com.rnfs

import org.junit.Assert.assertArrayEquals
import org.junit.Test
import java.io.InputStream

class RNFSManagerReadTest {
    @Test
    fun fillsRequestedRangeAcrossShortReadsAndShortSkips() {
        val stream = ChunkedInputStream(byteArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8), maxRead = 2, maxSkip = 1)

        val actual = RNFSManager.readRange(stream, 4, 3)

        assertArrayEquals(byteArrayOf(3, 4, 5, 6), actual)
    }

    @Test
    fun advancesWhenSkipReturnsZero() {
        val stream = ChunkedInputStream(byteArrayOf(10, 11, 12, 13, 14), maxRead = 3, maxSkip = 0)

        val actual = RNFSManager.readRange(stream, 2, 2)

        assertArrayEquals(byteArrayOf(12, 13), actual)
    }

    @Test
    fun returnsAvailableBytesWhenReadingPastEnd() {
        val stream = ChunkedInputStream(byteArrayOf(20, 21, 22), maxRead = 1, maxSkip = 1)

        val actual = RNFSManager.readRange(stream, 10, 1)

        assertArrayEquals(byteArrayOf(21, 22), actual)
    }

    @Test
    fun readsToEndWhenLengthIsZeroAndReturnsEmptyForAnEmptyStream() {
        val stream = ChunkedInputStream(byteArrayOf(30, 31, 32, 33), maxRead = 2, maxSkip = 1)

        val rest = RNFSManager.readRange(stream, 0, 2)
        val empty = RNFSManager.readRange(ChunkedInputStream(byteArrayOf(), 2, 1), 8, 0)

        assertArrayEquals(byteArrayOf(32, 33), rest)
        assertArrayEquals(byteArrayOf(), empty)
    }

    private class ChunkedInputStream(
        private val bytes: ByteArray,
        private val maxRead: Int,
        private val maxSkip: Int
    ) : InputStream() {
        private var position = 0

        override fun read(): Int {
            return if (position >= bytes.size) -1 else bytes[position++].toInt() and 0xff
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (position >= bytes.size) {
                return -1
            }
            val count = minOf(length, maxRead, bytes.size - position)
            System.arraycopy(bytes, position, buffer, offset, count)
            position += count
            return count
        }

        override fun skip(count: Long): Long {
            val skipped = minOf(count, maxSkip.toLong(), (bytes.size - position).toLong()).toInt()
            position += skipped
            return skipped.toLong()
        }
    }
}
