import { Sparkles, BarChart3, Users, TrendingUp, MessageSquare } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-lg bg-gray-900/80 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[#002FA7] flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white font-manrope">InventoryPro AI</h1>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#benefits" className="text-gray-300 hover:text-white transition-colors">Benefits</a>
            <button className="px-6 py-2 bg-[#002FA7] text-white rounded-full hover:bg-[#002FA7]/90 transition-colors font-medium">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 font-manrope leading-tight">
            Your AI-Powered Inventory Assistant
          </h2>
          <p className="text-xl text-gray-400 mb-8 font-ibm-plex">
            Instantly access stock levels, sales data, revenue insights, and team information. Ask questions in natural language and get intelligent answers powered by cutting-edge AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-[#002FA7] text-white rounded-full text-lg font-semibold hover:bg-[#002FA7]/90 transition-all transform hover:scale-105 shadow-lg">
              Start Chatting
            </button>
            <button className="px-8 py-4 border-2 border-gray-600 text-white rounded-full text-lg font-semibold hover:border-white hover:bg-white/5 transition-all">
              View Demo
            </button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#002FA7]/20 to-[#002FA7]/0 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gray-800/50 border border-gray-700 rounded-3xl p-8 backdrop-blur-sm">
            <div className="h-96 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-[#002FA7] mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 font-ibm-plex">Chat Widget Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h3 className="text-4xl font-bold text-white text-center mb-16 font-manrope">Powerful Features</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: BarChart3,
              title: "Real-time Analytics",
              description: "Get instant insights into your inventory levels, sales trends, and revenue data"
            },
            {
              icon: TrendingUp,
              title: "Smart Alerts",
              description: "Receive intelligent notifications about low stock items and important updates"
            },
            {
              icon: Users,
              title: "Team Management",
              description: "Access team member information, roles, and responsibilities instantly"
            },
            {
              icon: Sparkles,
              title: "AI-Powered",
              description: "Choose between OpenAI GPT-4.1 or Google Gemini 2.5 for intelligent responses"
            }
          ].map((feature, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-[#002FA7]/50 hover:bg-gray-800/80 transition-all">
              <feature.icon className="h-12 w-12 text-[#002FA7] mb-4" />
              <h4 className="text-lg font-bold text-white mb-2 font-manrope">{feature.title}</h4>
              <p className="text-gray-400 text-sm font-ibm-plex">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h3 className="text-4xl font-bold text-white text-center mb-16 font-manrope">Why Choose InventoryPro AI?</h3>
        <div className="space-y-8">
          {[
            {
              title: "Natural Language Processing",
              description: "Ask questions in plain English. The AI understands context and provides accurate answers."
            },
            {
              title: "Comprehensive Data Integration",
              description: "Seamlessly integrated with your Supabase database for real-time inventory, sales, and user data."
            },
            {
              title: "Session Persistence",
              description: "Your conversation history is saved. Return to previous chats and continue where you left off."
            },
            {
              title: "Smart Intent Detection",
              description: "The system intelligently determines what data is relevant for your query and fetches only what's needed."
            }
          ].map((benefit, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 hover:border-[#002FA7]/50 transition-all">
              <h4 className="text-xl font-bold text-white mb-3 font-manrope">{benefit.title}</h4>
              <p className="text-gray-400 font-ibm-plex">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-[#002FA7] to-[#002FA7]/80 rounded-3xl p-12 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 font-manrope">Ready to Transform Your Inventory Management?</h3>
          <p className="text-lg text-blue-100 mb-8 font-ibm-plex max-w-2xl mx-auto">
            Open the chat widget in the bottom right corner to start asking questions about your inventory, sales, and team data.
          </p>
          <button className="px-8 py-4 bg-white text-[#002FA7] rounded-full text-lg font-bold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg font-manrope">
            Open Chat Widget
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400 text-sm font-ibm-plex">
          <p>&copy; 2024 InventoryPro AI. Built with React, FastAPI, and Emergent AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
