"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { updateBookingStatus } from "@/app/actions/bookings"
import { Eye, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Booking {
  id: string
  created_at: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  pickup_date: string
  pickup_time_window: string
  delivery_date: string
  delivery_time_window: string
  num_comforters: number
  total_amount: number
  status: string
  payment_status: string
  notes: string | null
  sms_notifications_sent: Array<{ type: string; message: string; sent_at: string }> | null
}

interface BookingsTableProps {
  bookings: Booking[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500",
  confirmed: "bg-blue-500",
  picked_up: "bg-purple-500",
  in_progress: "bg-yellow-500",
  out_for_delivery: "bg-orange-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "picked_up", label: "Picked Up" },
  { value: "in_progress", label: "In Progress" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
]

export function BookingsTable({ bookings }: BookingsTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [notes, setNotes] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking)
    setNewStatus(booking.status)
    setNotes(booking.notes || "")
    setIsDialogOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedBooking) return

    setIsUpdating(true)
    try {
      await updateBookingStatus(selectedBooking.id, newStatus, notes)
      window.location.reload() // Refresh to show updated data
    } catch (error) {
      console.error("[v0] Error updating booking:", error)
      alert("Failed to update booking")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div className="font-medium">{booking.customer_name}</div>
                    <div className="text-sm text-muted-foreground">{booking.customer_phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{format(new Date(booking.pickup_date), "MMM d, yyyy")}</div>
                    <div className="text-xs text-muted-foreground">{booking.pickup_time_window}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{format(new Date(booking.delivery_date), "MMM d, yyyy")}</div>
                    <div className="text-xs text-muted-foreground">{booking.delivery_time_window}</div>
                  </TableCell>
                  <TableCell>{booking.num_comforters}</TableCell>
                  <TableCell>${(booking.total_amount / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[booking.status]}>{booking.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(booking)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>View and update booking information</DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="space-y-2">
                <h3 className="font-semibold">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{selectedBooking.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selectedBooking.customer_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{selectedBooking.customer_phone}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium">{selectedBooking.customer_address}</p>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="space-y-2">
                <h3 className="font-semibold">Service Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pickup:</span>
                    <p className="font-medium">{format(new Date(selectedBooking.pickup_date), "PPP")}</p>
                    <p className="text-xs text-muted-foreground">{selectedBooking.pickup_time_window}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivery:</span>
                    <p className="font-medium">{format(new Date(selectedBooking.delivery_date), "PPP")}</p>
                    <p className="text-xs text-muted-foreground">{selectedBooking.delivery_time_window}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Comforters:</span>
                    <p className="font-medium">{selectedBooking.num_comforters}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-medium">${(selectedBooking.total_amount / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* SMS Notifications History */}
              {selectedBooking.sms_notifications_sent && selectedBooking.sms_notifications_sent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <h3 className="font-semibold">SMS Notifications Sent</h3>
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {selectedBooking.sms_notifications_sent.map((sms, index) => (
                          <div key={index} className="border-b border-border pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{sms.type.replace("_", " ")}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(sms.sent_at), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="mt-1 text-sm">{sms.message}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Status Update */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Changing status will automatically send an SMS notification to the customer
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this booking..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full">
                  {isUpdating ? "Updating..." : "Update Booking & Send SMS"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
