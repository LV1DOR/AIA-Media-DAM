import { connection } from "next/server";
import SmoothFollower from "@aia/ui/components/smooth-follower";
import "./globals.css";
export const metadata = {
  title: "AIA Transfer",
  description: "Autódromo Internacional do Algarve · File delivery",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="en">
      <body>
        {children}
        <SmoothFollower />
      </body>
    </html>
  );
}
