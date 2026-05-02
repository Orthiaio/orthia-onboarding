import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orthia Onboarding",
  description: "Clinic onboarding portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
      <Script id="chat-widget-config" strategy="beforeInteractive">
        {`window.ChatWidgetConfig = {
          apiUrl:         'https://testtenant.orthiaai.com',
          widgetKey:      'zKPLmAgPGRQp40YMWahvjdVWQK7JfWCY6SpQdX0UbCp9FWT3',
          primaryColor:   '#0ea5e9',
          title:          'Chat Support',
          subtitle:       'We reply instantly',
          welcomeMessage: 'Hi! How can I help you today?',
        };`}
      </Script>
      <Script
        src="https://testtenant.orthiaai.com/widget/chat-widget.iife.js"
        strategy="afterInteractive"
      />
    </html>
  );
}
