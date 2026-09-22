package com.haiva.app

import java.util.concurrent.atomic.AtomicReference

/**
 * Single physical microphone ownership guard for native voice paths.
 *
 * ASR and duplex VAD may both exist in the process, but only one may own
 * the physical microphone at a time. Owners must release before another
 * capture path can acquire the microphone.
 */
object MicOwnership {
    enum class Owner {
        NONE,
        ASR,
        DUPLEX_VAD
    }

    private val currentOwner = AtomicReference(Owner.NONE)

    fun tryAcquire(requested: Owner): Boolean {
        if (requested == Owner.NONE) return false
        while (true) {
            val current = currentOwner.get()
            if (current == requested) return true
            if (current != Owner.NONE) return false
            if (currentOwner.compareAndSet(Owner.NONE, requested)) return true
        }
    }

    fun release(owner: Owner) {
        currentOwner.compareAndSet(owner, Owner.NONE)
    }

    fun current(): Owner = currentOwner.get()
}
