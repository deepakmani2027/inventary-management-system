-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles enum
CREATE TYPE user_role AS ENUM ('admin', 'salesman', 'inventory_manager', 'sales_manager');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  description TEXT,
  unit_price DECIMAL(10, 2) NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  warehouse_location TEXT,
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_id)
);

-- Sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salesman_id UUID NOT NULL REFERENCES users(id),
  bill_number TEXT UNIQUE DEFAULT ('BILL-' || substring(uuid_generate_v4()::text, 1, 8)),
  customer_name TEXT,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items table
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Logs table
CREATE TABLE inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id),
  action TEXT NOT NULL,
  quantity_changed INTEGER NOT NULL,
  old_quantity INTEGER,
  new_quantity INTEGER,
  performed_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Create indexes
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);
CREATE INDEX idx_sales_salesman ON sales(salesman_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_item ON sale_items(item_id);
CREATE INDEX idx_inventory_logs_item ON inventory_logs(item_id);
CREATE INDEX idx_inventory_logs_user ON inventory_logs(performed_by);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- RLS Policies for Categories
CREATE POLICY "All authenticated users can view categories" ON categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert categories" ON categories
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- RLS Policies for Items
CREATE POLICY "All authenticated users can view items" ON items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and Inventory Managers can manage items" ON items
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'inventory_manager')
  );

-- RLS Policies for Inventory
CREATE POLICY "All authenticated users can view inventory" ON inventory
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Inventory Managers can update inventory" ON inventory
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'inventory_manager')
  );

CREATE POLICY "Inventory Managers can insert inventory" ON inventory
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'inventory_manager')
  );

-- RLS Policies for Sales
CREATE POLICY "Salesmen can view own sales" ON sales
  FOR SELECT USING (salesman_id = auth.uid());

CREATE POLICY "Sales Managers can view all sales" ON sales
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales_manager')
  );

CREATE POLICY "Salesmen can create sales" ON sales
  FOR INSERT WITH CHECK (
    salesman_id = auth.uid() AND (SELECT role FROM users WHERE id = auth.uid()) = 'salesman'
  );

CREATE POLICY "Sales managers and admins can update sales" ON sales
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales_manager')
  );

-- RLS Policies for Sale Items
CREATE POLICY "Users can view sale items for their sales" ON sale_items
  FOR SELECT USING (
    sale_id IN (
      SELECT id FROM sales WHERE salesman_id = auth.uid()
      UNION
      SELECT id FROM sales WHERE (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'sales_manager')
    )
  );

CREATE POLICY "Salesmen can create sale items" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales WHERE id = sale_id AND salesman_id = auth.uid()
    )
  );

-- RLS Policies for Inventory Logs
CREATE POLICY "All authenticated users can view inventory logs" ON inventory_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Inventory Managers can create logs" ON inventory_logs
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'inventory_manager')
  );

CREATE POLICY "Salesmen can create sale logs" ON inventory_logs
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'salesman'
  );

-- RLS Policies for Notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Transactional helpers
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

CREATE OR REPLACE FUNCTION cancel_sale(
  p_sale_id UUID,
  p_performed_by UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_item_record RECORD;
  stock_before INTEGER;
BEGIN
  FOR sale_item_record IN
    SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    SELECT COALESCE(quantity, 0)
    INTO stock_before
    FROM inventory
    WHERE item_id = sale_item_record.item_id
    FOR UPDATE;

    UPDATE inventory
    SET quantity = quantity + sale_item_record.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE item_id = sale_item_record.item_id;

    INSERT INTO inventory_logs (item_id, action, quantity_changed, old_quantity, new_quantity, performed_by)
    VALUES (
      sale_item_record.item_id,
      'cancel',
      sale_item_record.quantity,
      stock_before,
      stock_before + sale_item_record.quantity,
      p_performed_by
    );
  END LOOP;

  UPDATE sales SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = p_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION return_sale_item(
  p_sale_id UUID,
  p_item_id UUID,
  p_quantity INTEGER,
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
  unit_price_value NUMERIC(10,2);
  sale_quantity INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Return quantity must be positive';
  END IF;

  SELECT quantity, unit_price
  INTO sale_quantity, unit_price_value
  FROM sale_items
  WHERE sale_id = p_sale_id AND item_id = p_item_id
  LIMIT 1;

  IF NOT FOUND OR sale_quantity < p_quantity THEN
    RAISE EXCEPTION 'Invalid return quantity';
  END IF;

  SELECT COALESCE(quantity, 0)
  INTO current_quantity
  FROM inventory
  WHERE item_id = p_item_id
  FOR UPDATE;

  UPDATE inventory
  SET quantity = quantity + p_quantity,
      updated_at = CURRENT_TIMESTAMP
  WHERE item_id = p_item_id;

  UPDATE sale_items
  SET quantity = quantity - p_quantity,
      subtotal = subtotal - (unit_price_value * p_quantity)
  WHERE sale_id = p_sale_id AND item_id = p_item_id;

  INSERT INTO inventory_logs (item_id, action, quantity_changed, old_quantity, new_quantity, performed_by)
  VALUES (
    p_item_id,
    'return',
    p_quantity,
    current_quantity,
    current_quantity + p_quantity,
    p_performed_by
  );

  UPDATE sales
  SET total_amount = (
        SELECT COALESCE(SUM(sale_items.subtotal), 0)
        FROM sale_items
        WHERE sale_items.sale_id = p_sale_id
      ),
      status = CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM sale_items
          WHERE sale_items.sale_id = p_sale_id
            AND sale_items.quantity > 0
        ) THEN 'returned'
        ELSE 'completed'
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_sale_id;
END;
$$;

-- Insert sample data
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and components'),
('Office Supplies', 'Office equipment and supplies'),
('Hardware', 'Hardware tools and equipment');

INSERT INTO items (name, category_id, unit_price, reorder_level) VALUES
('Laptop', (SELECT id FROM categories WHERE name = 'Electronics'), 999.99, 5),
('Desk Chair', (SELECT id FROM categories WHERE name = 'Office Supplies'), 299.99, 10),
('Drill Machine', (SELECT id FROM categories WHERE name = 'Hardware'), 150.00, 3);

INSERT INTO inventory (item_id, quantity, warehouse_location) VALUES
((SELECT id FROM items WHERE name = 'Laptop'), 20, 'Warehouse A - Shelf 1'),
((SELECT id FROM items WHERE name = 'Desk Chair'), 50, 'Warehouse B - Shelf 3'),
((SELECT id FROM items WHERE name = 'Drill Machine'), 15, 'Warehouse A - Shelf 5');
