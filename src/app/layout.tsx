import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orthia Onboarding",
  description: "Clinic onboarding portal",
};

const chatWidgetConfig = `window.ChatWidgetConfig = {
  apiUrl:         'https://testtenant.orthiaai.com',
  widgetKey:      'zKPLmAgPGRQp40YMWahvjdVWQK7JfWCY6SpQdX0UbCp9FWT3',
  primaryColor:   '#0ea5e9',
  title:          'Chat Support',
  subtitle:       'We reply instantly',
  welcomeMessage: 'Hi! How can I help you today?',
};`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chatWidgetConfig }} />
        <script
          src="https://testtenant.orthiaai.com/widget/chat-widget.iife.js"
          async
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
