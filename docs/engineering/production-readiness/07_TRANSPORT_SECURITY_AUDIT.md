# 07 Transport Module Security & Telemetry Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Endpoints:** `/api/webhooks/gps-ping`, `/api/transport/live-ping`  
**Database Tables:** `public.vehicles`, `public.routes`, `public.route_stops`, `public.gps_pings`  
**Verdict:** **PASS**  

---

## 1. Transport Security & Telemetry Architecture

1. **Relational RLS on `gps_pings`:**
   In Migration 0060, `gps_pings` was fortified with relational RLS linking back to `public.vehicles(school_id)`:
   ```sql
   CREATE POLICY tenant_select_policy ON public.gps_pings FOR SELECT USING (
     EXISTS (
       SELECT 1 FROM public.vehicles v 
       WHERE v.id = gps_pings.vehicle_id 
       AND security.is_tenant_verified(v.school_id)
     )
   );
   ```
2. **Webhook GPS Ping Hardening:**
   In `frontend/src/app/api/webhooks/gps-ping/route.ts`:
   - Validates device API key.
   - Wraps vehicle lookup in `withAuthContext`.
   - Scopes GPS ping recording strictly inside `withTenant(vehicle.schoolId)`.
3. **Parent & Live Telemetry Scoping:**
   In `frontend/src/app/api/transport/live-ping/route.ts` and `frontend/src/app/api/parent/bus/route.ts`:
   - Validates caller session.
   - Enforces student-vehicle assignment before revealing vehicle coordinates.
   - Runs queries under `withTenant(schoolId)`.
