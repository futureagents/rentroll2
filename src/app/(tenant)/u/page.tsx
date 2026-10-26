import { notFound } from "next/navigation";

// `/u` with no token is not a page; it renders E1-10 like any other link that does not resolve.
export default function NoToken() {
  notFound();
}
