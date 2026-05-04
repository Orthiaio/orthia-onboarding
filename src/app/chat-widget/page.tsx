"use client";

import Script from "next/script";

declare global {
  interface Window {
    ChatWidgetConfig?: {
      apiUrl: string;
      widgetKey: string;
      primaryColor?: string;
      title?: string;
      subtitle?: string;
      welcomeMessage?: string;
    };
  }
}

export default function ChatWidgetPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← Back to home
        </a>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">Chat Widget</h1>
        <p className="mt-3 text-gray-600">
          The Orthia AI chat widget is embedded on this page. Look for the chat
          bubble in the bottom-right corner of the screen.
        </p>
      </div>

      <Script
        id="chat-widget-config"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.ChatWidgetConfig = {
  apiUrl: 'https://testtenant.orthiaai.com',
  widgetKey: 'zKPLmAgPGRQp40YMWahvjdVWQK7JfWCY6SpQdX0UbCp9FWT3',
  primaryColor: '#0ea5e9',
  title: 'Chat Support',
  subtitle: 'We reply instantly',
  welcomeMessage: 'Hi! How can I help you today?',
};`,
        }}
      />
      <Script
        src="https://testtenant.orthiaai.com/widget/chat-widget.iife.js"
        strategy="afterInteractive"
      />
    </main>
  );
}
