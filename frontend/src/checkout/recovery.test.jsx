// @vitest-environment jsdom
import React from 'react'
import {test,expect,vi,afterEach} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import {CartContext} from '../cart/cartContext.js'
import CheckoutPage from './CheckoutPage.jsx'
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()})
const cart={status:'ready',items:[],refresh:vi.fn()}
test('reload recovers a completed order even after the server emptied the cart',async()=>{
 localStorage.setItem('dobby.checkoutAttempt:7','recover-key')
 const fetch = vi.fn(async (url) => {
   const path = new URL(url).pathname
   if (path === '/checkout/attempts/recover-key/resolve') {
     return Response.json({ phase: 'succeeded', order: { id: 42, total: '10.00', currency: 'TRY', items: [] } })
   }
   if (path === '/orders/42/invoice') {
     return Response.json({ invoice: { number: 'INV-42', email: { status: 'sent' } } })
   }
   throw new Error(`Unexpected request: ${path}`)
 })
 vi.stubGlobal('fetch',fetch)
 render(<CartContext.Provider value={cart}><CheckoutPage user={{id:7,role:'customer'}}/></CartContext.Provider>)
 expect(await screen.findByText('Order #42 placed')).toBeTruthy()
 expect(await screen.findByRole('heading', { name: 'Invoice INV-42' })).toBeTruthy()
 expect(fetch.mock.calls[0][0]).toContain('/checkout/attempts/recover-key/resolve')
 expect(fetch.mock.calls[0][1].body).toBeUndefined()
 expect(screen.queryByRole('button',{name:'Place test order'})).toBeNull()
})
test('an unresolved previous attempt blocks a new checkout after reload',async()=>{
 localStorage.setItem('dobby.checkoutAttempt:7','recover-key')
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({phase:'pending'})}))
 render(<CartContext.Provider value={cart}><CheckoutPage user={{id:7,role:'customer'}}/></CartContext.Provider>)
 expect(await screen.findByText(/new order is blocked/)).toBeTruthy()
 expect(screen.queryByRole('button',{name:'Place test order'})).toBeNull()
})
