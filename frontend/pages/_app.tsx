import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import ToastContainer from "../components/ToastContainer";
import { AuthProvider } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
            <ToastContainer />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
