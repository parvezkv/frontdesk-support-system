-- Create partial unique index to guarantee at the database level that no ticket can have more than one active assignment
CREATE UNIQUE INDEX "unique_active_ticket_assignment" ON "ticket_assignments" ("ticketId") WHERE "releasedAt" IS NULL;
