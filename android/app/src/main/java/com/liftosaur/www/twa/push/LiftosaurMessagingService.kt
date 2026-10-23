package com.liftosaur.www.twa.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.liftosaur.www.twa.BuildConfig

class LiftosaurMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        if (!BuildConfig.LOCAL_ONLY) PushDispatcher.emitToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (!BuildConfig.LOCAL_ONLY) PushDispatcher.emitPush(message.data)
    }
}
