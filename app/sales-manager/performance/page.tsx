'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'

const performanceData = [
  { name: 'Rajesh Kumar', sales: 85, target: 100 },
  { name: 'Priya Singh', sales: 92, target: 100 },
  { name: 'Amit Patel', sales: 78, target: 100 },
  { name: 'Sneha Verma', sales: 95, target: 100 },
  { name: 'Vikram Shah', sales: 88, target: 100 },
]

const skillsData = [
  { metric: 'Sales', value: 85 },
  { metric: 'Customer Service', value: 90 },
  { metric: 'Product Knowledge', value: 88 },
  { metric: 'Communication', value: 92 },
  { metric: 'Time Management', value: 80 },
  { metric: 'Problem Solving', value: 85 },
]

export default function PerformancePage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Team Performance</h1>
        <p className="text-slate-400 mt-2">Track individual and team performance metrics</p>
      </div>

      {/* Target Achievement */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Sales Target Achievement</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="sales" fill="#3b82f6" name="Achieved" />
              <Bar dataKey="target" fill="#d1d5db" name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Skills Assessment */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Skills Assessment (Average Team Score)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={skillsData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" stroke="#94a3b8" />
              <PolarRadiusAxis stroke="#94a3b8" />
              <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Individual Performance Cards */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Individual Salesman Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {performanceData.map(person => {
            const achievement = (person.sales / person.target) * 100
            const status = achievement >= 100 ? 'Exceeded' : achievement >= 80 ? 'On Track' : 'Below Target'
            const badgeColor = achievement >= 100 ? 'bg-green-600' : achievement >= 80 ? 'bg-yellow-600' : 'bg-red-600'

            return (
              <Card key={person.name} className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">{person.name}</h3>
                      <Badge className={badgeColor}>{status}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Target Achievement</span>
                        <span className="font-semibold text-white">{achievement.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            achievement >= 100 ? 'bg-green-500' : achievement >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(achievement, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-slate-400 text-xs">Sales Count</p>
                        <p className="text-xl font-bold text-white">{person.sales}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Target</p>
                        <p className="text-xl font-bold text-white">{person.target}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
