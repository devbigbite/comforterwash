import { NextRequest, NextResponse } from "next/server"
import { getPitchTemplate, getProspect } from "@/app/actions/outreach"

// Generates an HTML-based PDF proposal via browser print
// Returns an HTML page optimized for print/save-as-PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const prospectId = searchParams.get("prospect")

  const t = await getPitchTemplate(slug)
  if (!t) return new NextResponse("Not found", { status: 404 })

  const prospect = prospectId ? await getProspect(prospectId) : null
  const recipientName = prospect?.business_name ?? "Valued Partner"
  const contactName = prospect?.contact_name ?? ""
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  const servicesHtml = (t.services_offered ?? []).map((s, i) => `
    <tr>
      <td style="padding:10px 12px;font-weight:600;color:#1e293b;">${s.name}</td>
      <td style="padding:10px 12px;color:#475569;">${s.description}</td>
      <td style="padding:10px 12px;color:#6366f1;font-weight:500;white-space:nowrap;">${s.price_note}</td>
    </tr>
  `).join("")

  const propsHtml = (t.value_props ?? []).map(v => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;gap:12px;margin-bottom:12px;">
      <div style="font-size:24px;flex-shrink:0;">${v.icon}</div>
      <div>
        <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${v.title}</div>
        <div style="color:#64748b;font-size:13px;line-height:1.5;">${v.body}</div>
      </div>
    </div>
  `).join("")

  const pricingHtml = (t.pricing_table ?? []).map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="padding:10px 14px;font-weight:500;color:#1e293b;">${r.item}</td>
      <td style="padding:10px 14px;color:#64748b;">${r.unit}</td>
      <td style="padding:10px 14px;font-weight:600;color:#4f46e5;">${r.price}</td>
      <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">${r.notes}</td>
    </tr>
  `).join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.title} — WashFold Orlando Proposal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #334155; background: white; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }

    /* Print button */
    .no-print {
      position: fixed; top: 16px; right: 16px; z-index: 100;
      display: flex; gap: 8px;
    }
    .btn-print {
      background: #4f46e5; color: white; border: none; cursor: pointer;
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
    }
    .btn-close {
      background: #f1f5f9; color: #475569; border: none; cursor: pointer;
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
    }

    .container { max-width: 760px; margin: 0 auto; padding: 40px 40px; }

    /* Cover */
    .cover { background: linear-gradient(135deg, #3730a3, #4f46e5); color: white; border-radius: 16px; padding: 48px 48px 40px; margin-bottom: 40px; }
    .cover-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .cover-logo-icon { width: 42px; height: 42px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .cover-company { font-size: 14px; font-weight: 600; opacity: 0.9; }
    .cover-sub { font-size: 12px; opacity: 0.65; margin-top: 2px; }
    .cover h1 { font-size: 26px; font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
    .cover-tagline { font-size: 15px; opacity: 0.8; }
    .cover-meta { display: flex; gap: 24px; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2); }
    .cover-meta-item label { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 3px; }
    .cover-meta-item span { font-size: 14px; font-weight: 500; }

    h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    section { margin-bottom: 36px; }
    p { font-size: 14px; line-height: 1.7; color: #475569; }

    table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    thead tr { background: #eef2ff; }
    th { padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; }

    .closing-box { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 28px; }
    .closing-box p { margin-bottom: 20px; }
    .signature-block { margin-top: 32px; display: flex; gap: 40px; }
    .sig-line { flex: 1; }
    .sig-line .line { border-bottom: 1px solid #94a3b8; margin-bottom: 6px; height: 36px; }
    .sig-line .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">⬇ Save as PDF / Print</button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>

  <div class="container">
    <!-- Cover -->
    <div class="cover">
      <div class="cover-logo">
        <div class="cover-logo-icon">🫧</div>
        <div>
          <div class="cover-company">WashFold Orlando</div>
          <div class="cover-sub">SaleCalle LLC · Commercial Laundry Services</div>
        </div>
      </div>
      <h1>${t.cover_headline ?? t.title}</h1>
      ${t.tagline ? `<div class="cover-tagline">${t.tagline}</div>` : ""}
      <div class="cover-meta">
        <div class="cover-meta-item">
          <label>Prepared for</label>
          <span>${recipientName}${contactName ? ` · ${contactName}` : ""}</span>
        </div>
        <div class="cover-meta-item">
          <label>Date</label>
          <span>${today}</span>
        </div>
        <div class="cover-meta-item">
          <label>Confidential</label>
          <span>Private & Confidential</span>
        </div>
      </div>
    </div>

    ${t.intro_paragraph ? `
    <!-- About / Intro -->
    <section>
      <h2>About WashFold Orlando</h2>
      <p>${t.intro_paragraph}</p>
    </section>
    ` : ""}

    ${(t.value_props ?? []).length > 0 ? `
    <!-- Why Us -->
    <section>
      <h2>Why WashFold Orlando?</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${propsHtml}
      </div>
    </section>
    ` : ""}

    ${(t.services_offered ?? []).length > 0 ? `
    <!-- Services -->
    <section>
      <h2>Services Included</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Description</th>
            <th>Rate Basis</th>
          </tr>
        </thead>
        <tbody>${servicesHtml}</tbody>
      </table>
    </section>
    ` : ""}

    ${(t.pricing_table ?? []).length > 0 ? `
    <!-- Pricing -->
    <section>
      <h2>Pricing Overview</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Unit</th>
            <th>Rate</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${pricingHtml}</tbody>
      </table>
      <p style="margin-top:10px;font-size:12px;color:#94a3b8;">
        * All rates subject to final agreement based on volume and service schedule. Emergency services and reporting included at no additional charge.
      </p>
    </section>
    ` : ""}

    ${t.closing_statement ? `
    <!-- Closing -->
    <section>
      <div class="closing-box">
        <h2 style="border:none;padding:0;margin-bottom:12px;">Ready to Get Started?</h2>
        <p>${t.closing_statement}</p>
        <p style="font-size:13px;"><strong>Phone:</strong> (407) 300-2999 &nbsp;|&nbsp; <strong>Email:</strong> hello@washfoldorlando.com<br/>
        10524 Moss Park Rd, Ste 204177, Orlando, FL 32832</p>

        <div class="signature-block">
          <div class="sig-line">
            <div class="line"></div>
            <div class="label">Authorized Signature — WashFold Orlando</div>
          </div>
          <div class="sig-line">
            <div class="line"></div>
            <div class="label">Date</div>
          </div>
        </div>
        <div class="signature-block" style="margin-top:24px;">
          <div class="sig-line">
            <div class="line"></div>
            <div class="label">Client Signature</div>
          </div>
          <div class="sig-line">
            <div class="line"></div>
            <div class="label">Date</div>
          </div>
        </div>
      </div>
    </section>
    ` : ""}

    <footer>
      WashFold Orlando · SaleCalle LLC · Orlando, FL 32832 · Submitted to ${recipientName} · Private &amp; Confidential
    </footer>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}
