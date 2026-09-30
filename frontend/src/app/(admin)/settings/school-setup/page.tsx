"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createSchoolSchema,
  createAcademicYearSchema,
} from "@schoolmitra/validators";
import {
  Building,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Save,
} from "lucide-react";
import { z } from "zod";
import { setupSchool } from "./actions";

const STEPS = [
  { id: 1, label: "Basic Info", icon: Building },
  { id: 2, label: "Affiliation", icon: BookOpen },
  { id: 3, label: "Academic Year", icon: Calendar },
];

// Combine schemas for the wizard
const wizardSchema = createSchoolSchema.and(
  z.object({
    academicYearLabel: createAcademicYearSchema.shape.label,
    academicYearStart: createAcademicYearSchema.shape.startDate,
    academicYearEnd: createAcademicYearSchema.shape.endDate,
  }),
);

type WizardFormData = z.infer<typeof wizardSchema>;

export default function SchoolSetupPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      board: "CBSE",
      academicYearStart: "2025-04-01",
      academicYearEnd: "2026-03-31",
      establishedYear: new Date().getFullYear(),
    },
  });

  const nextStep = async () => {
    // Validate current step fields before proceeding
    let fieldsToValidate: Array<keyof WizardFormData> = [];
    if (currentStep === 1) {
      fieldsToValidate = [
        "name",
        "address",
        "city",
        "state",
        "pincode",
        "phone",
        "email",
        "principalName",
        "establishedYear",
      ];
    } else if (currentStep === 2) {
      fieldsToValidate = ["board", "udiseCode"];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const onSubmit = async (data: WizardFormData) => {
    setIsSubmitting(true);
    try {
      await setupSchool(data);
      alert("School setup complete! Data saved successfully.");
      // Optionally redirect to another page
    } catch (e) {
      console.error(e);
      alert("Failed to save setup data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          School Setup Wizard
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your institution and initial academic year.
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step) => (
          <div
            key={step.id}
            className="flex flex-col items-center gap-2 bg-background px-2"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                currentStep >= step.id
                  ? "bg-primary border-primary text-white"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {currentStep > step.id ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <step.icon className="w-5 h-5" />
              )}
            </div>
            <span
              className={`text-xs font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Basic Info */}
          <div className={currentStep === 1 ? "block space-y-4" : "hidden"}>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  School Name
                </label>
                <input
                  {...register("name")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  placeholder="Saraswati Public School"
                />
                {errors.name && (
                  <p className="text-xs text-danger mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Address
                </label>
                <input
                  {...register("address")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  placeholder="Street address"
                />
                {errors.address && (
                  <p className="text-xs text-danger mt-1">
                    {errors.address.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  {...register("city")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.city && (
                  <p className="text-xs text-danger mt-1">
                    {errors.city.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input
                  {...register("state")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.state && (
                  <p className="text-xs text-danger mt-1">
                    {errors.state.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Pincode
                </label>
                <input
                  {...register("pincode")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.pincode && (
                  <p className="text-xs text-danger mt-1">
                    {errors.pincode.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number
                </label>
                <input
                  {...register("phone")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  placeholder="10 digits"
                />
                {errors.phone && (
                  <p className="text-xs text-danger mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.email && (
                  <p className="text-xs text-danger mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Principal Name
                </label>
                <input
                  {...register("principalName")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.principalName && (
                  <p className="text-xs text-danger mt-1">
                    {errors.principalName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Established Year
                </label>
                <input
                  {...register("establishedYear", { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.establishedYear && (
                  <p className="text-xs text-danger mt-1">
                    {errors.establishedYear.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Affiliation */}
          <div className={currentStep === 2 ? "block space-y-4" : "hidden"}>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Affiliation Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board</label>
                <select
                  {...register("board")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="STATE_BOARD">State Board</option>
                  <option value="IGCSE">IGCSE</option>
                  <option value="IB">IB</option>
                </select>
                {errors.board && (
                  <p className="text-xs text-danger mt-1">
                    {errors.board.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  UDISE Code
                </label>
                <input
                  {...register("udiseCode")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  placeholder="11 digit code"
                />
                {errors.udiseCode && (
                  <p className="text-xs text-danger mt-1">
                    {errors.udiseCode.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Academic Year */}
          <div className={currentStep === 3 ? "block space-y-4" : "hidden"}>
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">
              Initial Academic Year
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Academic Year Label
                </label>
                <input
                  {...register("academicYearLabel")}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  placeholder="2025-26"
                />
                {errors.academicYearLabel && (
                  <p className="text-xs text-danger mt-1">
                    {errors.academicYearLabel.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start Date
                </label>
                <input
                  {...register("academicYearStart")}
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.academicYearStart && (
                  <p className="text-xs text-danger mt-1">
                    {errors.academicYearStart.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  End Date
                </label>
                <input
                  {...register("academicYearEnd")}
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
                {errors.academicYearEnd && (
                  <p className="text-xs text-danger mt-1">
                    {errors.academicYearEnd.message}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-6">
              <h3 className="text-primary font-semibold text-sm mb-1">
                Next Steps After Setup
              </h3>
              <ul className="text-sm text-foreground list-disc list-inside space-y-1">
                <li>Configure DPDP Privacy Notice (Admin {">"} Privacy)</li>
                <li>Set up Fee Heads and Class Structures</li>
                <li>Import existing students and staff</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-between border-t pt-4">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || isSubmitting}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:bg-secondary/90 flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Complete Setup"}{" "}
                <Save className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
