"use client"
import ProfileComponent from "@/components/profile/profileComponent";
import SignOutModal from "@/components/SignOut";
import { useState } from "react";

export default function ProfilePage() {

  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8 min-h-screen">
      <ProfileComponent setShowSignOutConfirm={setShowSignOutConfirm} />
      <SignOutModal showSignOutConfirm={showSignOutConfirm} setShowSignOutConfirm={setShowSignOutConfirm} />
    </main>

  )
}