import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <small className="text-default mx-3 mb-2 mt-1 hidden text-[0.7rem] font-medium lg:block">
      <Link
        href="https://www.bookacall.me/legal/terms-of-services"
        target="_blank"
        className="hover:underline">
        Terms of Use
      </Link>{" "}
    </small>
  );
}
