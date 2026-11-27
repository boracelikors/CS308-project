// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import InvoicePanel from './InvoicePanel.jsx'
const reply = (status) => ({ok:true,status:200,json:async()=>({invoice:{number:'INV-42',email:{status}}})})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
test('sent invoices offer PDF but no duplicate email action',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply('sent')))
 render(<InvoicePanel userId={1} orderId={42}/> )
 expect(await screen.findByText('Invoice email sent.')).toBeTruthy()
 expect(screen.getByRole('button',{name:'Download invoice PDF'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:/Send invoice email|Retry invoice email/})).toBeNull()
})
test('retrying email never submits checkout again',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(reply('failed')).mockResolvedValueOnce({ok:true,status:200,json:async()=>({email:{status:'sent'}})}).mockResolvedValue(reply('sent'))
 vi.stubGlobal('fetch',fetch)
 render(<InvoicePanel userId={1} orderId={42}/> )
 fireEvent.click(await screen.findByRole('button',{name:'Retry invoice email'}))
 expect(await screen.findByText('Invoice email sent.')).toBeTruthy()
 expect(fetch.mock.calls[1][0]).toContain('/orders/42/invoice/email')
 expect(fetch.mock.calls[1][1].method).toBe('POST')
 expect(fetch.mock.calls.some(([url])=>url.includes('/checkout'))).toBe(false)
})
test('account changes immediately hide the previous invoice',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(reply('sent')).mockImplementation(()=>new Promise(()=>{})))
 const view=render(<InvoicePanel userId={1} orderId={42}/> )
 await screen.findByText('Invoice INV-42')
 view.rerender(<InvoicePanel userId={2} orderId={43}/> )
 expect(screen.queryByText('Invoice INV-42')).toBeNull()
 expect(screen.getByText('Loading invoice…')).toBeTruthy()
})
test('an inaccessible invoice never offers a download',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404,json:async()=>({error:{code:'ORDER_NOT_FOUND',message:'Order not found.'}})}))
 render(<InvoicePanel userId={1} orderId={42}/> )
 expect(await screen.findByText('No invoice is available for this order.')).toBeTruthy()
 expect(screen.queryByRole('button',{name:'Download invoice PDF'})).toBeNull()
})
test('switching accounts cancels an invoice download before it can save', async () => {
 let downloadSignal
 vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply('sent')).mockImplementation((_url, options) => {
   downloadSignal = options.signal
   return new Promise(() => {})
 }))
 const view = render(<InvoicePanel userId={1} orderId={42} />)
 fireEvent.click(await screen.findByRole('button', { name: 'Download invoice PDF' }))
 const originalSignal = downloadSignal
 view.rerender(<InvoicePanel userId={2} orderId={43} />)
 expect(originalSignal.aborted).toBe(true)
 expect(screen.queryByText('Invoice INV-42')).toBeNull()
})

test('an unexpected success response offers retry without crashing the order page', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ order: { id: 42 } }))
    .mockResolvedValueOnce(reply('sent')))
  render(<InvoicePanel userId={1} orderId={42} />)
  const retry = await screen.findByRole('button', { name: 'Retry invoice' })
  expect(screen.queryByRole('button', { name: 'Download invoice PDF' })).toBeNull()
  fireEvent.click(retry)
  expect(await screen.findByText('Invoice email sent.')).toBeTruthy()
})
