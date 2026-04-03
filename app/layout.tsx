import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AIChatbot } from '@/components/ai-chatbot'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-body' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  title: 'InventoryPro',
  description: 'A polished inventory, sales, and operations platform for retail teams.',
  generator: 'InventoryPro',
  icons: {
    icon: [
      {
        url: '/refund-parcel-symbol-check-and-return-parcel-silhouette-icon-shipping-order-package-glyph-pictogram-delivery-box-with-arrow-and-checkmark-solid-sign-isolated-illustration-vector.jpg',
        sizes: '40x40',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/refund-parcel-symbol-check-and-return-parcel-silhouette-icon-shipping-order-package-glyph-pictogram-delivery-box-with-arrow-and-checkmark-solid-sign-isolated-illustration-vector.jpg',
        sizes: '40x40',
        media: '(prefers-color-scheme: dark)',
      },
      {
        // large square artwork for platforms that support larger favicons
        url: '/refund-parcel-symbol-check-and-return-parcel-silhouette-icon-shipping-order-package-glyph-pictogram-delivery-box-with-arrow-and-checkmark-solid-sign-isolated-illustration-vector.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
      {
        url: '/refund-parcel-symbol-check-and-return-parcel-silhouette-icon-shipping-order-package-glyph-pictogram-delivery-box-with-arrow-and-checkmark-solid-sign-isolated-illustration-vector.jpg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <AIChatbot />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
