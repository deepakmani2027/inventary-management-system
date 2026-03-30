import { redirect } from 'next/navigation'

export default function InventoryRouteRedirect() {
  redirect('/inventory/dashboard')
}