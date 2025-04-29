import './globals.css'

export const metadata = {
  title: 'API Explorer',
  description: 'API Explorer for Swagger/OpenAPI specifications',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
