"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CollaborativeAgreement,
  ProviderDocument,
} from "@/lib/portal/types";
import {
  DOCUMENT_TYPES,
  daysUntilExpiry,
  documentStatusColor,
  formatDate,
} from "@/lib/portal/utils";

const STATUS_STYLES = {
  green: "border-emerald-200 bg-emerald-50",
  yellow: "border-amber-200 bg-amber-50",
  red: "border-red-200 bg-red-50",
  grey: "border-navy/10 bg-navy/5",
};

interface DocumentsClientProps {
  providerId: string;
  documents: ProviderDocument[];
  agreement: CollaborativeAgreement | null;
  icaSigned: boolean;
  baaSigned: boolean;
  caqhLastAttested: string | null;
  licenseState: string | null;
}

export function DocumentsClient({
  providerId,
  documents,
  agreement,
  icaSigned,
  baaSigned,
  caqhLastAttested: initialCaqh,
  licenseState,
}: DocumentsClientProps) {
  const router = useRouter();
  const [caqhDate, setCaqhDate] = useState(initialCaqh ?? "");
  const [uploading, setUploading] = useState<string | null>(null);

  function getDoc(type: string) {
    return documents.find((d) => d.document_type === type);
  }

  async function handleUpload(docType: string) {
    setUploading(docType);
    try {
      const res = await fetch("/api/portal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          document_type: docType,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Document upload initiated.");
      router.refresh();
    } catch {
      toast.error("Could not upload document.");
    } finally {
      setUploading(null);
    }
  }

  async function saveCaqhDate() {
    try {
      const res = await fetch("/api/portal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          caqh_last_attested: caqhDate,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("CAQH attestation date updated.");
    } catch {
      toast.error("Could not update CAQH date.");
    }
  }

  async function requestContracts() {
    try {
      const res = await fetch("/api/portal/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, action: "request_contracts" }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Contract request submitted.");
    } catch {
      toast.error("Could not request contracts.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-navy">
          Documents
        </h1>
        <p className="mt-1 text-navy/70">Credentials and compliance documents</p>
      </div>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Required Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DOCUMENT_TYPES.map(({ type, label }) => {
            const doc = getDoc(type);
            const days = daysUntilExpiry(doc?.expiry_date ?? null);
            const status = doc
              ? documentStatusColor(days)
              : ("grey" as const);

            return (
              <div
                key={type}
                className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${STATUS_STYLES[status]}`}
              >
                <div>
                  <p className="font-medium text-navy">{label}</p>
                  {doc?.expiry_date ? (
                    <p className="text-sm text-navy/60">
                      Expires {formatDate(doc.expiry_date)}
                      {days != null && days >= 0 && ` (${days} days)`}
                    </p>
                  ) : (
                    <p className="text-sm text-navy/60">
                      {doc ? "On file" : "Missing"}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading === type}
                  onClick={() => handleUpload(type)}
                >
                  <Upload className="size-4" />
                  {uploading === type ? "Uploading..." : "Upload"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">CAQH</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>Last attested date</Label>
              <Input
                type="date"
                value={caqhDate}
                onChange={(e) => setCaqhDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button variant="outline" onClick={saveCaqhDate}>
              Update
            </Button>
            <a
              href="https://proview.caqh.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2">
                <ExternalLink className="size-4" /> CAQH ProView
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {licenseState === "FL" && (
        <Card className="border-navy/10">
          <CardHeader>
            <CardTitle className="font-heading text-lg text-navy">
              Collaborative Agreement (FL PMHNP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agreement ? (
              <div className="space-y-1">
                <p className="text-navy">
                  Supervising MD: {agreement.md_name ?? "—"}
                </p>
                <p className="text-sm text-navy/60">
                  Expires:{" "}
                  {agreement.expiry_date
                    ? formatDate(agreement.expiry_date)
                    : "—"}
                </p>
                <Badge variant="outline" className="capitalize">
                  {agreement.status}
                </Badge>
              </div>
            ) : (
              <p className="text-navy/60">No collaborative agreement on file.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-navy/10">
        <CardHeader>
          <CardTitle className="font-heading text-lg text-navy">
            Contracts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-navy">ICA:</span>
              <Badge
                className={
                  icaSigned
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-navy/10 text-navy/60"
                }
              >
                {icaSigned ? "Signed" : "Not signed"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-navy">BAA:</span>
              <Badge
                className={
                  baaSigned
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-navy/10 text-navy/60"
                }
              >
                {baaSigned ? "Signed" : "Not signed"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" onClick={requestContracts}>
            Request New Contracts
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
