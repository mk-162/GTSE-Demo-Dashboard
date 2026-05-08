import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { AccountView } from "./account-view";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData();
  const company = await data.companyById(decodeURIComponent(id));
  if (!company) notFound();
  const orders = await data.ordersForCompany(company.id);

  return <AccountView company={company} orders={orders} />;
}
