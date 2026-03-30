-- Fix recursive RLS checks on users and dependent tables.
-- Apply this migration after the base schema if the database already exists.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins and Inventory Managers can manage items" ON items;
DROP POLICY IF EXISTS "Inventory Managers can update inventory" ON inventory;
DROP POLICY IF EXISTS "Inventory Managers can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Sales Managers can view all sales" ON sales;
DROP POLICY IF EXISTS "Salesmen can create sales" ON sales;
DROP POLICY IF EXISTS "Sales managers and admins can update sales" ON sales;
DROP POLICY IF EXISTS "Salesmen can create sale items" ON sale_items;
DROP POLICY IF EXISTS "Inventory Managers can create logs" ON inventory_logs;
DROP POLICY IF EXISTS "Salesmen can create sale logs" ON inventory_logs;

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "Admins can insert categories" ON categories
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admins and Inventory Managers can manage items" ON items
  FOR ALL USING (public.current_user_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Inventory Managers can update inventory" ON inventory
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Inventory Managers can insert inventory" ON inventory
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Sales Managers can view all sales" ON sales
  FOR SELECT USING (public.current_user_role() IN ('admin', 'sales_manager'));

CREATE POLICY "Salesmen can create sales" ON sales
  FOR INSERT WITH CHECK (
    salesman_id = auth.uid() AND public.current_user_role() = 'salesman'
  );

CREATE POLICY "Sales managers and admins can update sales" ON sales
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'sales_manager'));

CREATE POLICY "Salesmen can create sale items" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales WHERE id = sale_id AND salesman_id = auth.uid()
    )
  );

CREATE POLICY "Inventory Managers can create logs" ON inventory_logs
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Salesmen can create sale logs" ON inventory_logs
  FOR INSERT WITH CHECK (public.current_user_role() = 'salesman');