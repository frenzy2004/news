import "./globals.css";

export const metadata = {
  title: "BTW Business Relevance",
  description: "Find live world news that matters to a business using BTW."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
