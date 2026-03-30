CREATE OR REPLACE FUNCTION process_sale(
  p_salesman_id UUID,
  p_customer_name TEXT,
  p_items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_id UUID;
  item_record JSONB;
  v_item_id UUID;
  quantity_to_sell INTEGER;
  unit_price NUMERIC(10,2);
  current_quantity INTEGER;
  subtotal NUMERIC(12,2);
BEGIN
  INSERT INTO sales (salesman_id, customer_name, total_amount, status)
  VALUES (p_salesman_id, p_customer_name, 0, 'completed')
  RETURNING id INTO sale_id;

  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (item_record->>'item_id')::UUID;
    quantity_to_sell := COALESCE((item_record->>'quantity')::INTEGER, 0);

    IF quantity_to_sell <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for item %', v_item_id;
    END IF;

    SELECT i.unit_price, COALESCE(inv.quantity, 0)
    INTO unit_price, current_quantity
    FROM items i
    LEFT JOIN inventory inv ON inv.item_id = i.id
    WHERE i.id = v_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found', v_item_id;
    END IF;

    IF current_quantity < quantity_to_sell THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_item_id;
    END IF;

    subtotal := unit_price * quantity_to_sell;

    INSERT INTO sale_items (sale_id, item_id, quantity, unit_price, subtotal)
    VALUES (sale_id, v_item_id, quantity_to_sell, unit_price, subtotal);

    UPDATE inventory
    SET quantity = quantity - quantity_to_sell,
        updated_at = CURRENT_TIMESTAMP
    WHERE item_id = v_item_id;

    INSERT INTO inventory_logs (item_id, action, quantity_changed, old_quantity, new_quantity, performed_by)
    VALUES (v_item_id, 'sale', -quantity_to_sell, current_quantity, current_quantity - quantity_to_sell, p_salesman_id);
  END LOOP;

  UPDATE sales
  SET total_amount = (
    SELECT COALESCE(SUM(sale_items.subtotal), 0)
    FROM sale_items
    WHERE sale_items.sale_id = sales.id
  )
  WHERE id = sale_id;

  RETURN sale_id;
END;
$$;