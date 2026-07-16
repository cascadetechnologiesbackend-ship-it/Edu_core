import { db } from "./src/db";

async function verify() {
  console.log("Verifying relations for schools...");
  try {
    await db.query.schools.findFirst({
      with: {
        academicYears: true,
        users: true,
      },
    });
    console.log("Query successful!");
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.stack) console.error(e.stack);
  }
}

verify();
