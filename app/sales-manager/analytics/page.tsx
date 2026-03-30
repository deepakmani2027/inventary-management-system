'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'

const weeklyData = [
  { day: 'Monday', sales: 12, revenue: 84000 },
  { day: 'Tuesday', sales: 15, revenue: 105000 },
  { day: 'Wednesday', sales: 10, revenue: 70000 },
  { day: 'Thursday', sales: 18, revenue: 126000 },
  { day: 'Friday', sales: 20, revenue: 140000 },
  { day: 'Saturday', sales: 16, revenue: 112000 },
  { day: 'Sunday', sales: 14, revenue: 98000 },
]

const customerData = [
  { month: 'Jan', newCustomers: 45, returning: 120 },
  { month: 'Feb', newCustomers: 52, returning: 145 },
  { month: 'Mar', newCustomers: 48, returning: 168 },
  { month: 'Apr', newCustomers: 61, returning: 192 },
  { month: 'May', newCustomers: 55, returning: 215 },
  { month: 'Jun', newCustomers: 67, returning: 248 },
]

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Sales Analytics</h1>
        <p className="text-slate-400 mt-2">Detailed analysis of sales performance metrics</p>
      </div>

      {/* Weekly Sales */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Weekly Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="revenue" fill="#3b82f6" stroke="#3b82f6" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Customer Growth */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Customer Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={customerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="newCustomers" fill="#3b82f6" name="New Customers" />
              <Bar dataKey="returning" fill="#10b981" name="Returning Customers" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Conversion Rate</p>
              <p className="text-3xl font-bold text-white mt-2">12.5%</p>
              <p className="text-green-400 text-sm mt-2">+2.3% vs last week</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Avg Transaction</p>
              <p className="text-3xl font-bold text-white mt-2">₹7,250</p>
              <p className="text-green-400 text-sm mt-2">+5.1% vs last week</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Customer Lifetime Value</p>
              <p className="text-3xl font-bold text-white mt-2">₹45,600</p>
              <p className="text-green-400 text-sm mt-2">+8.2% vs last week</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Repeat Purchase Rate</p>
              <p className="text-3xl font-bold text-white mt-2">42%</p>
              <p className="text-yellow-400 text-sm mt-2">-1.5% vs last week</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
