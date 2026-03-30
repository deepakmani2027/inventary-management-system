ALTER TABLE inventory_logs
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE OR REPLACE FUNCTION restock_item(
  p_item_id UUID,
  p_quantity INTEGER,
  p_performed_by UUID,
  p_location TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Restock quantity must be positive';
  END IF;

  SELECT COALESCE(quantity, 0)
  INTO current_quantity
  FROM inventory
  WHERE item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO inventory (item_id, quantity, warehouse_location, last_restocked)
    VALUES (p_item_id, p_quantity, p_location, CURRENT_TIMESTAMP);
  ELSE
    UPDATE inventory
    SET quantity = quantity + p_quantity,
        warehouse_location = COALESCE(p_location, warehouse_location),
        last_restocked = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE item_id = p_item_id;
  END IF;

  INSERT INTO inventory_logs (item_id, action, quantity_changed, old_quantity, new_quantity, performed_by, notes)
  VALUES (p_item_id, 'restock', p_quantity, current_quantity, COALESCE(current_quantity, 0) + p_quantity, p_performed_by, p_notes);
END;
$$;
