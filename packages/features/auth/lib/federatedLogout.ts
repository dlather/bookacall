import { signOut } from "next-auth/react";

export default async function federatedLogout() {
  try {
    const res = await fetch("/api/auth/federated-logout");
    const status = await res.json();
    if (status.result === 204) {
      await signOut();
      return;
    }
    console.error("Failed to logout user from Keycloak", status);
  } catch (error) {
    console.log(error);
    alert(error);
  }
}

export async function logoutAndDeleteUser(deleteAccount: () => Promise<void>) {
  try {
    const res = await fetch("/api/auth/federated-logout");
    const status = await res.json();
    if (status.result === 204) {
      await deleteAccount();
      return;
    }
    console.error("Failed to logout user from Keycloak", status);
  } catch (error) {
    console.log(error);
    alert(error);
  }
}
