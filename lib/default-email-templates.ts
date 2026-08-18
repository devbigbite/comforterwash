// Starter transactional email copy every new tenant gets.
//
// email_templates rows are per-location OVERRIDES read by lib/email.ts. A
// tenant with no rows still receives working email (lib/email-templates.ts has
// hardcoded English defaults baked in), but /admin/templates shows "No
// templates for this audience yet" and they cannot change a single word. So
// provisioning seeds these rows to give them something to edit.
//
// Deliberately generic: no business name, no address, no support email. Those
// are injected at send time from the tenant's own branding.

export interface DefaultEmailTemplate {
  key: string
  name: string
  audience: "customer" | "admin" | "staff" | "facility"
  subject: string
  headline: string
  body: string
  cta_text: string | null
  footer_note: string | null
  alert_box: string | null
  contact_note: string | null
  variables: { key: string; label: string; example: string }[]
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: "customer_booking_confirmation",
    name: "Booking Confirmation",
    audience: "customer",
    subject: "✅ Booking confirmed — {{service_type}} pickup {{pickup_date}}",
    headline: "You're all set, {{first_name}}!",
    body: "Your laundry pickup is scheduled. We'll send a reminder the morning of pickup — just have everything ready.",
    cta_text: null,
    footer_note: null,
    alert_box: null,
    contact_note: null,
    variables: [{"key": "first_name", "label": "First Name", "example": "Maria"}, {"key": "customer_name", "label": "Full Name", "example": "Maria Lopez"}, {"key": "service_type", "label": "Service Type", "example": "Wash & Fold"}, {"key": "pickup_date", "label": "Pickup Date", "example": "Mon, May 12"}, {"key": "pickup_time", "label": "Pickup Time Window", "example": "8AM–12PM"}, {"key": "delivery_date", "label": "Delivery Date", "example": "Wed, May 14"}, {"key": "delivery_time", "label": "Delivery Time Window", "example": "8AM–12PM"}, {"key": "address", "label": "Pickup Address", "example": "123 Main St"}, {"key": "total", "label": "Estimated Total", "example": "$48.00"}, {"key": "order_id", "label": "Order ID (short)", "example": "A1B2C3D4"}],
  },
  {
    key: "pickup_reminder",
    name: "Pickup Reminder",
    audience: "customer",
    subject: "🚐 Reminder: Your laundry pickup is {{day_word}}.",
    headline: "Your pickup is {{day_word}}!",
    body: "Just a quick reminder — our driver will be at your door {{day_word}} between {{pickup_time}}. Please have your laundry ready by the start of your window. You may leave your bags right next to your door.",
    cta_text: null,
    footer_note: null,
    alert_box: "📦 <strong>Getting ready?</strong> Please have your laundry in bags near the front door.",
    contact_note: "Need to reschedule or have questions? Please contact us as soon as possible.",
    variables: [{"key": "first_name", "label": "First Name", "example": "Maria"}, {"key": "pickup_time", "label": "Pickup Time Window", "example": "8AM–12PM"}, {"key": "address", "label": "Pickup Address", "example": "123 Main St"}, {"key": "order_id", "label": "Order ID", "example": "A1B2C3D4"}],
  },
  {
    key: "order_picked_up",
    name: "Order Picked Up",
    audience: "customer",
    subject: "✅ Hi {{first_name}}! We've got your laundry.",
    headline: "Your laundry has been picked up!",
    body: "Great news — your laundry is on its way to our facility. We'll keep you updated every step of the way. Estimated delivery: {{delivery_date}} between {{delivery_time}}.",
    cta_text: null,
    footer_note: null,
    alert_box: null,
    contact_note: null,
    variables: [{"key": "first_name", "label": "First Name", "example": "Maria"}, {"key": "delivery_date", "label": "Delivery Date", "example": "Wed, May 14"}, {"key": "delivery_time", "label": "Delivery Time Window", "example": "8AM–12PM"}, {"key": "order_id", "label": "Order ID", "example": "A1B2C3D4"}],
  },
  {
    key: "out_for_delivery",
    name: "Out for Delivery",
    audience: "customer",
    subject: "🚐 Hi {{first_name}}! Your clean laundry is on its way.",
    headline: "Your laundry is out for delivery!",
    body: "Your freshly cleaned and folded laundry is on its way back to you. Our driver will arrive today between {{delivery_time}}.",
    cta_text: null,
    footer_note: null,
    alert_box: null,
    contact_note: null,
    variables: [{"key": "first_name", "label": "First Name", "example": "Maria"}, {"key": "delivery_time", "label": "Delivery Time Window", "example": "8AM–12PM"}, {"key": "order_id", "label": "Order ID", "example": "A1B2C3D4"}],
  },
  {
    key: "delivered",
    name: "Delivered",
    audience: "customer",
    subject: "🎉 Hi {{first_name}}! Your laundry has been delivered.",
    headline: "Delivery complete — enjoy the freshness!",
    body: "Your clean laundry has been delivered. We hope everything looks great! If you have any questions or feedback, don't hesitate to reach out.",
    cta_text: "Book Your Next Pickup",
    footer_note: null,
    alert_box: null,
    contact_note: null,
    variables: [{"key": "first_name", "label": "First Name", "example": "Maria"}, {"key": "order_id", "label": "Order ID", "example": "A1B2C3D4"}, {"key": "total", "label": "Final Total", "example": "$52.50"}],
  },
  {
    key: "admin_new_order",
    name: "New Order Alert (Admin)",
    audience: "admin",
    subject: "🧺 New {{service_type}} booking — {{customer_name}} · {{pickup_date}}",
    headline: "New booking received",
    body: "A new order has been placed and requires your attention.",
    cta_text: null,
    footer_note: null,
    alert_box: null,
    contact_note: null,
    variables: [{"key": "customer_name", "label": "Customer Name", "example": "Maria Lopez"}, {"key": "service_type", "label": "Service Type", "example": "Wash & Fold"}, {"key": "pickup_date", "label": "Pickup Date", "example": "Mon, May 12"}, {"key": "address", "label": "Pickup Address", "example": "123 Main St"}, {"key": "total", "label": "Estimated Total", "example": "$48.00"}, {"key": "order_id", "label": "Order ID", "example": "A1B2C3D4"}],
  },
]
