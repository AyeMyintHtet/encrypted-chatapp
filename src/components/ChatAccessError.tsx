"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function ChatAccessError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "chat_access_denied") {
      setIsOpen(true);
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsOpen(false);
    
    // Remove the error param from the URL without full reload
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("error");
    
    // Use relative path for Next.js router
    const newPath = currentUrl.pathname + currentUrl.search;
    router.replace(newPath, { scroll: false });
  };

  if (!isOpen) return null;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleClose}
      title="Access Denied"
      message="You do not have permission to access that chat. Either you haven't been added to their contacts, or the request was declined."
      confirmText="Okay"
      cancelText="Close"
      type="danger"
    />
  );
}
