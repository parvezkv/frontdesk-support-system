-- Create trigger function to enforce append-only immutability on ticket_events
CREATE OR REPLACE FUNCTION prevent_ticket_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow explicit administrative resets only if session variable 'frontdesk.allow_audit_reset' is set to 'true'
  IF current_setting('frontdesk.allow_audit_reset', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit trail violation: TicketEvent records are immutable and cannot be updated.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit trail violation: TicketEvent records are append-only and cannot be deleted.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ticket_events_modification ON ticket_events;

CREATE TRIGGER trg_prevent_ticket_events_modification
BEFORE UPDATE OR DELETE ON ticket_events
FOR EACH ROW
EXECUTE FUNCTION prevent_ticket_events_modification();
