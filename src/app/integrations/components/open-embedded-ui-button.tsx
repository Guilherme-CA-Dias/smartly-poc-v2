"use client";

import { useIntegrationApp } from "@integration-app/react";
import { Button } from "@/components/ui/button";
import { LayoutGrid } from "lucide-react";

export function OpenEmbeddedUIButton() {
  const integrationApp = useIntegrationApp();

  return (
    <Button variant="outline" size="sm" onClick={() => integrationApp.open()}>
      <LayoutGrid className="w-4 h-4 mr-2" />
      Browse Integrations
    </Button>
  );
}
