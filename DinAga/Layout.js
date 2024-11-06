// app/layout.js
import './globals.css';
import { FileProvider } from '../context/FileContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <FileProvider>
          {children}
        </FileProvider>
      </body>
    </html>
  );
}
