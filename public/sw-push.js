/*
 * Service worker do LocaTech — responsável só por push notifications.
 * Outras responsabilidades (offline, cache) podem ser adicionadas depois.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "LocaTech", body: event.data.text() }
  }

  const title = payload.title || "LocaTech"
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: payload.tag,
    data: { url: payload.url || "/dashboard" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/dashboard"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Se já tem janela aberta no domínio, foca e navega
      for (const w of wins) {
        if ("focus" in w) {
          w.focus()
          if ("navigate" in w) w.navigate(target)
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target)
      }
    })
  )
})
