"use client";

import { useState } from "react";
import { provisionNewSchool } from "./actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProvisionSchoolWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await provisionNewSchool(formData);
      if (res.success) {
        toast.success("School provisioned successfully!");
        router.push("/platform/schools");
      } else {
        toast.error(res.message || "Failed to provision school");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Provision New School</h1>
      <p className="text-muted-foreground">This wizard creates a new tenant schema, runs base migrations, and creates a default admin user.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 border rounded-lg">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium leading-none">School Name</label>
          <input id="name" name="name" required placeholder="e.g. Springfield Elementary" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="udiseCode" className="text-sm font-medium leading-none">UDISE Code (Acts as Tenant Slug)</label>
          <input id="udiseCode" name="udiseCode" required placeholder="e.g. 12345678901" pattern="[a-zA-Z0-9_]{4,15}" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <p className="text-xs text-muted-foreground">Alphanumeric only. Will be used to create schema `tenant_[udisecode]`</p>
        </div>



        <div className="pt-4 border-t space-y-4">
          <h3 className="font-semibold text-sm">Initial School Admin</h3>
          <div className="space-y-2">
            <label htmlFor="adminEmail" className="text-sm font-medium leading-none">Admin Email</label>
            <input id="adminEmail" name="adminEmail" type="email" required placeholder="admin@springfield.edu" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="adminPassword" className="text-sm font-medium leading-none">Admin Initial Password</label>
            <input id="adminPassword" name="adminPassword" type="password" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" disabled={loading} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full disabled:opacity-50">
            {loading ? "Provisioning Tenant..." : "Provision School"}
          </button>
        </div>
      </form>
    </div>
  );
}
