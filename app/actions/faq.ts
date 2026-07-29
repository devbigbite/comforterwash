"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getLocationId, getBranding } from "@/lib/location"
import { requireAdmin } from "@/lib/auth-guard"

export type FaqCategory = "general" | "comforter_wash" | "wash_fold"

export type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
  question_es?: string | null
  answer_es?: string | null
  sort_order: number
  active: boolean
}

// ── Default content (shown if DB is empty) ────────────────────────────────────

const DEFAULTS: FaqItem[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    id: "gen-1", category: "general", sort_order: 1, active: true,
    question: "How does the service work?",
    answer: "It's simple: book online, leave your laundry outside, and we take care of the rest. Our driver picks up your bag during your chosen window, we wash and fold everything at our facility, and return it to your door — typically the next day. You'll receive text updates at every step.",
    question_es: "¿Cómo funciona el servicio?",
    answer_es: "Es sencillo: reserva en línea, deja tu ropa fuera y nosotros nos encargamos del resto. Nuestro conductor recoge tu bolsa durante la ventana que elijas, lavamos y doblamos todo en nuestra instalación, y lo devolvemos a tu puerta — generalmente al día siguiente. Recibirás actualizaciones por texto en cada paso.",
  },
  {
    id: "gen-2", category: "general", sort_order: 2, active: true,
    question: "What areas do you serve?",
    answer: "We serve your local area — enter your zip code at the start of the booking to confirm availability in your neighborhood. If you're outside our current service area, email us at clean@washfoldorlando.com and we'll add you to the waitlist.",
    question_es: "¿Qué áreas atienden?",
    answer_es: "Atendemos tu área local — ingresa tu código postal al inicio de la reserva para confirmar disponibilidad en tu vecindario. Si estás fuera de nuestra área de servicio, escríbenos a clean@washfoldorlando.com y te añadiremos a la lista de espera.",
  },
  {
    id: "gen-3", category: "general", sort_order: 3, active: true,
    question: "What are your pickup and delivery windows?",
    answer: "Pickup and delivery windows vary by neighborhood and route, and are shown when you book. You'll choose a specific window for your pickup and delivery at checkout, and we'll text you when your driver is on the way.",
    question_es: "¿Cuáles son sus horarios de recogida y entrega?",
    answer_es: "Los horarios de recogida y entrega varían según el vecindario y la ruta, y se muestran al reservar. Eliges una ventana específica para tu recogida y entrega al pagar, y te enviaremos un mensaje de texto cuando tu conductor esté en camino.",
  },
  {
    id: "gen-4", category: "general", sort_order: 4, active: true,
    question: "What do I put my laundry in?",
    answer: "Any bag works — trash bags, tote bags, laundry bags, whatever you have. You don't need to label anything; our driver will tag your order at pickup. The only thing we can't accept is loose items or open laundry baskets.",
    question_es: "¿En qué pongo mi ropa?",
    answer_es: "Cualquier bolsa funciona — bolsas de basura, tote bags, bolsas de lavandería, lo que tengas. No necesitas etiquetar nada; nuestro conductor registrará tu pedido en la recogida. Lo único que no podemos aceptar son artículos sueltos o canastas abiertas.",
  },
  {
    id: "gen-5", category: "general", sort_order: 5, active: true,
    question: "Do you check pockets?",
    answer: "We do our best, but with high order volume we cannot guarantee every pocket is checked before washing. Please remove all items from pockets before sending your laundry — pens, chapstick, gum, coins, lighters. We are not responsible for damage to your garments or others in your order caused by items left in pockets.",
    question_es: "¿Revisan los bolsillos?",
    answer_es: "Hacemos nuestro mejor esfuerzo, pero con el alto volumen de pedidos no podemos garantizar que cada bolsillo sea revisado antes de lavar. Por favor retira todos los artículos de los bolsillos — bolígrafos, chapstick, chicle, monedas, encendedores. No somos responsables de daños causados por artículos dejados en los bolsillos.",
  },
  {
    id: "gen-6", category: "general", sort_order: 6, active: true,
    question: "Can I leave special instructions?",
    answer: "Yes. You can add a note in the booking form for one-time instructions. For permanent preferences on recurring orders — detergent type, fabric softener, special care items — email us at clean@washfoldorlando.com and we'll add it to your account.",
    question_es: "¿Puedo dejar instrucciones especiales?",
    answer_es: "Sí. Puedes agregar una nota en el formulario de reserva para instrucciones de una sola vez. Para preferencias permanentes en pedidos recurrentes — tipo de detergente, suavizante, artículos de cuidado especial — escríbenos a clean@washfoldorlando.com y lo agregaremos a tu cuenta.",
  },
  {
    id: "gen-7", category: "general", sort_order: 7, active: true,
    question: "Do you offer dry cleaning?",
    answer: "No. We specialize in machine-washable items only. Do not include dry-clean only garments in your order — we are not responsible for damage to items with dry-clean only care labels.",
    question_es: "¿Ofrecen servicio de tintorería?",
    answer_es: "No. Nos especializamos únicamente en artículos lavables a máquina. No incluyas prendas de solo tintorería en tu pedido — no somos responsables de daños a artículos con etiquetas de solo tintorería.",
  },
  {
    id: "gen-8", category: "general", sort_order: 8, active: true,
    question: "How do I cancel or reschedule?",
    answer: "You can cancel or reschedule at no charge up to 2 hours before your pickup window. After that, a $10 cancellation fee may apply to cover driver dispatch costs. Email us at clean@washfoldorlando.com or log into your account to make changes.",
    question_es: "¿Cómo cancelo o reprogramo?",
    answer_es: "Puedes cancelar o reprogramar sin cargo hasta 2 horas antes de tu ventana de recogida. Después, puede aplicarse un cargo de cancelación de $10 para cubrir los costos de despacho del conductor. Escríbenos a clean@washfoldorlando.com o inicia sesión en tu cuenta para hacer cambios.",
  },
  {
    id: "gen-9", category: "general", sort_order: 9, active: true,
    question: "What if I forget to set out my laundry?",
    answer: "It happens! A $10 missed pickup fee applies to compensate your driver's time. Contact us at clean@washfoldorlando.com and we'll reschedule your pickup for the next available route day.",
    question_es: "¿Qué pasa si olvido sacar mi ropa?",
    answer_es: "¡Pasa! Se aplica un cargo de $10 por recogida fallida para compensar el tiempo de tu conductor. Contáctanos en clean@washfoldorlando.com y reprogramaremos tu recogida para el próximo día de ruta disponible.",
  },
  {
    id: "gen-10", category: "general", sort_order: 10, active: true,
    question: "How do I contact you?",
    answer: "Email us at clean@washfoldorlando.com. We respond within a few hours during business hours. For urgent issues related to an active order, you can also reach us through your order confirmation message.",
    question_es: "¿Cómo los contacto?",
    answer_es: "Escríbenos a clean@washfoldorlando.com. Respondemos en pocas horas durante el horario de atención. Para problemas urgentes relacionados con un pedido activo, también puedes comunicarte con nosotros a través de tu mensaje de confirmación de pedido.",
  },

  // ── Comforter Washing ─────────────────────────────────────────────────────
  {
    id: "cw-1", category: "comforter_wash", sort_order: 1, active: true,
    question: "What sizes do you wash?",
    answer: "We wash Twin, Full, Queen, and King size comforters. Select the size at booking — pricing is per item by size, shown clearly at checkout.",
    question_es: "¿Qué tallas lavan?",
    answer_es: "Lavamos edredones de tamaño Twin, Full, Queen y King. Selecciona el tamaño al reservar — el precio es por artículo según el tamaño, mostrado claramente al pagar.",
  },
  {
    id: "cw-2", category: "comforter_wash", sort_order: 2, active: true,
    question: "How is pricing calculated?",
    answer: "Comforters are charged per item by size, not by weight. The price you see at checkout is the exact amount you'll pay — no surprises after pickup.",
    question_es: "¿Cómo se calcula el precio?",
    answer_es: "Los edredones se cobran por artículo según el tamaño, no por peso. El precio que ves al pagar es el monto exacto que pagarás — sin sorpresas después de la recogida.",
  },
  {
    id: "cw-3", category: "comforter_wash", sort_order: 3, active: true,
    question: "How are comforters washed and dried?",
    answer: "Each comforter is washed individually in a commercial-grade oversized machine and dried thoroughly on a low-heat cycle. We never rush the drying process — large bedding takes time to dry properly, and we make sure it's fully dry before returning it to you.",
    question_es: "¿Cómo se lavan y secan los edredones?",
    answer_es: "Cada edredón se lava individualmente en una máquina sobredimensionada de grado comercial y se seca completamente en un ciclo de baja temperatura. Nunca apresuramos el proceso de secado — la ropa de cama grande necesita tiempo para secarse bien, y nos aseguramos de que esté completamente seca antes de devolvértela.",
  },
  {
    id: "cw-4", category: "comforter_wash", sort_order: 4, active: true,
    question: "Do you wash duvets, quilts, or blankets?",
    answer: "We specialize in comforters. If you have a duvet insert, thick blanket, or other large bedding item, email us at clean@washfoldorlando.com before booking to confirm we can accommodate it.",
    question_es: "¿Lavan edredones nórdicos, colchas o mantas?",
    answer_es: "Nos especializamos en edredones. Si tienes un relleno nórdico, manta gruesa u otro artículo de cama grande, escríbenos a clean@washfoldorlando.com antes de reservar para confirmar que podemos atenderte.",
  },
  {
    id: "cw-5", category: "comforter_wash", sort_order: 5, active: true,
    question: "What if my comforter arrives damp or wet?",
    answer: "Comforter Wash pricing is based on size, not weight, so a damp or wet comforter won't change your price. That said, please make sure it's not soaking wet before pickup — a heavily saturated comforter is harder for our team to handle safely and can affect wash quality.",
    question_es: "¿Qué pasa si mi edredón llega húmedo o mojado?",
    answer_es: "El precio del Lavado de Edredones se basa en el tamaño, no en el peso, así que un edredón húmedo o mojado no cambiará tu precio. Aun así, asegúrate de que no esté empapado antes de la recogida — un edredón muy saturado es más difícil de manejar de forma segura para nuestro equipo y puede afectar la calidad del lavado.",
  },
  {
    id: "cw-6", category: "comforter_wash", sort_order: 6, active: true,
    question: "How quickly will I get it back?",
    answer: "Comforter Wash turnaround is typically 48 to 72 hours from pickup, depending on your route day and current volume. You'll get a text update once it's on its way back to you.",
    question_es: "¿Qué tan rápido me lo devuelven?",
    answer_es: "El tiempo de entrega del Lavado de Edredones es típicamente de 48 a 72 horas desde la recogida, dependiendo de tu día de ruta y el volumen actual. Recibirás una actualización por mensaje de texto cuando esté en camino de regreso.",
  },
  {
    id: "cw-7", category: "comforter_wash", sort_order: 7, active: true,
    question: "Can I send pillows?",
    answer: "At this time we do not wash pillows. They require a specialized cleaning process that we are not currently set up to provide.",
    question_es: "¿Puedo enviar almohadas?",
    answer_es: "Por el momento no lavamos almohadas. Requieren un proceso de limpieza especializado que actualmente no estamos configurados para proporcionar.",
  },
  {
    id: "cw-8", category: "comforter_wash", sort_order: 8, active: true,
    question: "Do you guarantee stain removal?",
    answer: "Stain removal is an optional add-on you can select when booking — it isn't included in the standard wash. Even with stain treatment, we can't guarantee full removal: deep-set, old, or heat-set stains may not come out completely. If you have a heavily stained comforter, add the stain removal option and note it in your booking so we can give it extra attention.",
    question_es: "¿Garantizan la eliminación de manchas?",
    answer_es: "La eliminación de manchas es un servicio adicional opcional que puedes elegir al reservar — no está incluido en el lavado estándar. Incluso con el tratamiento de manchas, no podemos garantizar la eliminación total: las manchas profundas, antiguas o fijadas por calor puede que no salgan completamente. Si tienes un edredón muy manchado, agrega la opción de eliminación de manchas e indícalo en tu reserva para darle atención extra.",
  },

  // ── Wash & Fold ───────────────────────────────────────────────────────────
  {
    id: "wf-1", category: "wash_fold", sort_order: 1, active: true,
    question: "How much does Wash & Fold cost?",
    answer: "Wash & Fold is priced per pound based on the weight we receive at pickup. A pre-authorization hold is placed on your card at booking for the estimated total. You are only charged the actual amount once your order is weighed. See current pricing at checkout.",
    question_es: "¿Cuánto cuesta el servicio de Lavar y Doblar?",
    answer_es: "Lavar y Doblar tiene un precio por libra basado en el peso que recibimos en la recogida. Se realiza un cargo de preautorización en tu tarjeta al reservar por el total estimado. Solo se te cobra el monto real una vez que tu pedido es pesado. Consulta los precios actuales al pagar.",
  },
  {
    id: "wf-2", category: "wash_fold", sort_order: 2, active: true,
    question: "Is there a minimum order?",
    answer: "Yes, there is a minimum order for Wash & Fold. The minimum is displayed at checkout. Orders below the minimum are charged at the minimum rate.",
    question_es: "¿Hay un pedido mínimo?",
    answer_es: "Sí, hay un pedido mínimo para Lavar y Doblar. El mínimo se muestra al pagar. Los pedidos por debajo del mínimo se cobran a la tarifa mínima.",
  },
  {
    id: "wf-3", category: "wash_fold", sort_order: 3, active: true,
    question: "Do I need to sort my clothes?",
    answer: "No sorting needed. We wash mixed loads with color-trapping sheets (dye-grabber sheets) that absorb loose dye, so darks, lights, and colors can safely be washed together without bleeding.",
    question_es: "¿Necesito separar mi ropa?",
    answer_es: "No es necesario separar. Lavamos cargas mixtas con hojas atrapadoras de tinte que absorben el tinte suelto, para que oscuros, claros y colores puedan lavarse juntos de forma segura sin que se corran los colores.",
  },
  {
    id: "wf-4", category: "wash_fold", sort_order: 4, active: true,
    question: "What detergent do you use?",
    answer: "We offer multiple detergent choices, which you'll see listed during the booking process — including a regular option and a fragrance-free, hypoallergenic option. Additional add-ons may also be available at checkout.",
    question_es: "¿Qué detergente usan?",
    answer_es: "Ofrecemos varias opciones de detergente, que verás listadas durante el proceso de reserva — incluyendo una opción regular y una opción sin fragancia e hipoalergénica. También pueden estar disponibles complementos adicionales al pagar.",
  },
  {
    id: "wf-5", category: "wash_fold", sort_order: 5, active: true,
    question: "Can you remove stains?",
    answer: "Stain removal is a separate add-on service, not included in standard Wash & Fold — select it when booking and note the stained items in your order instructions. Even with stain treatment, we cannot guarantee full removal, especially for set-in or heat-set stains. Pretreating before pickup increases the chances of success.",
    question_es: "¿Pueden eliminar manchas?",
    answer_es: "La eliminación de manchas es un servicio adicional aparte, no incluido en el Lavado y Doblado estándar — selecciónalo al reservar e indica los artículos manchados en las instrucciones de tu pedido. Incluso con el tratamiento de manchas, no podemos garantizar la eliminación total, especialmente para manchas fijadas o por calor. Pretratar antes de la recogida aumenta las posibilidades de éxito.",
  },
  {
    id: "wf-6", category: "wash_fold", sort_order: 6, active: true,
    question: "Do you read clothing care labels?",
    answer: "We are not able to read individual care labels for each garment. All items are washed in warm water and machine dried at medium heat. If you have delicates, dry-clean only, or hand-wash only items, please keep them out of your Wash & Fold order or bag them separately with clear written instructions.",
    question_es: "¿Leen las etiquetas de cuidado de la ropa?",
    answer_es: "No podemos leer etiquetas de cuidado individuales para cada prenda. Todos los artículos se lavan en agua tibia y se secan a máquina a temperatura media. Si tienes prendas delicadas, de solo tintorería o de solo lavado a mano, por favor exclúyelas de tu pedido de Lavar y Doblar o ponlas en una bolsa separada con instrucciones escritas claras.",
  },
  {
    id: "wf-7", category: "wash_fold", sort_order: 7, active: true,
    question: "What items can't be included?",
    answer: "Please do not include: dry-clean only or hand-wash only items, shoes, handbags, hats, pillows, curtains, or items contaminated with bodily fluids, mold, mildew, bed bugs, pet hair, or hazardous chemicals. See our Terms of Service for the full list.",
    question_es: "¿Qué artículos no pueden incluirse?",
    answer_es: "Por favor no incluyas: artículos de solo tintorería o solo lavado a mano, zapatos, bolsos, sombreros, almohadas, cortinas, ni artículos contaminados con fluidos corporales, moho, chinches de cama, pelo de mascotas o productos químicos peligrosos. Consulta nuestros Términos de Servicio para la lista completa.",
  },
  {
    id: "wf-8", category: "wash_fold", sort_order: 8, active: true,
    question: "When will I get my clothes back?",
    answer: "Turnaround is typically 48 hours onwards, depending on the delivery schedule you select at booking. You'll get timely updates throughout the process, plus pickup and delivery reminders and confirmations.",
    question_es: "¿Cuándo recibiré mi ropa?",
    answer_es: "El tiempo de entrega es típicamente de 48 horas en adelante, dependiendo del horario de entrega que selecciones al reservar. Recibirás actualizaciones oportunas durante todo el proceso, además de recordatorios y confirmaciones de recogida y entrega.",
  },
  {
    id: "wf-9", category: "wash_fold", sort_order: 9, active: true,
    question: "How are my clothes packaged for return?",
    answer: "Clothes are neatly folded and returned in our sanitary clear bags.",
    question_es: "¿Cómo se empaca mi ropa para la devolución?",
    answer_es: "La ropa se dobla cuidadosamente y se devuelve en nuestras bolsas transparentes sanitarias.",
  },
  {
    id: "wf-10", category: "wash_fold", sort_order: 10, active: true,
    question: "What about recurring Wash & Fold subscriptions?",
    answer: "We offer weekly and biweekly recurring Wash & Fold plans at a slightly reduced per-pound rate. Recurring customers get priority scheduling and a fixed route day. You can pause or cancel anytime through your account or by emailing us.",
    question_es: "¿Qué hay de las suscripciones recurrentes de Lavar y Doblar?",
    answer_es: "Ofrecemos planes recurrentes semanales y quincenales de Lavar y Doblar a una tarifa por libra ligeramente reducida. Los clientes recurrentes obtienen programación prioritaria y un día de ruta fijo. Puedes pausar o cancelar en cualquier momento a través de tu cuenta o escribiéndonos.",
  },
  {
    id: "wf-11", category: "wash_fold", sort_order: 11, active: true,
    question: "What if my laundry arrives damp or wet?",
    answer: "Wash & Fold and Wash Only pricing is based on the weight received at pickup. Please make sure your laundry is fully dry before pickup so you're only paying for the laundry itself. (Note: this doesn't apply to Comforter Wash, which is priced by size, not weight.)",
    question_es: "¿Qué pasa si mi ropa llega húmeda o mojada?",
    answer_es: "El precio de Lavar y Doblar y Solo Lavar se basa en el peso recibido en la recogida. Por favor asegúrate de que tu ropa esté completamente seca antes de la recogida para que solo pagues por la ropa en sí. (Nota: esto no aplica al Lavado de Edredones, que se cobra por tamaño, no por peso.)",
  },
]

