import { redirect } from "next/navigation";

export default async function Home(props: { searchParams: Promise<{ iss?: string; launch?: string }> }) {
  const searchParams = await props.searchParams;
  
  if (searchParams?.iss && searchParams?.launch) {
    const params = new URLSearchParams();
    params.set("iss", searchParams.iss);
    params.set("launch", searchParams.launch);
    redirect(`/api/auth/smart/launch?${params.toString()}`);
  }

  redirect("/dashboard");
}
