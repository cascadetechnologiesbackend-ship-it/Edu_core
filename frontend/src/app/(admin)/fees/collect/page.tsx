import { redirect } from "next/navigation";

export default function FeeCollectPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const target = searchParams?.studentId
    ? `/school/collect-fees?studentId=${searchParams.studentId}`
    : "/school/collect-fees";
  redirect(target);
}
