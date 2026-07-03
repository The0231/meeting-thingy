import { redirect } from "next/navigation";

// The calendar IS the meetings side of the app.
export default function Home() {
  redirect("/calendar");
}
