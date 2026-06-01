"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Hook pra gerenciar push notifications no client.
 *
 * Estados expostos:
 *   - supported: navegador suporta service worker + push
 *   - permission: 'default' | 'granted' | 'denied'
 *   - subscribed: já tem subscription ativa
 *   - enable() / disable() / sendTest()
 *
 * Não causa side-effects no mount — chama apenas quando o user clica.
 */
export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    setSupported(ok)
    if (ok) {
      setPermission(Notification.permission)
      checkExisting()
    }
  }, [])

  async function checkExisting() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js")
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {
      // ignore
    }
  }

  const enable = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!supported) return { ok: false, error: "Não suportado neste navegador" }
    setLoading(true)
    try {
      // 1. Permissão
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") {
        return { ok: false, error: "Permissão negada" }
      }

      // 2. Buscar public key do servidor
      const pkResponse = await fetch("/api/push/public-key")
      if (!pkResponse.ok) {
        return {
          ok: false,
          error: "Servidor não tem VAPID configurado",
        }
      }
      const { publicKey } = await pkResponse.json()

      // 3. Registrar SW
      const reg = await navigator.serviceWorker.register("/sw-push.js")
      await navigator.serviceWorker.ready

      // 4. Subscribe — cast pra contornar incompatibilidade de tipos
      // entre Uint8Array<ArrayBufferLike> e BufferSource em TS 5.4+
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })

      // 5. Enviar pro server
      const subResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!subResponse.ok) {
        return { ok: false, error: "Falha ao registrar no servidor" }
      }

      setSubscribed(true)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Erro" }
    } finally {
      setLoading(false)
    }
  }, [supported])

  const disable = useCallback(async (): Promise<{ ok: boolean }> => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js")
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch(
            `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
            { method: "DELETE" }
          )
          await sub.unsubscribe()
        }
      }
      setSubscribed(false)
      return { ok: true }
    } finally {
      setLoading(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    await fetch("/api/push/test", { method: "POST" })
  }, [])

  return { supported, permission, subscribed, loading, enable, disable, sendTest }
}

// Helper: converte base64url do VAPID pra Uint8Array que a Push API espera
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}
