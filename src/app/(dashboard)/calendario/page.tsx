"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar"
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop"
import { format, parse, startOfWeek, getDay, addHours, differenceInDays } from "date-fns"

import "react-big-calendar/lib/addons/dragAndDrop/styles.css"
import { ptBR } from "date-fns/locale"
import {
  Clock,
  Truck,
  Wrench,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

import "react-big-calendar/lib/css/react-big-calendar.css"

const locales = {
  "pt-BR": ptBR,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar)

interface Rental {
  id: string
  contractNumber: number
  customer: {
    id: string
    name: string
    phone: string
  }
  startDate: string
  expectedEndDate: string
  actualEndDate?: string
  type: "DELIVERY" | "PICKUP"
  status: string
  paymentStatus: string
  total: number
  items: Array<{
    equipmentCode: string
    equipmentName: string
  }>
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: "ENTREGA" | "DEVOLUCAO" | "VENCIMENTO"
  rental: Rental
  allDay?: boolean
}

const messages = {
  date: "Data",
  time: "Hora",
  event: "Evento",
  allDay: "Dia inteiro",
  week: "Semana",
  work_week: "Semana de trabalho",
  day: "Dia",
  month: "Mes",
  previous: "Anterior",
  next: "Proximo",
  yesterday: "Ontem",
  tomorrow: "Amanha",
  today: "Hoje",
  agenda: "Agenda",
  noEventsInRange: "Não há eventos neste período",
  showMore: (total: number) => `+ ${total} mais`,
}

function getEventoIcon(tipo: string) {
  switch (tipo) {
    case "ENTREGA":
      return <Truck className="h-3 w-3" />
    case "DEVOLUCAO":
      return <RotateCcw className="h-3 w-3" />
    case "VENCIMENTO":
      return <AlertTriangle className="h-3 w-3" />
    default:
      return <Clock className="h-3 w-3" />
  }
}

function getEventoColor(tipo: string) {
  switch (tipo) {
    case "ENTREGA":
      return { backgroundColor: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" }
    case "DEVOLUCAO":
      return { backgroundColor: "#dcfce7", color: "#166534", borderColor: "#86efac" }
    case "VENCIMENTO":
      return { backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" }
    default:
      return { backgroundColor: "#f3f4f6", color: "#374151", borderColor: "#d1d5db" }
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export default function CalendarioPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("all")
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState(Views.MONTH)

  useEffect(() => {
    fetchRentals()
  }, [])

  async function fetchRentals() {
    try {
      const response = await fetch("/api/rentals")
      if (response.ok) {
        const data = await response.json()
        setRentals(data)
      }
    } catch (error) {
      console.error("Error fetching rentals:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  const events = useMemo<CalendarEvent[]>(() => {
    const eventsList: CalendarEvent[] = []

    rentals.forEach((rental) => {
      // Evento de entrega/inicio
      if (["CONFIRMED", "IN_PROGRESS", "OVERDUE", "RETURNED", "COMPLETED"].includes(rental.status)) {
        const startDate = new Date(rental.startDate)
        eventsList.push({
          id: `${rental.id}-start`,
          title: `${rental.type === "DELIVERY" ? "Entrega" : "Inicio"} - ${rental.customer.name}`,
          start: startDate,
          end: addHours(startDate, 2),
          type: "ENTREGA",
          rental,
        })
      }

      // Evento de devolucao prevista
      if (["IN_PROGRESS", "OVERDUE"].includes(rental.status)) {
        const endDate = new Date(rental.expectedEndDate)
        const isOverdue = rental.status === "OVERDUE"

        eventsList.push({
          id: `${rental.id}-end`,
          title: `${isOverdue ? "Atrasado" : "Devolucao"} - ${rental.customer.name}`,
          start: endDate,
          end: addHours(endDate, 2),
          type: isOverdue ? "VENCIMENTO" : "DEVOLUCAO",
          rental,
        })
      }

      // Se ja foi devolvido, mostrar a data real de devolucao
      if (rental.actualEndDate && ["RETURNED", "COMPLETED"].includes(rental.status)) {
        const actualEnd = new Date(rental.actualEndDate)
        eventsList.push({
          id: `${rental.id}-returned`,
          title: `Devolvido - ${rental.customer.name}`,
          start: actualEnd,
          end: addHours(actualEnd, 2),
          type: "DEVOLUCAO",
          rental,
        })
      }
    })

    // Filtrar por tipo
    if (filterType !== "all") {
      return eventsList.filter((e) => e.type === filterType)
    }

    return eventsList
  }, [rentals, filterType])

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedEvent(event as CalendarEvent)
    setIsEventDialogOpen(true)
  }, [])

  const handleEventDrop = useCallback(
    async ({ event, start }: any) => {
      // Calculate the difference in days from the original date
      const originalStart = event.start
      const newStart = typeof start === 'string' ? new Date(start) : start
      const daysDiff = differenceInDays(newStart, originalStart)

      if (daysDiff === 0) return // No change

      // Only allow rescheduling for events that are not yet started
      if (event.rental.status !== "CONFIRMED") {
        toast.error("Apenas locações confirmadas podem ser reagendadas")
        return
      }

      try {
        const response = await fetch(`/api/rentals/${event.rental.id}/reschedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daysDiff }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Erro ao reagendar")
        }

        toast.success("Locação reagendada com sucesso!")
        fetchRentals() // Reload data
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao reagendar locação")
      }
    },
    [fetchRentals]
  )

  const eventStyleGetter = useCallback((event: any) => {
    const colors = getEventoColor(event.type)
    return {
      style: {
        backgroundColor: colors.backgroundColor,
        color: colors.color,
        border: `1px solid ${colors.borderColor}`,
        borderRadius: "4px",
        padding: "2px 4px",
        fontSize: "12px",
      },
    }
  }, [])

  const EventComponent = ({ event }: any) => (
    <div className="flex items-center gap-1">
      {getEventoIcon(event.type)}
      <span className="truncate">{event.title}</span>
    </div>
  )

  // Proximos eventos (ordenados por data)
  const proximosEventos = useMemo(() => {
    const now = new Date()
    return events
      .filter((e) => e.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
  }, [events])

  // Eventos atrasados
  const eventosAtrasados = useMemo(() => {
    return events.filter((e) => e.type === "VENCIMENTO").length
  }, [events])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-muted-foreground">
            Visualize entregas, devolucoes e vencimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ENTREGA">Entregas</SelectItem>
              <SelectItem value="DEVOLUCAO">Devolucoes</SelectItem>
              <SelectItem value="VENCIMENTO">Vencimentos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {events.filter((e) => e.type === "ENTREGA").length}
                </p>
                <p className="text-xs text-muted-foreground">Entregas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <RotateCcw className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {events.filter((e) => e.type === "DEVOLUCAO").length}
                </p>
                <p className="text-xs text-muted-foreground">Devolucoes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventosAtrasados}</p>
                <p className="text-xs text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Calendario — rola por dentro no celular em vez de alargar a página */}
        <Card className="min-w-0 lg:col-span-3">
          <CardContent className="overflow-x-auto p-4">
            <style jsx global>{`
              .rbc-calendar {
                font-family: inherit;
              }
              .rbc-toolbar button {
                color: #374151;
                border-color: #e5e7eb;
              }
              .rbc-toolbar button:hover {
                background-color: #f3f4f6;
                border-color: #d1d5db;
              }
              .rbc-toolbar button.rbc-active {
                background-color: #3b82f6;
                color: white;
                border-color: #3b82f6;
              }
              .rbc-header {
                padding: 8px;
                font-weight: 500;
                color: #374151;
              }
              .rbc-today {
                background-color: #eff6ff;
              }
              .rbc-off-range-bg {
                background-color: #f9fafb;
              }
              .rbc-event {
                padding: 2px 4px;
              }
              .rbc-show-more {
                color: #3b82f6;
              }
            `}</style>
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor={(event: any) => event.start}
              endAccessor={(event: any) => event.end}
              style={{ height: 600, minWidth: 640 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              view={view}
              onView={(newView: any) => setView(newView)}
              date={currentDate}
              onNavigate={(newDate: Date) => setCurrentDate(newDate)}
              messages={messages}
              culture="pt-BR"
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              draggableAccessor={(event: any) => event.rental.status === "CONFIRMED"}
              resizable={false}
              eventPropGetter={eventStyleGetter}
              components={{
                event: EventComponent,
              }}
            />
          </CardContent>
        </Card>

        {/* Sidebar - Proximos eventos */}
        <div className="min-w-0 space-y-4">
          {/* Legenda */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100">
                  <Truck className="h-3 w-3 text-blue-800" />
                </div>
                <span className="text-sm">Entrega/Inicio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100">
                  <RotateCcw className="h-3 w-3 text-green-800" />
                </div>
                <span className="text-sm">Devolucao</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-red-100">
                  <AlertTriangle className="h-3 w-3 text-red-800" />
                </div>
                <span className="text-sm">Atrasado</span>
              </div>
            </CardContent>
          </Card>

          {/* Proximos eventos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Próximos Eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proximosEventos.map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-start gap-2 rounded-lg border p-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSelectEvent(evento)}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                    style={getEventoColor(evento.type)}
                  >
                    {getEventoIcon(evento.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {evento.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {evento.rental.items.map((i) => i.equipmentName).join(", ")}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(evento.start, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {proximosEventos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum evento futuro encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && getEventoIcon(selectedEvent.type)}
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && `Contrato LOC-${selectedEvent.rental.contractNumber.toString().padStart(4, "0")}`}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedEvent.rental.customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.rental.customer.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(selectedEvent.start, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Equipamentos</p>
                <div className="mt-1 space-y-1">
                  {selectedEvent.rental.items.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="text-muted-foreground">{item.equipmentCode}</span> -{" "}
                      {item.equipmentName}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    className={
                      selectedEvent.rental.status === "OVERDUE"
                        ? "bg-red-100 text-red-800"
                        : selectedEvent.rental.status === "IN_PROGRESS"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {selectedEvent.rental.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="font-medium">{formatCurrency(selectedEvent.rental.total)}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <a
                  href={`/locacoes?id=${selectedEvent.rental.id}`}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Eye className="h-4 w-4" />
                  Ver detalhes da locação
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
