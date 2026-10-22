"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type Bag = { id: string; bag_number: number; label_code: string }
type Item = { type: string; qty: number }

interface Props {
  orderId: string
  orderCode: string
  customerName: string
  serviceLabel: string
  brand: string
  dueDate: string
  bags: Bag[]
}

// Client component on purpose: this page used to be a server component that
// shipped its editor + Print button as one big inline <script> and a
// JSX `onclick="doPrint()"` string. React drops string event handlers, and
// inline scripts never run when the page is reached by in-app navigation, so
// the editor never showed and Print Labels did nothing. Plain React state +
// onClick works every time.
export default function LabelsClient({ orderId, orderCode, customerName, serviceLabel, brand, dueDate, bags }: Props) {
  const [items, setItems] = useState<Record<string, Item[]>>(() => {
    const init: Record<string, Item[]> = {}
    bags.forEach(b => { init[b.id] = [{ type: "", qty: 1 }] })
    return init
  })
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function update(bagId: string, idx: number, patch: Partial<Item>) {
    setItems(prev => ({ ...prev, [bagId]: prev[bagId].map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))
  }
  function add(bagId: string) {
    setItems(prev => ({ ...prev, [bagId]: [...prev[bagId], { type: "", qty: 1 }] }))
  }
  function remove(bagId: string, idx: number) {
    setItems(prev => {
      const list = prev[bagId]
      return { ...prev, [bagId]: list.length <= 1 ? [{ type: "", qty: 1 }] : list.filter((_, i) => i !== idx) }
    })
  }

  const dueFmt = dueDate
    ? new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"

  const printContent = (
    <div id="label-print-root">
      {bags.map(bag => {
        const filled = (items[bag.id] ?? []).filter(i => i.type && i.type.trim())
        return (
          <div className="label" key={bag.id}>
            <div className="label-top">
              <span className="label-brand">{brand}</span>
              <span className="label-bag-badge">BAG {bag.bag_number} / {bags.length}</span>
            </div>
            <div className="label-order-code">{orderCode}</div>
            <div className="label-bag-code">{bag.label_code}</div>
            <div className="label-customer">{customerName}</div>
            <div className="label-service">{serviceLabel}</div>
            <hr className="label-divider" />
            <div className="label-items-title">Contents</div>
            {filled.length
              ? filled.map((i, k) => (
                  <div className="label-item-row" key={k}>
                    <span>{i.type}</span>
                    <span className="label-item-qty">× {i.qty || 1}</span>
                  </div>
                ))
              : <div className="label-no-items">No item detail specified</div>}
            <div className="label-footer">
              <div className="label-due">{dueFmt}<span>Ready / Due date</span></div>
              <div className="label-instruction">Do not remove · Scan at each station</div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="labels-page">
      <style>{CSS}</style>

      <div className="control-bar">
        <h1>
          🏷️ {orderCode}
          <span className="sub">{customerName} · {serviceLabel}</span>
        </h1>
        <a href={`/admin/orders/${orderId}`} className="btn-back">← Back</a>
        <button type="button" className="btn-print" onClick={() => window.print()}>🖨️ Print Labels</button>
      </div>

      <div className="editor-wrap">
        <div className="editor-intro">
          <p><strong>Add item details to each packet before printing.</strong></p>
          <p>Fill in what&apos;s inside each bag (e.g. &quot;Dress Shirts&quot; × 5, &quot;Pants&quot; × 3). Leave blank if not needed — the label will still print. When done, click <strong>Print Labels</strong>.</p>
        </div>

        {bags.length === 0 && (
          <div className="editor-intro">
            <p><strong>This order has no bags yet.</strong></p>
            <p>Labels are printed per bag, so there is nothing to print until the bags exist.</p>
          </div>
        )}

        {bags.map(bag => (
          <div className="bag-editor" key={bag.id}>
            <div className="bag-editor-header">
              <span className="bag-num-badge">BAG {bag.bag_number} / {bags.length}</span>
              <span className="bag-code">{bag.label_code}</span>
            </div>
            <div className="col-headers">
              <span className="col-label">Item / Description</span>
              <span className="col-label">Qty</span>
              <span></span>
            </div>
            <div className="items-list">
              {(items[bag.id] ?? []).map((it, idx) => (
                <div className="item-row" key={idx}>
                  <input
                    type="text"
                    placeholder="e.g. Dress Shirts, Pants, Polos…"
                    value={it.type}
                    onChange={e => update(bag.id, idx, { type: e.target.value })}
                  />
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={it.qty}
                    onChange={e => update(bag.id, idx, { qty: parseInt(e.target.value) || 1 })}
                  />
                  <button type="button" className="btn-remove" title="Remove" onClick={() => remove(bag.id, idx)}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-add-item" onClick={() => add(bag.id)}>+ Add item</button>
          </div>
        ))}
      </div>

      {/* Printed output lives directly under <body> so the print CSS can hide
          everything else (admin header etc.) and print only the labels. */}
      {mounted ? createPortal(printContent, document.body) : null}
    </div>
  )
}

const CSS = `
.labels-page { font-family: Arial, sans-serif; color: #0D2240; }
.labels-page *, .labels-page *::before, .labels-page *::after { box-sizing: border-box; }
.control-bar { position: sticky; top: 0; z-index: 40; background: #0D2240; padding: 14px 24px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.control-bar h1 { font-size: 15px; font-weight: 900; color: white; margin: 0; flex: 1; font-family: monospace; letter-spacing: 1px; }
.control-bar .sub { font-size: 11px; color: rgba(255,255,255,0.5); font-family: sans-serif; font-weight: normal; margin-left: 10px; }
.btn-print { background: #E8726A; color: white; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 900; font-size: 14px; cursor: pointer; transition: background 0.15s; }
.btn-print:hover { background: #d45f57; }
.btn-back { color: rgba(255,255,255,0.6); font-size: 13px; text-decoration: none; padding: 8px 0; }
.btn-back:hover { color: white; }
.editor-wrap { max-width: 860px; margin: 28px auto; padding: 0 20px; }
.editor-intro { background: white; border-radius: 14px; border: 1px solid #e8e9ec; padding: 18px 22px; margin-bottom: 20px; font-size: 13px; color: #555; }
.editor-intro strong { color: #0D2240; }
.editor-intro p { margin: 0 0 6px; }
.editor-intro p:last-child { margin: 0; }
.bag-editor { background: white; border-radius: 14px; border: 1px solid #e8e9ec; padding: 20px 22px; margin-bottom: 16px; }
.bag-editor-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.bag-num-badge { background: #0D2240; color: white; font-size: 12px; font-weight: 900; font-family: monospace; padding: 4px 10px; border-radius: 8px; }
.bag-code { font-family: monospace; font-size: 13px; color: #888; }
.items-list { display: flex; flex-direction: column; gap: 8px; }
.item-row { display: grid; grid-template-columns: 1fr 90px 36px; gap: 8px; align-items: center; }
.item-row input[type="text"] { border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #0D2240; outline: none; transition: border 0.15s; }
.item-row input[type="text"]:focus { border-color: #E8726A; }
.item-row input[type="number"] { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; font-size: 13px; text-align: center; color: #0D2240; outline: none; }
.item-row input[type="number"]:focus { border-color: #E8726A; }
.btn-remove { background: none; border: 1px solid #e0e0e0; border-radius: 8px; color: #bbb; font-size: 16px; cursor: pointer; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.btn-remove:hover { border-color: #E8726A; color: #E8726A; }
.btn-add-item { margin-top: 10px; background: none; border: 1.5px dashed #ccc; border-radius: 8px; color: #aaa; font-size: 12px; font-weight: 700; padding: 7px 14px; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
.btn-add-item:hover { border-color: #0D2240; color: #0D2240; }
.col-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #aaa; letter-spacing: 0.5px; }
.col-headers { display: grid; grid-template-columns: 1fr 90px 36px; gap: 8px; margin-bottom: 4px; }

#label-print-root { display: none; }

@media print {
  @page { size: 4in 6in; margin: 0.2in; }
  body { background: white !important; }
  body > *:not(#label-print-root) { display: none !important; }
  #label-print-root { display: block !important; font-family: Arial, sans-serif; color: #0D2240; }
  #label-print-root *, #label-print-root *::before, #label-print-root *::after { box-sizing: border-box; }
  .label { width: 100%; height: calc(6in - 0.4in); page-break-after: always; break-after: page; display: flex; flex-direction: column; border: 3px solid #0D2240; border-radius: 14px; padding: 18px 20px; overflow: hidden; }
  .label-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .label-brand { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #888; }
  .label-bag-badge { background: #E8726A; color: white; font-size: 11px; font-weight: 900; padding: 3px 10px; border-radius: 20px; }
  .label-order-code { font-size: 28px; font-weight: 900; font-family: monospace; letter-spacing: 2px; color: #0D2240; line-height: 1; }
  .label-bag-code { font-size: 14px; font-weight: 700; font-family: monospace; color: #555; margin-top: 2px; }
  .label-customer { font-size: 13px; font-weight: 700; color: #0D2240; margin-top: 8px; }
  .label-service { display: inline-block; align-self: flex-start; background: #f7f8fb; border: 1px solid #e0e0e0; color: #666; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 2px 8px; border-radius: 20px; margin-top: 4px; }
  .label-divider { border: none; border-top: 2px dashed #ddd; margin: 12px 0 8px; }
  .label-items-title { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 6px; }
  .label-item-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 600; color: #0D2240; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
  .label-item-qty { font-weight: 900; font-family: monospace; font-size: 14px; }
  .label-no-items { font-size: 11px; color: #bbb; font-style: italic; }
  .label-footer { margin-top: auto; border-top: 1.5px dashed #e0e0e0; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
  .label-due { font-size: 10px; color: #0D2240; font-weight: 700; }
  .label-due span { font-size: 9px; font-weight: 400; color: #aaa; display: block; }
  .label-instruction { font-size: 9px; color: #aaa; font-style: italic; text-align: right; }
}
`
