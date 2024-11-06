
// pages/_app.js
import '../styles/globals.css';
import { FileProvider } from '../context/FileContext';

function MyApp({ Component, pageProps }) {
  return (
    <FileProvider>
      <Component {...pageProps} />
    </FileProvider>
  );
}

export default MyApp;
