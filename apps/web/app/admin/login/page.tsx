import { redirect } from 'next/navigation';

/** Retain existing bookmarks while the canonical platform sign-in path is /admin/sign-in. */
export default function AdminLoginPage() {
  redirect('/admin/sign-in');
}
