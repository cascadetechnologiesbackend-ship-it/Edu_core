import { db } from "@/db";
import { admissionApplications, admissionWorkflowSteps, classes, sections } from "@/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StatusUpdater } from "./StatusUpdater";
import { decryptData } from "@/lib/encryption";

export default async function AdmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const application = await db.query.admissionApplications.findFirst({
    where: eq(admissionApplications.id, params.id),
    with: {
      workflowSteps: {
        orderBy: [desc(admissionWorkflowSteps.stepNumber)],
      },
      documents: true,
    },
  });

  if (!application) {
    notFound();
  }

  const schoolClasses = await db.query.classes.findMany({
    where: and(
      eq(classes.schoolId, application.schoolId),
      eq(classes.isActive, true),
    ),
    with: {
      sections: {
        where: eq(sections.isActive, true),
      },
    },
    orderBy: [asc(classes.sortOrder), asc(classes.displayName)],
  });

  const availableClasses = schoolClasses.map((c) => ({
    id: c.id,
    name: c.displayName,
    sections: c.sections?.map((s) => ({ id: s.id, name: s.name })),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Application {application.applicationNumber}
          </h1>
          <p className="text-gray-500 mt-1">
            Submitted on {application.createdAt?.toLocaleDateString()}
          </p>
        </div>

        <StatusUpdater
          currentStatus={application.status}
          applicationId={application.id}
          enrolledStudentId={application.enrolledStudentId}
          availableClasses={availableClasses}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Applicant Details */}
        <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">
            Applicant Details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Name</span>
              <span className="col-span-2 font-medium">
                {decryptData(application.applicantNameEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Grade Applied</span>
              <span className="col-span-2 font-medium">
                {application.gradeAppliedFor.replace("_", " ")}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Gender</span>
              <span className="col-span-2">{application.gender}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">DOB</span>
              <span className="col-span-2">
                {application.dateOfBirth?.toLocaleDateString()}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Category</span>
              <span className="col-span-2">{application.category}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Aadhaar</span>
              <span className="col-span-2">{decryptData(application.aadhaarNumberEncrypted) || "Not Provided"}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">RTE Applicant</span>
              <span className="col-span-2">
                {application.isRteApplicant ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        {/* Family Details */}
        <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4">
            Family & Contact
          </h2>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Father's Name</span>
              <span className="col-span-2">
                {decryptData(application.fatherNameEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Mother's Name</span>
              <span className="col-span-2">
                {decryptData(application.motherNameEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Mobile</span>
              <span className="col-span-2 font-medium">
                {decryptData(application.primaryContactMobileEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Email</span>
              <span className="col-span-2">
                {decryptData(application.primaryContactEmailEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Address</span>
              <span className="col-span-2">
                {decryptData(application.addressEncrypted)}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-gray-500">Pincode</span>
              <span className="col-span-2">{application.pincode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">
          Uploaded Documents
        </h2>
        {application.documents && application.documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {application.documents.map((doc: any) => (
              <div key={doc.id} className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-800 flex items-start space-x-3">
                <span className="text-3xl">📄</span>
                <div className="overflow-hidden">
                  <p className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                    {doc.documentType.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-500 truncate" title={doc.originalFileName}>
                    {doc.originalFileName}
                  </p>
                  {doc.isVerified && (
                    <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 bg-green-100 text-green-800 rounded">
                      Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No documents uploaded.</p>
        )}
      </div>

      {/* Workflow Steps */}
      <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold border-b pb-2 mb-4">
          Workflow History
        </h2>
        <div className="space-y-4">
          {application.workflowSteps.map((step) => (
            <div key={step.id} className="flex gap-4 items-start">
              <div className="mt-1 h-3 w-3 rounded-full bg-blue-500"></div>
              <div>
                <p className="font-medium">{step.stepName}</p>
                <p className="text-sm text-gray-500">
                  {step.completedAt?.toLocaleString()}
                </p>
                {step.notes && <p className="text-sm mt-1">{step.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
