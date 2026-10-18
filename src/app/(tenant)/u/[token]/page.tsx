export default async function TenantPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <main className="p-8">Tenant {token}</main>;
}
