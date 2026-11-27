import { NavLink } from 'react-router-dom'

export default function ManagerNav() {
  return (
    <nav className="manager-nav" aria-label="Product manager navigation">
      <NavLink end to="/manager">Overview</NavLink>
      <NavLink to="/manager/deliveries">Deliveries</NavLink>
      <NavLink to="/manager/comments">Comments</NavLink>
      <NavLink to="/manager/stock">Stock</NavLink>
    </nav>
  )
}