// ── Server actions ────────────────────────────────────────────────────────────

// DEFAULTS above are written with WashFold Orlando's own contact info baked
// in as literal text (email, "Orlando"). Any tenant that hasn't customized
// their faq_items yet still needs to see THEIR OWN business name/email here,
// not WashFold's — substitute those placeholders at read time.
function applyBranding(items: FaqItem[], businessName: string, supportEmail: string | null): FaqItem[] {
  const email = supportEmail || "support@example.com"
  const sub = (s: string) =>
    s.replaceAll("clean@washfoldorlando.com", email).replaceAll("WashFold Orlando", businessName)
  return items.map(i => ({
    ...i,
    answer: sub(i.answer),
    answer_es: i.answer_es ? sub(i.answer_es) : i.answer_es,
  }))
}

export async function getFaqItems(lang?: string): Promise<FaqItem[]> {
  let items: FaqItem[]
  try {
    const [supabase, locationId] = [createAdminClient(), await getLocationId()]
    const { data, error } = await supabase
      .from("faq_items")
      .select("*")
      .eq("location_id", locationId)
      .order("category")
      .order("sort_order")
    if (!error && data && data.length > 0) {
      items = data as FaqItem[]
    } else {
      const branding = await getBranding()
      items = applyBranding(DEFAULTS, branding.business_name || "WashFoldClean", branding.support_email)
    }
  } catch {
    const branding = await getBranding()
    items = applyBranding(DEFAULTS, branding.business_name || "WashFoldClean", branding.support_email)
  }

  if (lang === "es") {
    return items.map(item => ({
      ...item,
      question: item.question_es || item.question,
      answer: item.answer_es || item.answer,
    }))
  }
  return items
}

export async function upsertFaqItems(category: FaqCategory, items: Omit<FaqItem, "created_at">[]) {
  await requireAdmin()

  const [supabase, locationId] = [createAdminClient(), await getLocationId()]

  // Delete existing items for this category
  await supabase.from("faq_items").delete().eq("location_id", locationId).eq("category", category)

  if (items.length === 0) return { success: true }

  // Re-insert with updated sort_order
  const rows = items.map((item, i) => ({
    id: item.id.startsWith("gen-") || item.id.startsWith("cw-") || item.id.startsWith("wf-")
      ? undefined  // let DB generate UUID for default items being persisted for first time
      : item.id,
    location_id: locationId,
    category: item.category,
    question: item.question,
    answer: item.answer,
    question_es: item.question_es ?? null,
    answer_es: item.answer_es ?? null,
    sort_order: i,
    active: item.active,
  }))

  const { error } = await supabase.from("faq_items").insert(rows)
  if (error) throw error
  return { success: true }
}
